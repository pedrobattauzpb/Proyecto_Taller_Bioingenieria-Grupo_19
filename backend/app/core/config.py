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
