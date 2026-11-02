from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import Permission, ROLE_PERMISSIONS
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserRead,
    UserHospitalsUpdate,
    PasswordResetResponse,
    RoleRead,
)
from app.api.deps import (
    get_request_context,
    require_permissions,
    require_any_permission,
)
from app.services.user_service import UserService
from app.services.access_control import get_user_hospital_ids

users_router = APIRouter()
roles_router = APIRouter()


def serialize_user(user: User, temp_password: Optional[str] = None) -> UserRead:
    h_ids = list(get_user_hospital_ids(user))
    return UserRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        professional_license=user.professional_license,
        role=user.role,
        is_active=user.is_active,
        has_global_scope=user.has_global_scope,
        must_change_password=user.must_change_password,
        failed_login_attempts=user.failed_login_attempts,
        locked_until=user.locked_until,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
        hospital_ids=h_ids,
        temporary_password=temp_password,
    )


@users_router.get("", response_model=List[UserRead], summary="Listar usuarios")
async def list_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    actor: User = Depends(require_permissions(Permission.USERS_READ)),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista usuarios del sistema.
    - ADMIN: ve todos los usuarios.
    - SUPERVISOR: ve únicamente los Técnicos asignados a sus mismos hospitales.
    """
    users = await UserService.list_users(
        db=db,
        actor=actor,
        role=role,
        is_active=is_active,
        q=q,
        limit=limit,
        offset=offset
    )
    return [serialize_user(u) for u in users]


@users_router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED, summary="Crear nuevo usuario")
async def create_user(
    request: Request,
    user_in: UserCreate,
    actor: User = Depends(require_any_permission(Permission.USERS_MANAGE, Permission.USERS_MANAGE_TECHNICIANS)),
    db: AsyncSession = Depends(get_db)
):
    """
    Crea una nueva cuenta de usuario.
    - SUPERVISOR: solo puede crear cuentas TECHNICIAN en hospitales de su propio alcance.
    """
    ip, ua = get_request_context(request)
    new_user, temp_pass = await UserService.create_user(
        db=db,
        actor=actor,
        user_in=user_in,
        ip=ip,
        user_agent=ua
    )
    return serialize_user(new_user, temp_password=temp_pass)


@users_router.get("/{id}", response_model=UserRead, summary="Obtener usuario por ID")
async def get_user(
    id: int,
    actor: User = Depends(require_permissions(Permission.USERS_READ)),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene un usuario por ID validando visibilidad según rol y hospital."""
    user = await UserService.get_user_by_id(db, actor, id)
    return serialize_user(user)


@users_router.patch("/{id}", response_model=UserRead, summary="Actualizar usuario")
async def update_user(
    id: int,
    request: Request,
    user_in: UserUpdate,
    actor: User = Depends(require_any_permission(Permission.USERS_MANAGE, Permission.USERS_MANAGE_TECHNICIANS)),
    db: AsyncSession = Depends(get_db)
):
    """Actualiza datos de un usuario."""
    ip, ua = get_request_context(request)
    updated = await UserService.update_user(
        db=db,
        actor=actor,
        user_id=id,
        user_in=user_in,
        ip=ip,
        user_agent=ua
    )
    return serialize_user(updated)


@users_router.post("/{id}/deactivate", response_model=UserRead, summary="Desactivar usuario")
async def deactivate_user(
    id: int,
    request: Request,
    actor: User = Depends(require_any_permission(Permission.USERS_MANAGE, Permission.USERS_MANAGE_TECHNICIANS)),
    db: AsyncSession = Depends(get_db)
):
    """Desactiva un usuario (baja lógica) e invalida inmediatamente sus sesiones."""
    ip, ua = get_request_context(request)
    user = await UserService.deactivate_user(db, actor, id, ip=ip, user_agent=ua)
    return serialize_user(user)


@users_router.post("/{id}/activate", response_model=UserRead, summary="Activar usuario")
async def activate_user(
    id: int,
    request: Request,
    actor: User = Depends(require_any_permission(Permission.USERS_MANAGE, Permission.USERS_MANAGE_TECHNICIANS)),
    db: AsyncSession = Depends(get_db)
):
    """Reactiva una cuenta de usuario previamente desactivada."""
    ip, ua = get_request_context(request)
    user = await UserService.activate_user(db, actor, id, ip=ip, user_agent=ua)
    return serialize_user(user)


@users_router.post("/{id}/reset-password", response_model=PasswordResetResponse, summary="Resetear contraseña")
async def reset_password(
    id: int,
    request: Request,
    actor: User = Depends(require_any_permission(Permission.USERS_MANAGE, Permission.USERS_MANAGE_TECHNICIANS)),
    db: AsyncSession = Depends(get_db)
):
    """Genera una contraseña temporal e invalida las sesiones activas del usuario."""
    ip, ua = get_request_context(request)
    temp_pass = await UserService.reset_password(db, actor, id, ip=ip, user_agent=ua)
    return PasswordResetResponse(temporary_password=temp_pass)


@users_router.post("/{id}/unlock", response_model=UserRead, summary="Desbloquear cuenta")
async def unlock_user(
    id: int,
    request: Request,
    actor: User = Depends(require_any_permission(Permission.USERS_MANAGE, Permission.USERS_MANAGE_TECHNICIANS)),
    db: AsyncSession = Depends(get_db)
):
    """Desbloquea una cuenta bloqueada por excesivos intentos fallidos."""
    ip, ua = get_request_context(request)
    user = await UserService.unlock_user(db, actor, id, ip=ip, user_agent=ua)
    return serialize_user(user)


@users_router.put("/{id}/hospitals", response_model=UserRead, summary="Actualizar asignación de hospitales")
async def update_user_hospitals(
    id: int,
    request: Request,
    payload: UserHospitalsUpdate,
    actor: User = Depends(require_any_permission(Permission.USERS_MANAGE, Permission.USERS_MANAGE_TECHNICIANS)),
    db: AsyncSession = Depends(get_db)
):
    """Asigna los hospitales en los que el usuario puede operar."""
    ip, ua = get_request_context(request)
    user = await UserService.update_user_hospitals(
        db,
        actor,
        id,
        hospital_ids=payload.hospital_ids,
        has_global_scope=payload.has_global_scope,
        ip=ip,
        user_agent=ua
    )
    return serialize_user(user)


@roles_router.get("", response_model=List[RoleRead], summary="Listar catálogo de roles y permisos")
async def list_roles(
    actor: User = Depends(require_permissions(Permission.USERS_READ))
):
    """Retorna la matriz de roles y sus permisos asociados para la interfaz de administración."""
    role_info = [
        RoleRead(
            role=UserRole.TECHNICIAN.value,
            name="Técnico de Campo",
            description="Ejecuta inspecciones, carga respuestas y fotos en inspecciones propias, consulta antecedentes cerrados.",
            permissions=[p.value for p in ROLE_PERMISSIONS[UserRole.TECHNICIAN]]
        ),
        RoleRead(
            role=UserRole.SUPERVISOR.value,
            name="Supervisor de Ingeniería Clínica",
            description="Supervisa inspecciones, resuelve alertas, gestiona plantillas y administra técnicos de sus hospitales.",
            permissions=[p.value for p in ROLE_PERMISSIONS[UserRole.SUPERVISOR]]
        ),
        RoleRead(
            role=UserRole.AUDITOR.value,
            name="Auditor Regulatorio / Calidad",
            description="Acceso de solo lectura estricto sobre inspecciones, historial, bitácora y alertas. Exporta reportes.",
            permissions=[p.value for p in ROLE_PERMISSIONS[UserRole.AUDITOR]]
        ),
        RoleRead(
            role=UserRole.ADMIN.value,
            name="Administrador de Sistemas",
            description="Control total sobre usuarios, roles, catálogo normativo y asignaciones globales.",
            permissions=[p.value for p in ROLE_PERMISSIONS[UserRole.ADMIN]]
        ),
    ]
    return role_info
