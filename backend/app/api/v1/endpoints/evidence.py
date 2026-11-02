import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.core.config import settings
from app.core.permissions import Permission
from app.core.security import verify_file_signature
from app.models.user import User
from app.models.evidence import InspectionEvidence
from app.models.inspection import Inspection, InspectionStatus
from app.models.compliance import AuditEventType
from app.schemas.evidence import InspectionEvidenceRead
from app.services.storage import storage_service
from app.services.access_control import assert_can_read_inspection, assert_can_delete_evidence
from app.services.auth_service import log_security_event
from app.api.deps import require_permissions, require_any_permission, get_request_context

router = APIRouter()


@router.get("/{id}", response_model=InspectionEvidenceRead, summary="Obtener detalle de evidencia")
async def get_evidence(
    id: int,
    user: User = Depends(require_permissions(Permission.EVIDENCE_READ)),
    db: AsyncSession = Depends(get_db)
):
    evidence = await db.get(
        InspectionEvidence,
        id,
        options=[joinedload(InspectionEvidence.inspection)]
    )
    if not evidence or not evidence.inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidencia con ID {id} no encontrada"
        )

    await assert_can_read_inspection(user, evidence.inspection, db)

    return InspectionEvidenceRead(
        id=evidence.id,
        inspection_id=evidence.inspection_id,
        item_id=evidence.item_id,
        file_type=evidence.file_type,
        storage_url=evidence.storage_url,
        presigned_url=storage_service.get_presigned_url(evidence.storage_url),
        file_size_bytes=evidence.file_size_bytes,
        uploaded_at=evidence.uploaded_at,
        uploaded_by=evidence.uploaded_by
    )


@router.delete("/{id}", summary="Eliminar evidencia multimedia de una inspección")
async def delete_evidence(
    id: int,
    request: Request,
    user: User = Depends(require_any_permission(Permission.EVIDENCE_DELETE_ALL, Permission.EVIDENCE_DELETE_OWN)),
    db: AsyncSession = Depends(get_db)
):
    """
    Elimina evidencia multimedia respetando reglas de propiedad y de inmutabilidad (no COMPLETED).
    """
    evidence = await db.get(
        InspectionEvidence,
        id,
        options=[joinedload(InspectionEvidence.inspection)]
    )
    if not evidence or not evidence.inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidencia con ID {id} no encontrada"
        )

    await assert_can_delete_evidence(user, evidence, evidence.inspection, db)

    ip, ua = get_request_context(request)
    inspection_id = evidence.inspection_id
    storage_url = evidence.storage_url

    # Eliminar archivo físico de MinIO / S3 / Local
    storage_service.delete_file(storage_url)

    # Eliminar registro en base de datos
    await db.delete(evidence)

    # Registrar evento de auditoría
    await log_security_event(
        db=db,
        event_type=AuditEventType.EVIDENCE_DELETED,
        user=user,
        ip=ip,
        user_agent=ua,
        detail={
            "evidence_id": id,
            "inspection_id": inspection_id,
            "storage_url": storage_url
        }
    )
    await db.commit()

    return {
        "success": True,
        "detail": f"Evidencia {id} eliminada exitosamente",
        "id": id,
        "deleted_id": id
    }


@router.get("/file/{file_path:path}", summary="Visualización segura de archivo local firmada con HMAC")
async def get_local_evidence_file(
    file_path: str,
    exp: Optional[int] = Query(None, description="Timestamp de expiración de la firma"),
    sig: Optional[str] = Query(None, description="Firma HMAC-SHA256")
):
    """
    Permite acceder a los archivos guardados localmente.
    Exige una firma HMAC-SHA256 válida y no vencida (?exp=...&sig=...).
    """
    if exp is None or not sig:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: se requiere URL firmada con firma HMAC y expiración"
        )

    if not verify_file_signature(file_path, exp, sig):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Firma de archivo inválida o expirada"
        )

    safe_dir = Path(settings.STORAGE_LOCAL_DIR).resolve()
    target = (safe_dir / file_path).resolve()

    # Prevenir Path Traversal
    if not str(target).startswith(str(safe_dir)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")

    return FileResponse(path=target)
