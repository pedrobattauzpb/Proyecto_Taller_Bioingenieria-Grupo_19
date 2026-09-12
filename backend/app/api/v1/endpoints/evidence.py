import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from app.core.database import get_db
from app.core.config import settings
from app.models.evidence import InspectionEvidence
from app.models.inspection import Inspection, InspectionStatus
from app.schemas.evidence import InspectionEvidenceRead
from app.services.storage import storage_service

router = APIRouter()


@router.get("/{id}", response_model=InspectionEvidenceRead, summary="Obtener detalle de evidencia")
async def get_evidence(id: int, db: AsyncSession = Depends(get_db)):
    evidence = await db.get(InspectionEvidence, id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidencia con ID {id} no encontrada"
        )
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
async def delete_evidence(id: int, db: AsyncSession = Depends(get_db)):
    """
    Elimina evidencia multimedia, **solo si la inspección padre sigue en DRAFT o IN_PROGRESS**.
    Rechaza con HTTP 400 si la inspección ya fue completada y cerrada.
    """
    evidence = await db.get(
        InspectionEvidence,
        id,
        options=[joinedload(InspectionEvidence.inspection)]
    )
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidencia con ID {id} no encontrada"
        )

    # Regla de integridad médica: Una inspección completada queda bloqueada y auditada
    if evidence.inspection and evidence.inspection.status == InspectionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar evidencia de una inspección ya completada y cerrada."
        )

    # Eliminar archivo físico de MinIO / S3 / Local
    storage_service.delete_file(evidence.storage_url)

    # Eliminar registro en base de datos
    await db.delete(evidence)
    await db.commit()

    return {
        "success": True,
        "detail": f"Evidencia {id} eliminada exitosamente",
        "id": id,
        "deleted_id": id
    }


@router.get("/file/{file_path:path}", summary="Visualización segura de archivo local (fallback)")
async def get_local_evidence_file(file_path: str):
    """
    Permite acceder a los archivos guardados localmente cuando no se dispone de un servidor MinIO o S3.
    """
    safe_dir = Path(settings.STORAGE_LOCAL_DIR).resolve()
    target = (safe_dir / file_path).resolve()

    # Prevenir Path Traversal
    if not str(target).startswith(str(safe_dir)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")

    return FileResponse(path=target)
