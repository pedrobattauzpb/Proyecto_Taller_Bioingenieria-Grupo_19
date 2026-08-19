from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.hierarchy import AssetType
from app.models.checklist import ChecklistTemplate, ChecklistItem
from app.schemas.checklist import (
    ChecklistTemplateCreate, ChecklistTemplateRead,
    ChecklistItemCreate, ChecklistItemRead
)

router = APIRouter()


@router.get("/template", response_model=ChecklistTemplateRead, summary="Obtener plantilla activa por tipo de activo")
async def get_active_template_by_asset_type(
    asset_type: AssetType = Query(..., description="Tipo de activo (MANIFOLD, AVSU_VALVE, TERMINAL_UNIT, PRESSURE_REGULATOR, GAS_CYLINDER)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna la plantilla de checklist activa para el tipo de activo solicitado,
    incluyendo todos los ítems ordenados con su referencia normativa y límites de rango.
    """
    result = await db.execute(
        select(ChecklistTemplate)
        .options(selectinload(ChecklistTemplate.items))
        .where(
            ChecklistTemplate.asset_type == asset_type,
            ChecklistTemplate.is_active == True
        )
        .order_by(ChecklistTemplate.version.desc())
    )
    template = result.scalars().first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró una plantilla de checklist activa para el tipo de activo '{asset_type.value}'"
        )

    # Ordenar ítems por order_index
    template.items.sort(key=lambda item: item.order_index)
    return template


@router.get("/templates", response_model=List[ChecklistTemplateRead], summary="Listar todas las plantillas")
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChecklistTemplate)
        .options(selectinload(ChecklistTemplate.items))
        .order_by(ChecklistTemplate.id)
    )
    templates = result.scalars().all()
    for t in templates:
        t.items.sort(key=lambda item: item.order_index)
    return templates


@router.post("/templates", response_model=ChecklistTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(template_in: ChecklistTemplateCreate, db: AsyncSession = Depends(get_db)):
    template = ChecklistTemplate(
        title=template_in.title,
        asset_type=template_in.asset_type,
        version=template_in.version,
        description=template_in.description,
        is_active=template_in.is_active
    )
    db.add(template)
    await db.flush()

    for idx, item_data in enumerate(template_in.items):
        item = ChecklistItem(
            template_id=template.id,
            order_index=item_data.order_index if item_data.order_index is not None else idx,
            code=item_data.code,
            title=item_data.title,
            description=item_data.description,
            input_type=item_data.input_type,
            unit=item_data.unit,
            is_mandatory=item_data.is_mandatory,
            referencia_normativa=item_data.referencia_normativa,
            min_value=item_data.min_value,
            max_value=item_data.max_value
        )
        db.add(item)

    await db.commit()
    await db.refresh(template)

    result = await db.execute(
        select(ChecklistTemplate)
        .options(selectinload(ChecklistTemplate.items))
        .where(ChecklistTemplate.id == template.id)
    )
    saved_template = result.scalars().first()
    saved_template.items.sort(key=lambda item: item.order_index)
    return saved_template
