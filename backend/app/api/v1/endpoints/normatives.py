from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.compliance import NormativeReference, NormativeVersion
from app.models.checklist import ChecklistTemplate
from app.schemas.compliance import (
    NormativeReferenceRead,
    NormativeReferenceCreate,
    NormativeReferenceUpdate,
    NormativeVersionRead,
    NormativeVersionCreate,
    NormativeCurrencyReport,
)
from app.services.compliance_engine import ComplianceEngine

router = APIRouter()


@router.get("", response_model=List[NormativeReferenceRead], summary="Listar catálogo de normativas y estándares")
async def list_normatives(
    is_current: Optional[bool] = Query(None, description="Filtrar por vigencia regulatoria"),
    db: AsyncSession = Depends(get_db)
):
    """Retorna el catálogo maestro de normas (ISO 7396-1, Res. 1130/2000, IRAM 2529) con sus versiones."""
    query = select(NormativeReference).options(selectinload(NormativeReference.versions)).order_by(NormativeReference.code)
    if is_current is not None:
        query = query.where(NormativeReference.is_current == is_current)

    res = await db.execute(query)
    return res.scalars().all()


@router.get("/{id}", response_model=NormativeReferenceRead, summary="Detalle de una norma con versiones")
async def get_normative(id: int, db: AsyncSession = Depends(get_db)):
    norm = await db.execute(
        select(NormativeReference)
        .options(selectinload(NormativeReference.versions))
        .where(NormativeReference.id == id)
    )
    item = norm.scalars().first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Normativa ID {id} no encontrada."
        )
    return item


@router.put("/{id}", response_model=NormativeReferenceRead, summary="Actualizar estado de vigencia o datos de una norma")
async def update_normative(
    id: int,
    norm_in: NormativeReferenceUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Permite marcar una norma como superada (is_current=False) y asociar su reemplazo.
    Esto automáticamente dispara alertas de vigencia en las inspecciones que la utilicen.
    """
    item = await db.get(NormativeReference, id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Normativa ID {id} no encontrada."
        )

    for field, val in norm_in.model_dump(exclude_unset=True).items():
        setattr(item, field, val)

    await db.commit()
    await db.refresh(item)

    # Recargar con versiones
    reloaded = await db.execute(
        select(NormativeReference)
        .options(selectinload(NormativeReference.versions))
        .where(NormativeReference.id == id)
    )
    return reloaded.scalars().first()


@router.get("/templates/{template_id}/currency-check", response_model=NormativeCurrencyReport, summary="Verificar vigencia normativa de una plantilla")
async def check_template_normative_currency(
    template_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Examina cada ítem de la plantilla y verifica contra el catálogo legal si
    sus referencias normativas corresponden a normativas vigentes o desactualizadas.
    """
    template = await db.get(ChecklistTemplate, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plantilla ID {template_id} no encontrada."
        )

    return await ComplianceEngine.check_normative_currency(template_id, db)
