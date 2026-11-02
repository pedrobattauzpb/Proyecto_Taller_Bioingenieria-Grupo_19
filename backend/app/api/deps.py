from typing import List, Tuple, Callable
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import jwt

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.core.permissions import Permission, ROLE_PERMISSIONS
from app.models.user import User, UserRole
from app.models.compliance import AuditEventType
from app.services.auth_service import log_security_event

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=True
)


def get_request_context(request: Request) -> Tuple[str, str]:
    """Extrae la IP cliente y el User-Agent de la solicitud."""
    client_host = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    return client_host, user_agent


async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Decodifica el JWT de acceso, verifica que sea de tipo 'access',
    que el usuario exista, esté activo y que la versión del token coincida.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales de autenticación inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        token_type = payload.get("type")
        if token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tipo de token inválido para este endpoint (se requiere access token)",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id_str = payload.get("sub")
        token_version = payload.get("tv")
        if user_id_str is None or token_version is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    stmt = select(User).options(selectinload(User.hospitals)).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión revocada o desactualizada. Inicie sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    request: Request,
    user: User = Depends(get_current_user)
) -> User:
    """
    Verifica que el usuario no tenga pendiente el cambio obligatorio de contraseña.
    Si must_change_password=True, solo se habilitan rutas bajo /auth/* (para ver /auth/me o cambiar la clave).
    """
    if user.must_change_password:
        path = request.url.path
        if not path.startswith(f"{settings.API_V1_STR}/auth"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Debe cambiar su contraseña obligatoria antes de operar en el sistema"
            )
    return user


def require_permissions(*perms: Permission) -> Callable:
    """
    Verifica que el usuario tenga TODOS los permisos indicados según su rol.
    Si falta alguno, registra ACCESS_DENIED en la bitácora inmutable y lanza 403.
    """
    async def permission_checker(
        request: Request,
        user: User = Depends(get_current_active_user)
    ) -> User:
        user_perms = ROLE_PERMISSIONS.get(user.role, frozenset())
        missing = [p for p in perms if p not in user_perms]
        if missing:
            ip, ua = get_request_context(request)
            await log_security_event(
                db=None,
                event_type=AuditEventType.ACCESS_DENIED,
                user=user,
                ip=ip,
                user_agent=ua,
                detail={
                    "path": request.url.path,
                    "method": request.method,
                    "missing_permissions": [p.value for p in missing],
                    "user_role": user.role.value
                },
                isolated_session=True
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes para realizar esta operación"
            )
        return user

    return permission_checker


def require_any_permission(*perms: Permission) -> Callable:
    """
    Verifica que el usuario tenga AL MENOS UNO de los permisos indicados.
    """
    async def any_permission_checker(
        request: Request,
        user: User = Depends(get_current_active_user)
    ) -> User:
        user_perms = ROLE_PERMISSIONS.get(user.role, frozenset())
        has_any = any(p in user_perms for p in perms)
        if not has_any:
            ip, ua = get_request_context(request)
            await log_security_event(
                db=None,
                event_type=AuditEventType.ACCESS_DENIED,
                user=user,
                ip=ip,
                user_agent=ua,
                detail={
                    "path": request.url.path,
                    "method": request.method,
                    "required_any_of": [p.value for p in perms],
                    "user_role": user.role.value
                },
                isolated_session=True
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes para realizar esta operación"
            )
        return user

    return any_permission_checker
