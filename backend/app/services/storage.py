import os
import uuid
import mimetypes
import logging
from typing import Tuple, Optional, BinaryIO
from pathlib import Path
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """
    Servicio desacoplado de almacenamiento de evidencia multimedia.
    Soporta MinIO (desarrollo local), AWS S3 (producción) y Local Disk (fallback seguro para testing offline).
    """

    def __init__(self):
        self.backend = settings.STORAGE_BACKEND.lower()
        self.local_dir = Path(settings.STORAGE_LOCAL_DIR)
        self.local_dir.mkdir(parents=True, exist_ok=True)

        self.s3_client = None
        self.bucket_name = (
            settings.MINIO_BUCKET_NAME if self.backend == "minio" else settings.S3_BUCKET_NAME
        )

        if self.backend in ("minio", "s3"):
            self._init_s3_client()

    def _init_s3_client(self):
        try:
            cfg = Config(
                signature_version="s3v4",
                connect_timeout=1,
                read_timeout=2,
                retries={"max_attempts": 1}
            )
            if self.backend == "minio":
                self.s3_client = boto3.client(
                    "s3",
                    endpoint_url=settings.MINIO_ENDPOINT,
                    aws_access_key_id=settings.MINIO_ACCESS_KEY,
                    aws_secret_access_key=settings.MINIO_SECRET_KEY,
                    config=cfg,
                    region_name="us-east-1",
                )
            elif self.backend == "s3":
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
                    region_name=settings.S3_REGION,
                    config=cfg,
                )
            else:
                self.s3_client = None
        except Exception as e:
            logger.warning(f"No se pudo inicializar cliente S3/MinIO ({e}). Se usará almacenamiento local de respaldo.")
            self.s3_client = None

    def _ensure_bucket(self):
        """Verifica o crea el bucket si no existe (particularmente útil en MinIO)"""
        if not self.s3_client or not self.bucket_name:
            return
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in ("404", "NoSuchBucket"):
                try:
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                    logger.info(f"Bucket '{self.bucket_name}' creado con éxito en {self.backend}.")
                except Exception as create_err:
                    logger.warning(f"No se pudo crear el bucket '{self.bucket_name}': {create_err}")
            else:
                logger.warning(f"Error verificando bucket '{self.bucket_name}': {e}")
        except Exception as e:
            logger.warning(f"No se pudo conectar a MinIO/S3 para verificar bucket: {e}. Desactivando cliente remoto.")
            self.s3_client = None

    def upload_file(
        self,
        file_obj: BinaryIO,
        filename: str,
        content_type: str,
        folder_prefix: str = "evidence",
    ) -> Tuple[str, int]:
        """
        Sube un archivo al almacenamiento configurado y retorna (storage_key, size_bytes).
        """
        import io
        ext = Path(filename).suffix
        unique_name = f"{uuid.uuid4().hex}{ext}"
        storage_key = f"{folder_prefix}/{unique_name}"

        # Leer contenido de forma segura para tener copia en memoria
        file_obj.seek(0)
        raw_bytes = file_obj.read()
        size_bytes = len(raw_bytes)

        uploaded_to_cloud = False
        if self.s3_client:
            try:
                self._ensure_bucket()
                if self.s3_client:
                    bio = io.BytesIO(raw_bytes)
                    self.s3_client.upload_fileobj(
                        Fileobj=bio,
                        Bucket=self.bucket_name,
                        Key=storage_key,
                        ExtraArgs={"ContentType": content_type},
                    )
                    uploaded_to_cloud = True
            except Exception as e:
                logger.warning(
                    f"Fallo al subir a {self.backend} ({e}). Desactivando cliente remoto y usando almacenamiento local como respaldo."
                )
                self.s3_client = None

        if not uploaded_to_cloud:
            # Fallback seguro: guardar en disco local
            local_path = self.local_dir / folder_prefix
            local_path.mkdir(parents=True, exist_ok=True)
            target_file = local_path / unique_name
            with open(target_file, "wb") as f:
                f.write(raw_bytes)

        return storage_key, size_bytes

    def get_presigned_url(
        self, storage_key: str, expires_in: Optional[int] = None
    ) -> str:
        """
        Genera una URL prefirmada temporal para visualización clínica segura.
        Si está en modo local o MinIO no responde, retorna la ruta de streaming de la API.
        """
        ttl = expires_in or settings.PRESIGNED_URL_EXPIRATION_SECONDS

        if self.s3_client:
            try:
                url = self.s3_client.generate_presigned_url(
                    ClientMethod="get_object",
                    Params={"Bucket": self.bucket_name, "Key": storage_key},
                    ExpiresIn=ttl,
                )
                return url
            except Exception as e:
                logger.warning(f"Error generando URL prefirmada en S3/MinIO: {e}")

        # Fallback para visualización local
        return f"{settings.API_V1_STR}/evidence/file/{storage_key}"

    def delete_file(self, storage_key: str) -> bool:
        """
        Elimina un archivo del storage.
        """
        deleted = False
        if self.s3_client:
            try:
                self.s3_client.delete_object(
                    Bucket=self.bucket_name,
                    Key=storage_key,
                )
                deleted = True
            except Exception as e:
                logger.warning(f"Error eliminando objeto de {self.backend}: {e}")

        # Intentar también eliminar local si existe
        local_target = self.local_dir / storage_key
        if local_target.exists():
            try:
                local_target.unlink()
                deleted = True
            except Exception as e:
                logger.warning(f"Error eliminando archivo local: {e}")

        return deleted


storage_service = StorageService()
