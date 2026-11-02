import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any, List
from collections import defaultdict
from fastapi import HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    verify_and_update_password,
    validate_password_policy,
    create_access_token,
    generate_refresh_token,
    hash_token,
)
from app.core.database import AsyncSessionLocal
from app.models.user import User, RefreshToken, UserRole
from app.models.compliance import AuditLog, AuditEventType
from app.schemas.auth import TokenPair


# Rate limit in memory: IP -> list of timestamps
_login_rate_limits: Dict[str, List[float]] = defaultdict(list)


def check_rate_limit(ip: str):
    """Límite de intentos por minuto por IP para login/refresh."""
    if (ip in ("testclient", "test", "127.0.0.1", "localhost") and settings.ENVIRONMENT != "production") or settings.ENVIRONMENT == "test":
        return
    now = time.time()
    cutoff = now - 60.0
    # Limpiar viejos
    _login_rate_limits[ip] = [t for t in _login_rate_limits[ip] if t > cutoff]
    if len(_login_rate_limits[ip]) >= settings.AUTH_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiadas solicitudes de autenticación. Intente nuevamente en un minuto."
        )
    _login_rate_limits[ip].append(now)


def sanitize_audit_detail(detail: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Elimina campos sensibles (password, token, etc.) de los detalles del log."""
    if not detail:
        return {}
    sanitized = {}
    sensitive_keys = {"password", "token", "refresh_token", "current_password", "new_password", "secret"}
    for k, v in detail.items():
        if any(sens in k.lower() for sens in sensitive_keys):
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_audit_detail(v)
        else:
            sanitized[k] = v
    return sanitized


async def log_security_event(
    db: Optional[AsyncSession],
    event_type: AuditEventType,
    user: Optional[User] = None,
    ip: str = "",
    user_agent: str = "",
    detail: Optional[Dict[str, Any]] = None,
    actor_snapshot: Optional[str] = None,
    isolated_session: bool = False
):
    """
    Registra un evento de seguridad en audit_logs de forma inmutable.
    Si isolated_session es True, abre una sesión independiente para asegurar el commit
    incluso ante excepciones HTTP (como 403 Forbidden o 401).
    """
    sanitized_detail = sanitize_audit_detail(detail)

    if actor_snapshot:
        actor_str = actor_snapshot
    elif user:
        lic = f" (Mat. {user.professional_license})" if user.professional_license else ""
        actor_str = f"{user.full_name}{lic} <{user.email}>"
    else:
        actor_str = "SYSTEM"

    user_id = user.id if user else None

    async def _insert(session: AsyncSession):
        log_entry = AuditLog(
            inspection_id=None,
            event_type=event_type,
            event_detail=sanitized_detail,
            actor=actor_str,
            actor_user_id=user_id,
            ip_address=ip[:45] if ip else None,
            user_agent=user_agent[:255] if user_agent else None,
            created_at=datetime.utcnow()
        )
        session.add(log_entry)
        await session.commit()

    if isolated_session or db is None:
        async with AsyncSessionLocal() as session:
            await _insert(session)
    else:
        log_entry = AuditLog(
            inspection_id=None,
            event_type=event_type,
            event_detail=sanitized_detail,
            actor=actor_str,
            actor_user_id=user_id,
            ip_address=ip[:45] if ip else None,
            user_agent=user_agent[:255] if user_agent else None,
            created_at=datetime.utcnow()
        )
        db.add(log_entry)
        await db.flush()


class AuthService:

    @staticmethod
    async def authenticate(
        db: AsyncSession,
        email: str,
        password: str,
        ip: str = "",
        user_agent: str = ""
    ) -> User:
        """
        Autentica credenciales con protección contra enumeración de usuarios
        y bloqueo de cuenta tras intentos fallidos.
        """
        check_rate_limit(ip)
        clean_email = email.lower().strip()

        stmt = select(User).options(selectinload(User.hospitals)).where(User.email == clean_email)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()

        # Si el usuario no existe, ejecutamos un hash ficticio para mitigar timing attack
        if not user:
            verify_password(password, "$argon2id$v=19$m=65536,t=3,p=4$SaeDaUcTxWMIUkL5/u67MA$ARZg+E8iie+eqyfJyCO6AFA/eiiCXVWU3AblyPTTvqs")
            await log_security_event(
                db=None,
                event_type=AuditEventType.LOGIN_FAILED,
                actor_snapshot=f"ANONYMOUS <{clean_email}>",
                ip=ip,
                user_agent=user_agent,
                detail={"reason": "user_not_found"},
                isolated_session=True
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

        now = datetime.utcnow()

        # Verificar bloqueo de cuenta
        if user.locked_until and user.locked_until > now:
            await log_security_event(
                db=None,
                event_type=AuditEventType.LOGIN_FAILED,
                user=user,
                ip=ip,
                user_agent=user_agent,
                detail={"reason": "account_locked", "locked_until": user.locked_until.isoformat()},
                isolated_session=True
            )
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Cuenta temporalmente bloqueada por reiterados fallos. Intente nuevamente a las {user.locked_until.strftime('%H:%M:%S')} UTC."
            )

        # Verificar si está activo
        if not user.is_active:
            await log_security_event(
                db=None,
                event_type=AuditEventType.LOGIN_FAILED,
                user=user,
                ip=ip,
                user_agent=user_agent,
                detail={"reason": "user_inactive"},
                isolated_session=True
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo")

        # Verificar contraseña
        valid, updated_hash = verify_and_update_password(password, user.hashed_password)
        if not valid:
            user.failed_login_attempts += 1
            is_locked = False
            if user.failed_login_attempts >= settings.AUTH_MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=settings.AUTH_LOCKOUT_MINUTES)
                is_locked = True
                await log_security_event(
                    db=None,
                    event_type=AuditEventType.ACCOUNT_LOCKED,
                    user=user,
                    ip=ip,
                    user_agent=user_agent,
                    detail={"attempts": user.failed_login_attempts, "locked_until": user.locked_until.isoformat()},
                    isolated_session=True
                )

            await log_security_event(
                db=None,
                event_type=AuditEventType.LOGIN_FAILED,
                user=user,
                ip=ip,
                user_agent=user_agent,
                detail={"reason": "invalid_password", "failed_attempts": user.failed_login_attempts},
                isolated_session=True
            )
            await db.commit()

            if is_locked:
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"Cuenta bloqueada por {settings.AUTH_LOCKOUT_MINUTES} minutos debido a múltiples intentos fallidos."
                )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

        # Login exitoso
        if updated_hash:
            user.hashed_password = updated_hash
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now

        await log_security_event(
            db=db,
            event_type=AuditEventType.LOGIN_SUCCESS,
            user=user,
            ip=ip,
            user_agent=user_agent,
            detail={"role": user.role.value}
        )
        await db.commit()
        return user

    @staticmethod
    async def issue_token_pair(
        db: AsyncSession,
        user: User,
        ip: str = "",
        user_agent: str = "",
        family_id: Optional[str] = None
    ) -> TokenPair:
        """Emite un par de tokens (JWT de acceso y refresh token opaco con hash)."""
        access_token = create_access_token(user)
        raw_refresh = generate_refresh_token()
        hashed = hash_token(raw_refresh)

        if not family_id:
            family_id = str(uuid.uuid4())

        now = datetime.utcnow()
        refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=hashed,
            family_id=family_id,
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            created_at=now,
            ip_address=ip[:45] if ip else None,
            user_agent=user_agent[:255] if user_agent else None
        )
        db.add(refresh_record)
        await db.commit()

        return TokenPair(
            access_token=access_token,
            refresh_token=raw_refresh,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    @staticmethod
    async def rotate_refresh_token(
        db: AsyncSession,
        raw_refresh_token: str,
        ip: str = "",
        user_agent: str = ""
    ) -> Tuple[TokenPair, User]:
        """
        Rota el refresh token con detección estricta de reutilización (D4).
        Si se detecta reutilización de un token revocado, se revoca toda la familia
        y se incrementa token_version para invalidar las sesiones activas.
        """
        check_rate_limit(ip)
        hashed = hash_token(raw_refresh_token)

        stmt = select(RefreshToken).where(RefreshToken.token_hash == hashed)
        res = await db.execute(stmt)
        token_record = res.scalar_one_or_none()

        if not token_record:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")

        now = datetime.utcnow()

        # Detección de reutilización
        if token_record.revoked_at is not None:
            # Revocar toda la familia
            fam_stmt = select(RefreshToken).where(
                RefreshToken.family_id == token_record.family_id,
                RefreshToken.revoked_at.is_(None)
            )
            fam_res = await db.execute(fam_stmt)
            for t in fam_res.scalars():
                t.revoked_at = now

            # Invalidar tokens del usuario
            user_stmt = select(User).where(User.id == token_record.user_id)
            user_res = await db.execute(user_stmt)
            user = user_res.scalar_one_or_none()
            if user:
                user.token_version += 1
                await log_security_event(
                    db=db,
                    event_type=AuditEventType.TOKEN_REFRESH_REUSE_DETECTED,
                    user=user,
                    ip=ip,
                    user_agent=user_agent,
                    detail={"family_id": token_record.family_id, "compromised_token_id": token_record.id}
                )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Se detectó reutilización de refresh token. Todas las sesiones activas han sido revocadas por seguridad."
            )

        # Verificar expiración
        if token_record.expires_at < now:
            token_record.revoked_at = now
            await db.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token vencido")

        # Cargar usuario activo
        user_stmt = select(User).options(selectinload(User.hospitals)).where(User.id == token_record.user_id)
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario inactivo o inexistente")

        # Revocar el token actual
        token_record.revoked_at = now

        # Emitir nuevo refresh token en la misma familia
        new_raw_refresh = generate_refresh_token()
        new_hashed = hash_token(new_raw_refresh)

        new_refresh_record = RefreshToken(
            user_id=user.id,
            token_hash=new_hashed,
            family_id=token_record.family_id,
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            created_at=now,
            ip_address=ip[:45] if ip else None,
            user_agent=user_agent[:255] if user_agent else None
        )
        db.add(new_refresh_record)
        await db.flush()

        token_record.replaced_by_id = new_refresh_record.id
        await db.commit()

        new_access = create_access_token(user)
        return TokenPair(
            access_token=new_access,
            refresh_token=new_raw_refresh,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        ), user

    @staticmethod
    async def logout(
        db: AsyncSession,
        raw_refresh_token: str,
        user: Optional[User] = None,
        ip: str = "",
        user_agent: str = ""
    ):
        """Revoca la familia del refresh token."""
        hashed = hash_token(raw_refresh_token)
        stmt = select(RefreshToken).where(RefreshToken.token_hash == hashed)
        res = await db.execute(stmt)
        token_record = res.scalar_one_or_none()

        now = datetime.utcnow()
        if token_record:
            fam_stmt = select(RefreshToken).where(
                RefreshToken.family_id == token_record.family_id,
                RefreshToken.revoked_at.is_(None)
            )
            fam_res = await db.execute(fam_stmt)
            for t in fam_res.scalars():
                t.revoked_at = now

        if user:
            await log_security_event(
                db=db,
                event_type=AuditEventType.LOGOUT,
                user=user,
                ip=ip,
                user_agent=user_agent
            )
        await db.commit()

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user: User,
        current_password: str,
        new_password: str,
        ip: str = "",
        user_agent: str = ""
    ):
        """Cambia la contraseña del usuario autenticado y revoca sesiones previas."""
        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual es incorrecta")

        valid, error_msg = validate_password_policy(new_password, user.email)
        if not valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

        now = datetime.utcnow()
        user.hashed_password = hash_password(new_password)
        user.must_change_password = False
        user.password_changed_at = now
        user.token_version += 1  # Invalida JWTs de acceso previos

        # Revocar todos los refresh tokens
        stmt = select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        res = await db.execute(stmt)
        for t in res.scalars():
            t.revoked_at = now

        await log_security_event(
            db=db,
            event_type=AuditEventType.PASSWORD_CHANGED,
            user=user,
            ip=ip,
            user_agent=user_agent
        )
        await db.commit()

    @staticmethod
    async def revoke_all_user_sessions(db: AsyncSession, user: User):
        """Invalida todas las sesiones de un usuario (cambio de rol, baja, reset)."""
        now = datetime.utcnow()
        user.token_version += 1
        stmt = select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        res = await db.execute(stmt)
        for t in res.scalars():
            t.revoked_at = now
        await db.commit()
