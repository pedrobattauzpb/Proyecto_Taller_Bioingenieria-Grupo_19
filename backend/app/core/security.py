import hmac
import hashlib
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Any, Dict
import jwt
from pwdlib import PasswordHash
from app.core.config import settings

_password_hash = PasswordHash.recommended()

COMMON_PASSWORDS = {
    "password", "password123", "12345678", "123456789", "1234567890",
    "admin123", "admin1234", "admin12345", "hospital123", "gmao2026",
    "qwerty1234", "letmein123"
}


def hash_password(password: str) -> str:
    """Hashea una contraseña usando Argon2id."""
    return _password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña coincide con el hash Argon2id."""
    try:
        return _password_hash.verify(plain_password, hashed_password)
    except Exception:
        return False


def verify_and_update_password(plain_password: str, hashed_password: str) -> Tuple[bool, Optional[str]]:
    """Verifica la contraseña y devuelve si necesita rehasheo."""
    try:
        valid, updated_hash = _password_hash.verify_and_update(plain_password, hashed_password)
        return valid, updated_hash
    except Exception:
        return False, None


def validate_password_policy(password: str, email: str = "") -> Tuple[bool, str]:
    """
    Valida los requisitos de política de contraseñas:
    - Longitud mínima (>= 10 caracteres)
    - Al menos una letra y un número
    - Distinta del email
    - No estar en lista de contraseñas comunes
    """
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        return False, f"La contraseña debe tener al menos {settings.PASSWORD_MIN_LENGTH} caracteres"
    if not any(c.isalpha() for c in password):
        return False, "La contraseña debe contener al menos una letra"
    if not any(c.isdigit() for c in password):
        return False, "La contraseña debe contener al menos un número"
    if email and email.lower() in password.lower():
        return False, "La contraseña no puede contener el correo electrónico"
    if password.lower() in COMMON_PASSWORDS:
        return False, "La contraseña es demasiado común o insegura"
    return True, ""


def create_access_token(user: Any, expires_delta: Optional[timedelta] = None) -> str:
    """Genera un JWT de acceso de corta duración (30 min)."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "tv": user.token_version,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_sse_ticket(user: Any) -> str:
    """Genera un ticket JWT temporal (60s) para conexión EventSource (SSE)."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(seconds=settings.SSE_TICKET_EXPIRE_SECONDS)

    payload = {
        "sub": str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "tv": user.token_version,
        "type": "sse",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decodifica y valida la firma y vigencia de un JWT."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_refresh_token() -> str:
    """Genera un token opaco aleatorio seguro de 48 bytes URL-safe."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """Calcula el SHA-256 de un token opaco para guardarlo en la base."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def sign_file_url(path: str, exp: Optional[int] = None) -> str:
    """
    Firma una URL de archivo local con HMAC-SHA256 y vencimiento (default 15 min).
    Devuelve los parámetros de consulta `?exp=...&sig=...`.
    """
    if exp is None:
        exp = int(time.time()) + settings.FILE_URL_EXPIRE_SECONDS

    message = f"{path}:{exp}".encode("utf-8")
    sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return f"?exp={exp}&sig={sig}"


def verify_file_signature(path: str, exp: int, sig: str) -> bool:
    """Verifica si la firma HMAC del archivo es válida y no ha vencido."""
    now = int(time.time())
    if exp < now:
        return False

    message = f"{path}:{exp}".encode("utf-8")
    expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected_sig)
