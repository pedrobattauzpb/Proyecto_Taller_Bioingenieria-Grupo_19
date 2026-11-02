import secrets
from datetime import datetime
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.user import User, UserRole, RefreshToken
from app.models.hierarchy import Hospital
from app.models.compliance import AuditEventType
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import hash_password, validate_password_policy
from app.services.auth_service import log_security_event, AuthService
from app.services.access_control import get_user_hospital_ids, scope_filter_hospital_ids


def generate_temp_password() -> str:
    """Genera una contraseña temporal segura que cumple la política."""
    base = secrets.token_urlsafe(8)
    return f"{base}Aa1!"


class UserService:

    @staticmethod
    def _assert_supervisor_target_allowed(actor: User, target: User):
        """
        Valida que un Supervisor solo opere sobre TÉCNICOS pertenecientes
        exclusivamente a sus hospitales asignados (Regla D13 / §6.4 punto 10).
        """
        if actor.role == UserRole.ADMIN:
            return

        if actor.role == UserRole.SUPERVISOR:
            if target.role != UserRole.TECHNICIAN:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Los supervisores solo pueden administrar usuarios con rol Técnico"
                )

            supervisor_h_ids = get_user_hospital_ids(actor)
            target_h_ids = get_user_hospital_ids(target)

            if target.has_global_scope:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tiene permisos sobre un usuario con alcance global"
                )

            if not target_h_ids or not target_h_ids.issubset(supervisor_h_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="El técnico pertenece a hospitales fuera de su alcance de supervisión"
                )
            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes para administrar usuarios"
        )

    @classmethod
    async def list_users(
        cls,
        db: AsyncSession,
        actor: User,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
        q: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[User]:
        """Lista usuarios respetando el alcance del actor."""
        stmt = select(User).options(selectinload(User.hospitals)).order_by(User.id.desc())

        if actor.role == UserRole.SUPERVISOR:
            # El supervisor solo ve técnicos de sus hospitales
            supervisor_h_ids = list(get_user_hospital_ids(actor))
            stmt = stmt.join(User.hospitals).where(
                Hospital.id.in_(supervisor_h_ids),
                User.role == UserRole.TECHNICIAN
            ).distinct()

        if role:
            stmt = stmt.where(User.role == role)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
        if q:
            search = f"%{q}%"
            stmt = stmt.where((User.full_name.ilike(search)) | (User.email.ilike(search)))

        stmt = stmt.limit(limit).offset(offset)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @classmethod
    async def get_user_by_id(cls, db: AsyncSession, actor: User, user_id: int) -> User:
        """Obtiene un usuario por ID validando visibilidad."""
        stmt = select(User).options(selectinload(User.hospitals)).where(User.id == user_id)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

        if actor.role == UserRole.SUPERVISOR:
            cls._assert_supervisor_target_allowed(actor, user)

        return user

    @classmethod
    async def create_user(
        cls,
        db: AsyncSession,
        actor: User,
        user_in: UserCreate,
        ip: str = "",
        user_agent: str = ""
    ) -> Tuple[User, str]:
        """Crea un usuario nuevo aplicando restricciones de rol y alcance."""
        clean_email = user_in.email.lower().strip()

        # Validaciones de Supervisor
        if actor.role == UserRole.SUPERVISOR:
            if user_in.role != UserRole.TECHNICIAN:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Los supervisores solo pueden dar de alta cuentas de Técnicos"
                )
            if user_in.has_global_scope:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Un supervisor no puede otorgar alcance global"
                )
            supervisor_h_ids = get_user_hospital_ids(actor)
            if not user_in.hospital_ids or not set(user_in.hospital_ids).issubset(supervisor_h_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo puede asignar hospitales dentro de su propio alcance"
                )

        # Verificar unicidad de email
        stmt = select(User).where(User.email == clean_email)
        res = await db.execute(stmt)
        if res.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo electrónico ya se encuentra registrado")

        # Contraseña
        if user_in.password:
            valid, err = validate_password_policy(user_in.password, clean_email)
            if not valid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
            temp_pass = user_in.password
            must_change = False
        else:
            temp_pass = generate_temp_password()
            must_change = True

        hashed = hash_password(temp_pass)
        now = datetime.utcnow()

        new_user = User(
            email=clean_email,
            full_name=user_in.full_name.strip(),
            professional_license=user_in.professional_license.strip() if user_in.professional_license else None,
            role=user_in.role,
            hashed_password=hashed,
            is_active=True,
            has_global_scope=user_in.has_global_scope if actor.role == UserRole.ADMIN else False,
            must_change_password=must_change,
            created_at=now,
            updated_at=now,
            created_by_id=actor.id
        )

        # Asignar hospitales
        if user_in.hospital_ids:
            h_stmt = select(Hospital).where(Hospital.id.in_(user_in.hospital_ids))
            h_res = await db.execute(h_stmt)
            new_user.hospitals = list(h_res.scalars().all())

        db.add(new_user)
        await db.flush()

        await log_security_event(
            db=db,
            event_type=AuditEventType.USER_CREATED,
            user=actor,
            ip=ip,
            user_agent=user_agent,
            detail={
                "created_user_id": new_user.id,
                "created_user_email": new_user.email,
                "created_user_role": new_user.role.value,
                "assigned_hospitals": [h.id for h in new_user.hospitals]
            }
        )
        await db.commit()
        await db.refresh(new_user)

        return new_user, temp_pass

    @classmethod
    async def update_user(
        cls,
        db: AsyncSession,
        actor: User,
        user_id: int,
        user_in: UserUpdate,
        ip: str = "",
        user_agent: str = ""
    ) -> User:
        """Actualiza campos de un usuario respetando las reglas de rol y admin."""
        target = await cls.get_user_by_id(db, actor, user_id)

        # Reglas de protección de ADMIN (Regla 6)
        if target.id == actor.id and user_in.is_active is False:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Un Administrador no puede desactivar su propia cuenta")

        if target.id == actor.id and user_in.role is not None and user_in.role != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Un Administrador no puede removerse a sí mismo el rol de Administrador")

        if user_in.is_active is False and target.role == UserRole.ADMIN:
            count_stmt = select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
            count_res = await db.execute(count_stmt)
            if (count_res.scalar() or 0) <= 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede desactivar al único Administrador activo del sistema")

        if user_in.role is not None and target.role == UserRole.ADMIN and user_in.role != UserRole.ADMIN:
            count_stmt = select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
            count_res = await db.execute(count_stmt)
            if (count_res.scalar() or 0) <= 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede degradar al único Administrador activo del sistema")

        # Reglas de Supervisor
        if actor.role == UserRole.SUPERVISOR:
            if user_in.role is not None and user_in.role != target.role:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el Administrador puede modificar roles de usuario")
            if user_in.has_global_scope is True:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puede otorgar alcance global")
            if user_in.hospital_ids is not None:
                sup_h_ids = get_user_hospital_ids(actor)
                if not set(user_in.hospital_ids).issubset(sup_h_ids):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo puede asignar hospitales dentro de su propio alcance")

        now = datetime.utcnow()
        sessions_need_invalidation = False

        if user_in.full_name is not None:
            target.full_name = user_in.full_name.strip()
        if user_in.professional_license is not None:
            target.professional_license = user_in.professional_license.strip() if user_in.professional_license else None

        if user_in.role is not None and user_in.role != target.role:
            old_role = target.role.value
            target.role = user_in.role
            sessions_need_invalidation = True
            await log_security_event(
                db=db,
                event_type=AuditEventType.USER_ROLE_CHANGED,
                user=actor,
                ip=ip,
                user_agent=user_agent,
                detail={"target_user_id": target.id, "old_role": old_role, "new_role": target.role.value}
            )

        if user_in.is_active is not None and user_in.is_active != target.is_active:
            target.is_active = user_in.is_active
            if not target.is_active:
                sessions_need_invalidation = True
                await log_security_event(
                    db=db,
                    event_type=AuditEventType.USER_DEACTIVATED,
                    user=actor,
                    ip=ip,
                    user_agent=user_agent,
                    detail={"target_user_id": target.id}
                )
            else:
                await log_security_event(
                    db=db,
                    event_type=AuditEventType.USER_ACTIVATED,
                    user=actor,
                    ip=ip,
                    user_agent=user_agent,
                    detail={"target_user_id": target.id}
                )

        if user_in.has_global_scope is not None and actor.role == UserRole.ADMIN:
            target.has_global_scope = user_in.has_global_scope

        if user_in.hospital_ids is not None:
            h_stmt = select(Hospital).where(Hospital.id.in_(user_in.hospital_ids))
            h_res = await db.execute(h_stmt)
            target.hospitals = list(h_res.scalars().all())
            await log_security_event(
                db=db,
                event_type=AuditEventType.USER_SCOPE_CHANGED,
                user=actor,
                ip=ip,
                user_agent=user_agent,
                detail={"target_user_id": target.id, "hospital_ids": user_in.hospital_ids}
            )

        target.updated_at = now

        if sessions_need_invalidation:
            await AuthService.revoke_all_user_sessions(db, target)

        await log_security_event(
            db=db,
            event_type=AuditEventType.USER_UPDATED,
            user=actor,
            ip=ip,
            user_agent=user_agent,
            detail={"target_user_id": target.id}
        )
        await db.commit()
        await db.refresh(target)
        return target

    @classmethod
    async def deactivate_user(cls, db: AsyncSession, actor: User, user_id: int, ip: str = "", user_agent: str = "") -> User:
        return await cls.update_user(db, actor, user_id, UserUpdate(is_active=False), ip, user_agent)

    @classmethod
    async def activate_user(cls, db: AsyncSession, actor: User, user_id: int, ip: str = "", user_agent: str = "") -> User:
        return await cls.update_user(db, actor, user_id, UserUpdate(is_active=True), ip, user_agent)

    @classmethod
    async def reset_password(cls, db: AsyncSession, actor: User, user_id: int, ip: str = "", user_agent: str = "") -> str:
        """Resetea la contraseña de un usuario a una temporal y revoca sesiones activas."""
        target = await cls.get_user_by_id(db, actor, user_id)

        temp_password = generate_temp_password()
        now = datetime.utcnow()

        target.hashed_password = hash_password(temp_password)
        target.must_change_password = True
        target.failed_login_attempts = 0
        target.locked_until = None
        target.updated_at = now

        await AuthService.revoke_all_user_sessions(db, target)

        await log_security_event(
            db=db,
            event_type=AuditEventType.PASSWORD_RESET,
            user=actor,
            ip=ip,
            user_agent=user_agent,
            detail={"target_user_id": target.id, "target_email": target.email}
        )
        await db.commit()
        return temp_password

    @classmethod
    async def unlock_user(cls, db: AsyncSession, actor: User, user_id: int, ip: str = "", user_agent: str = "") -> User:
        """Desbloquea una cuenta bloqueada por intentos fallidos."""
        target = await cls.get_user_by_id(db, actor, user_id)
        target.failed_login_attempts = 0
        target.locked_until = None
        target.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(target)
        return target

    @classmethod
    async def update_user_hospitals(
        cls,
        db: AsyncSession,
        actor: User,
        user_id: int,
        hospital_ids: List[int],
        has_global_scope: bool,
        ip: str = "",
        user_agent: str = ""
    ) -> User:
        return await cls.update_user(
            db,
            actor,
            user_id,
            UserUpdate(hospital_ids=hospital_ids, has_global_scope=has_global_scope),
            ip,
            user_agent
        )
