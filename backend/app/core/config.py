from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json
import os


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Protocolo de Inspección Digital de Gases Medicinales"

    # Database URLs
    DATABASE_URL: str = "sqlite+aiosqlite:///./gases_medicinales.db"
    SYNC_DATABASE_URL: str = "sqlite:///./gases_medicinales.db"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:3000",
        "*"
    ]

    # Object Storage (MinIO / S3 / Local fallback)
    STORAGE_BACKEND: str = "minio"  # "minio" | "s3" | "local"
    STORAGE_LOCAL_DIR: str = "./uploads/evidence"
    MINIO_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "gases-medicinales-evidence"
    MINIO_SECURE: bool = False

    S3_BUCKET_NAME: str = "gases-medicinales-evidence"
    S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    PRESIGNED_URL_EXPIRATION_SECONDS: int = 3600  # 1 hora para visualización clínica segura
    MAX_EVIDENCE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB
    ALLOWED_MIME_TYPES: List[str] = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "video/mp4",
        "video/quicktime",
    ]

    # OE-5: Notificaciones y Alertas
    ALERTS_ENABLED: bool = True
    ALERTS_SCHEDULER_ENABLED: bool = True
    ALERTS_SCHEDULER_INTERVAL_SECONDS: int = 300
    ALERTS_DISPATCH_SYNC: bool = False  # True en tests
    ALERTS_NOTIFY_CRITICAL_LIVE: bool = True
    ALERTS_DEFAULT_INSPECTION_INTERVAL_DAYS: int = 90
    ALERTS_DUE_SOON_DAYS: int = 7
    ALERTS_STALE_INSPECTION_HOURS: int = 48
    ALERTS_HYDRO_TEST_VALIDITY_YEARS: int = 5
    ALERTS_HYDRO_TEST_WARN_DAYS: int = 60
    ALERTS_RECURRENT_FAIL_THRESHOLD: int = 3
    ALERTS_RECURRENT_FAIL_WINDOW: int = 5
    ALERTS_MAX_SILENCE_HOURS: int = 72
    ALERTS_MAX_EXTERNAL_PER_HOUR: int = 30
    ALERTS_DIGEST_ENABLED: bool = False
    ALERTS_DIGEST_INTERVAL_MINUTES: int = 60
    FRONTEND_BASE_URL: str = "http://localhost:5173"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_FROM: str = "GMAO Gases Medicinales <no-reply@hospital.local>"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str):
            return json.loads(v)
        return v

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
