from typing import List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User, UserRole
from app.models.inspection import Inspection, InspectionStatus
from app.models.evidence import InspectionEvidence
from app.models.hierarchy import Asset, Sector
from app.core.permissions import Permission, ROLE_PERMISSIONS


def get_user_hospital_ids(user: User) -> Set[int]:
    """Retorna el conjunto de IDs de hospitales asignados al usuario."""
    if hasattr(user, "hospitals") and user.hospitals:
        return {h.id for h in user.hospitals}
    return set()


def scope_filter_hospital_ids(user: User) -> Optional[List[int]]:
    """
    Retorna la lista de hospital_ids permitidos para filtrar consultas.
    Si el usuario tiene alcance global o es ADMIN, retorna None (sin restricción).
    """
    if getattr(user, "has_global_scope", False) or user.role == UserRole.ADMIN:
        return None
    return list(get_user_hospital_ids(user))


def assert_hospital_in_scope(user: User, hospital_id: int):
    """Lanza 404 si el hospital no se encuentra en el alcance del usuario."""
    allowed = scope_filter_hospital_ids(user)
    if allowed is not None and hospital_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hospital no encontrado o fuera de su alcance"
        )


async def get_inspection_hospital_id(inspection: Inspection, db: AsyncSession) -> Optional[int]:
    """Obtiene el hospital_id asociado a la inspección a través de Asset -> Sector."""
    if inspection.asset and inspection.asset.sector:
        return inspection.asset.sector.hospital_id

    # Si no están precargadas las relaciones, consultamos
    stmt = (
        select(Sector.hospital_id)
        .join(Asset, Asset.sector_id == Sector.id)
        .where(Asset.id == inspection.asset_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def assert_can_read_inspection(user: User, inspection: Inspection, db: AsyncSession):
    """
    Regla D11 / §6.4 (11):
    - Debe estar dentro del alcance de hospitales del usuario (si no -> 404).
    - Si tiene `inspections:read_all` (ADMIN, SUPERVISOR, AUDITOR) -> permitido.
    - Si es TECHNICIAN:
      - Si es propia (`inspector_id == user.id`) -> permitido.
      - Si está COMPLETED -> permitido (read_completed).
      - Si está abierta y ajena -> 404 (para no revelar su existencia).
    """
    h_id = await get_inspection_hospital_id(inspection, db)
    if h_id is not None:
        allowed = scope_filter_hospital_ids(user)
        if allowed is not None and h_id not in allowed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspección no encontrada")

    perms = ROLE_PERMISSIONS.get(user.role, frozenset())
    if Permission.INSPECTIONS_READ_ALL in perms:
        return

    # Caso Technician o sin read_all
    if inspection.inspector_id == user.id:
        return

    if inspection.status == InspectionStatus.COMPLETED and Permission.INSPECTIONS_READ_COMPLETED in perms:
        return

    # Inspección abierta ajena o fuera de visibilidad: 404 estricto
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspección no encontrada")


async def assert_can_execute_inspection(user: User, inspection: Inspection, db: AsyncSession):
    """
    Regla para cargar respuestas y evidencias:
    - Inmutabilidad: si está COMPLETED -> 400.
    - Alcance de hospital (si no -> 404).
    - execute_all (ADMIN, SUPERVISOR) -> permitido.
    - execute_own (TECHNICIAN) -> solo si inspection.inspector_id == user.id.
    """
    if inspection.status == InspectionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pueden modificar datos en una inspección completada y cerrada (Regla de Inmutabilidad)"
        )

    h_id = await get_inspection_hospital_id(inspection, db)
    if h_id is not None:
        allowed = scope_filter_hospital_ids(user)
        if allowed is not None and h_id not in allowed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspección no encontrada")

    perms = ROLE_PERMISSIONS.get(user.role, frozenset())
    if Permission.INSPECTIONS_EXECUTE_ALL in perms:
        return

    if Permission.INSPECTIONS_EXECUTE_OWN in perms:
        if inspection.inspector_id == user.id:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para modificar una inspección de otro inspector"
        )

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")


async def assert_can_complete_inspection(user: User, inspection: Inspection, db: AsyncSession):
    """
    Regla para completar y firmar inspección:
    - Inmutabilidad: si ya está COMPLETED -> 400.
    - complete_all (ADMIN, SUPERVISOR) -> permitido.
    - complete_own (TECHNICIAN) -> solo si inspection.inspector_id == user.id.
    """
    if inspection.status == InspectionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La inspección ya se encuentra cerrada y firmada"
        )

    h_id = await get_inspection_hospital_id(inspection, db)
    if h_id is not None:
        allowed = scope_filter_hospital_ids(user)
        if allowed is not None and h_id not in allowed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspección no encontrada")

    perms = ROLE_PERMISSIONS.get(user.role, frozenset())
    if Permission.INSPECTIONS_COMPLETE_ALL in perms:
        return

    if Permission.INSPECTIONS_COMPLETE_OWN in perms:
        if inspection.inspector_id == user.id:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para cerrar una inspección iniciada por otro técnico"
        )

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")


async def assert_can_delete_evidence(
    user: User,
    evidence: InspectionEvidence,
    inspection: Inspection,
    db: AsyncSession
):
    """
    Regla para borrar evidencia:
    - Inmutabilidad: si la inspección está COMPLETED -> 400.
    - delete_all (ADMIN, SUPERVISOR) -> permitido.
    - delete_own (TECHNICIAN) -> solo si evidence.uploaded_by_id == user.id o inspection.inspector_id == user.id.
    """
    if inspection.status == InspectionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar evidencia de una inspección cerrada (COMPLETED)"
        )

    h_id = await get_inspection_hospital_id(inspection, db)
    if h_id is not None:
        allowed = scope_filter_hospital_ids(user)
        if allowed is not None and h_id not in allowed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspección no encontrada")

    perms = ROLE_PERMISSIONS.get(user.role, frozenset())
    if Permission.EVIDENCE_DELETE_ALL in perms:
        return

    if Permission.EVIDENCE_DELETE_OWN in perms:
        if evidence.uploaded_by_id == user.id or inspection.inspector_id == user.id:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puede eliminar evidencias adjuntadas por otro usuario"
        )

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permisos insuficientes")
