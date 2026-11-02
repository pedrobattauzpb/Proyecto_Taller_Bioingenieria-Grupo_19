from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_sse_ticket
from app.core.permissions import ROLE_PERMISSIONS
from app.models.user import User
from app.schemas.auth import (
    TokenPair,
    RefreshRequest,
    PasswordChangeRequest,
    CurrentUserRead,
    LoginResponse,
    StreamTicketResponse,
)
from app.api.deps import get_current_user, get_request_context
from app.services.auth_service import AuthService
from app.services.access_control import get_user_hospital_ids

router = APIRouter()
auth_router = router


def serialize_current_user(user: User) -> CurrentUserRead:
    perms = [p.value for p in ROLE_PERMISSIONS.get(user.role, frozenset())]
    h_ids = list(get_user_hospital_ids(user))
    return CurrentUserRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        professional_license=user.professional_license,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_active=user.is_active,
        has_global_scope=user.has_global_scope,
        must_change_password=user.must_change_password,
        permissions=perms,
        hospital_ids=h_ids,
    )


@router.post("/login", response_model=LoginResponse, summary="Iniciar sesión con credenciales")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    Autenticación con usuario y contraseña (compatible con Swagger Authorize).
    Genera un access token JWT y un refresh token opaco rotativo.
    """
    ip, ua = get_request_context(request)
    user = await AuthService.authenticate(
        db=db,
        email=form_data.username,
        password=form_data.password,
        ip=ip,
        user_agent=ua
    )
    tokens = await AuthService.issue_token_pair(db, user, ip=ip, user_agent=ua)
    user_read = serialize_current_user(user)

    return LoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        user=user_read
    )


@router.post("/refresh", response_model=TokenPair, summary="Rotar refresh token")
async def refresh_token(
    request: Request,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Rota el refresh token y emite un nuevo par de tokens.
    Detecta automáticamente reutilización para mitigar robo de credenciales.
    """
    ip, ua = get_request_context(request)
    tokens, _ = await AuthService.rotate_refresh_token(
        db=db,
        raw_refresh_token=payload.refresh_token,
        ip=ip,
        user_agent=ua
    )
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Cerrar sesión")
async def logout(
    request: Request,
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """Revoca la familia del refresh token."""
    ip, ua = get_request_context(request)
    await AuthService.logout(db, payload.refresh_token, ip=ip, user_agent=ua)


@router.get("/me", response_model=CurrentUserRead, summary="Obtener usuario autenticado actual")
async def get_me(user: User = Depends(get_current_user)):
    """Retorna los datos del usuario autenticado, sus permisos efectivos y hospitales asignados."""
    return serialize_current_user(user)


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT, summary="Cambiar contraseña personal")
async def change_my_password(
    request: Request,
    payload: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Permite al usuario cambiar su propia contraseña e invalida sesiones anteriores."""
    ip, ua = get_request_context(request)
    await AuthService.change_password(
        db=db,
        user=user,
        current_password=payload.current_password,
        new_password=payload.new_password,
        ip=ip,
        user_agent=ua
    )


@router.post("/stream-ticket", response_model=StreamTicketResponse, summary="Obtener ticket temporal para SSE")
async def get_stream_ticket(user: User = Depends(get_current_user)):
    """
    Emite un ticket JWT de 60 segundos de validez para conectar EventSource
    al stream de alertas en tiempo real sin exponer credenciales en la URL.
    """
    ticket = create_sse_ticket(user)
    return StreamTicketResponse(ticket=ticket, expires_in=60)
