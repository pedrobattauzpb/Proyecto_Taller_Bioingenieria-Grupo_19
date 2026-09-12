from typing import List, Optional
from datetime import datetime
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload, joinedload
from app.core.database import get_db
from app.core.config import settings
from app.models.hierarchy import Asset
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.inspection import Inspection, InspectionResponse, InspectionStatus
from app.models.evidence import InspectionEvidence, FileType
from app.schemas.inspection import (
    InspectionCreate, InspectionRead, InspectionDetailRead,
    BatchInspectionResponsesRequest, InspectionCompleteRequest,
    InspectionResponseRead
)
from app.schemas.evidence import InspectionEvidenceRead
from app.models.compliance import AuditLog, AuditEventType
from app.services.compliance_engine import ComplianceEngine
from app.services.storage import storage_service

router = APIRouter()



@router.post("", response_model=InspectionDetailRead, status_code=status.HTTP_201_CREATED, summary="Iniciar nueva inspección")
async def create_inspection(inspection_in: InspectionCreate, db: AsyncSession = Depends(get_db)):
    """
    Inicia una nueva sesión de inspección para un activo clínico.
    Si no se especifica template_id o se verifica, se vincula con la plantilla activa correspondiente al tipo de activo.
    """
    # Verificar activo
    asset = await db.get(Asset, inspection_in.asset_id)
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activo con ID {inspection_in.asset_id} no encontrado"
        )

    # Verificar o resolver template
    template_id = inspection_in.template_id
    if not template_id:
        # Buscar plantilla activa para el asset_type
        tmpl_res = await db.execute(
            select(ChecklistTemplate)
            .where(
                ChecklistTemplate.asset_type == asset.asset_type,
                ChecklistTemplate.is_active == True
            )
            .order_by(ChecklistTemplate.version.desc())
        )
        template = tmpl_res.scalars().first()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No hay una plantilla activa disponible para activos de tipo '{asset.asset_type.value}'"
            )
        template_id = template.id
    else:
        template = await db.get(ChecklistTemplate, template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plantilla con ID {template_id} no encontrada"
            )

    inspection = Inspection(
        asset_id=asset.id,
        template_id=template_id,
        inspector_name=inspection_in.inspector_name,
        status=InspectionStatus.IN_PROGRESS,
        started_at=datetime.utcnow(),
        notes=inspection_in.notes
    )
    db.add(inspection)
    await db.commit()
    await db.refresh(inspection)

    # Cargar relaciones completas para la respuesta
    return await get_inspection_detail_internal(inspection.id, db)


@router.get("/{id}", response_model=InspectionDetailRead, summary="Obtener detalle de inspección con respuestas")
async def get_inspection(id: int, db: AsyncSession = Depends(get_db)):
    return await get_inspection_detail_internal(id, db)


async def get_inspection_detail_internal(
    inspection_id: int,
    db: AsyncSession,
    include_compliance: bool = True
) -> InspectionDetailRead:
    result = await db.execute(
        select(Inspection)
        .options(
            joinedload(Inspection.asset),
            selectinload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses).joinedload(InspectionResponse.item),
            selectinload(Inspection.evidences)
        )
        .where(Inspection.id == inspection_id)
    )
    inspection = result.scalars().first()

    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección con ID {inspection_id} no encontrada"
        )

    # Asegurar ordenamiento de ítems del template
    if inspection.template and inspection.template.items:
        inspection.template.items.sort(key=lambda x: x.order_index)

    total_items = len(inspection.template.items) if inspection.template and inspection.template.items else 0
    # Contar respuestas completadas válidas
    completed_items = sum(
        1 for r in inspection.responses
        if (r.val_boolean is not None or r.val_numeric is not None or (r.val_text and r.val_text.strip()))
    )
    progress = round((completed_items / total_items * 100.0), 1) if total_items > 0 else 0.0

    compliance_summary = None
    if include_compliance:
        try:
            compliance_summary = await ComplianceEngine.validate_inspection_compliance(
                inspection_id=inspection_id,
                db=db,
                record_audit_log=False,
                actor="INSPECTION_DETAIL_READ"
            )
        except Exception as e:
            # Fallback seguro en caso de error en evaluación secundaria
            pass

    evidences_read = [
        InspectionEvidenceRead(
            id=ev.id,
            inspection_id=ev.inspection_id,
            item_id=ev.item_id,
            file_type=ev.file_type,
            storage_url=ev.storage_url,
            presigned_url=storage_service.get_presigned_url(ev.storage_url),
            file_size_bytes=ev.file_size_bytes,
            uploaded_by=ev.uploaded_by,
            uploaded_at=ev.uploaded_at
        )
        for ev in (inspection.evidences or [])
    ]

    return InspectionDetailRead(
        id=inspection.id,
        asset_id=inspection.asset_id,
        template_id=inspection.template_id,
        inspector_name=inspection.inspector_name,
        status=inspection.status,
        started_at=inspection.started_at,
        completed_at=inspection.completed_at,
        notes=inspection.notes,
        asset=inspection.asset,
        template=inspection.template,
        responses=inspection.responses,
        evidences=evidences_read,
        total_items=total_items,
        completed_items=completed_items,
        progress_percentage=progress,
        compliance_summary=compliance_summary
    )


@router.post(
    "/{id}/evidence",
    response_model=InspectionEvidenceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Adjuntar evidencia multimedia a una inspección"
)
async def upload_inspection_evidence(
    id: int,
    file: UploadFile = File(...),
    item_id: Optional[int] = Form(None),
    uploaded_by: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Carga multipart de un archivo de evidencia (imagen o video) y lo asocia a una inspección (y opcionalmente a un ítem).
    Aplica validación server-side de tipo MIME y tamaño máximo.
    """
    # 1. Verificar existencia de la inspección
    inspection = await db.get(Inspection, id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección con ID {id} no encontrada"
        )

    # 2. Regla: no permitir adjuntar evidencia si la inspección está cerrada (COMPLETED)
    if inspection.status == InspectionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede adjuntar evidencia a una inspección que ya ha sido completada y cerrada."
        )

    # 3. Si se especifica item_id, verificar que pertenezca a la plantilla o exista
    if item_id is not None:
        item = await db.get(ChecklistItem, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ítem de checklist con ID {item_id} no encontrado"
            )

    # 4. Validación server-side de tipo MIME (B.3)
    content_type = file.content_type or ""
    if content_type not in settings.ALLOWED_MIME_TYPES:
        allowed_str = ", ".join(settings.ALLOWED_MIME_TYPES)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido ('{content_type}'). Los tipos MIME aceptados son: {allowed_str}"
        )

    # 5. Determinar FileType enum
    if content_type.startswith("image/"):
        file_type = FileType.IMAGE
    elif content_type.startswith("video/"):
        file_type = FileType.VIDEO
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de archivo inválido: sólo se aceptan imágenes o videos."
        )

    # 6. Validación server-side de tamaño de archivo (B.3)
    content = await file.read()
    file_size = len(content)
    if file_size > settings.MAX_EVIDENCE_SIZE_BYTES:
        max_mb = settings.MAX_EVIDENCE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo ({round(file_size / (1024 * 1024), 2)} MB) excede el tamaño máximo permitido de {max_mb} MB."
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo proporcionado está vacío (0 bytes)."
        )

    # 7. Subir a Object Storage (MinIO / S3 / Local fallback)
    storage_key, size_bytes = storage_service.upload_file(
        file_obj=BytesIO(content),
        filename=file.filename or "evidence.jpg",
        content_type=content_type,
        folder_prefix=f"inspections/{id}"
    )

    # 8. Persistir en la base de datos
    evidence = InspectionEvidence(
        inspection_id=id,
        item_id=item_id,
        file_type=file_type,
        storage_url=storage_key,
        file_size_bytes=size_bytes,
        uploaded_at=datetime.utcnow(),
        uploaded_by=uploaded_by or inspection.inspector_name
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)

    # 9. Generar URL prefirmada
    presigned = storage_service.get_presigned_url(evidence.storage_url)

    return InspectionEvidenceRead(
        id=evidence.id,
        inspection_id=evidence.inspection_id,
        item_id=evidence.item_id,
        file_type=evidence.file_type,
        storage_url=evidence.storage_url,
        presigned_url=presigned,
        file_size_bytes=evidence.file_size_bytes,
        uploaded_at=evidence.uploaded_at,
        uploaded_by=evidence.uploaded_by
    )



@router.put("/{id}/batch-responses", response_model=InspectionDetailRead, summary="Guardado atómico por lotes con debounce")
async def batch_save_responses(
    id: int,
    batch_in: BatchInspectionResponsesRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Actualiza o inserta de forma atómica múltiples respuestas de ítems de checklist.
    Ideal para el auto-guardado en segundo plano con debounce desde el frontend.
    """
    inspection = await db.get(Inspection, id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección con ID {id} no encontrada"
        )

    if inspection.status == InspectionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pueden modificar respuestas en una inspección que ya ha sido completada y cerrada."
        )

    # Obtener respuestas existentes de esta inspección
    existing_resp_res = await db.execute(
        select(InspectionResponse).where(InspectionResponse.inspection_id == id)
    )
    existing_responses = {r.item_id: r for r in existing_resp_res.scalars().all()}

    for item_resp in batch_in.responses:
        if item_resp.item_id in existing_responses:
            # Actualizar existente
            current = existing_responses[item_resp.item_id]
            current.val_boolean = item_resp.val_boolean
            current.val_numeric = item_resp.val_numeric
            current.val_text = item_resp.val_text
            current.observations = item_resp.observations
        else:
            # Crear nueva respuesta
            new_resp = InspectionResponse(
                inspection_id=id,
                item_id=item_resp.item_id,
                val_boolean=item_resp.val_boolean,
                val_numeric=item_resp.val_numeric,
                val_text=item_resp.val_text,
                observations=item_resp.observations
            )
            db.add(new_resp)

    # Asegurar que el estado esté IN_PROGRESS si estaba en DRAFT
    if inspection.status == InspectionStatus.DRAFT:
        inspection.status = InspectionStatus.IN_PROGRESS

    await db.commit()
    return await get_inspection_detail_internal(id, db)


@router.post("/{id}/complete", response_model=InspectionDetailRead, summary="Completar y cerrar inspección")
async def complete_inspection(
    id: int,
    complete_in: Optional[InspectionCompleteRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Cierra la inspección verificando que todos los ítems obligatorios tengan respuesta registrada.
    Registra fecha de finalización y notas de cierre.
    """
    result = await db.execute(
        select(Inspection)
        .options(
            selectinload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses)
        )
        .where(Inspection.id == id)
    )
    inspection = result.scalars().first()

    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección con ID {id} no encontrada"
        )

    if inspection.status == InspectionStatus.COMPLETED:
        return await get_inspection_detail_internal(id, db)

    # Validar que todos los ítems obligatorios tengan respuesta
    responses_by_item = {r.item_id: r for r in inspection.responses}
    missing_mandatory_items = []

    for item in inspection.template.items:
        if item.is_mandatory:
            resp = responses_by_item.get(item.id)
            if not resp:
                missing_mandatory_items.append(f"[{item.code}] {item.title}")
            else:
                has_value = (
                    resp.val_boolean is not None or
                    resp.val_numeric is not None or
                    (resp.val_text is not None and resp.val_text.strip() != "")
                )
                if not has_value:
                    missing_mandatory_items.append(f"[{item.code}] {item.title}")

    if missing_mandatory_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "No se puede completar la inspección. Faltan responder ítems obligatorios.",
                "missing_items": missing_mandatory_items
            }
        )

    # Actualizar estado y fecha de cierre
    inspection.status = InspectionStatus.COMPLETED
    inspection.completed_at = datetime.utcnow()
    if complete_in:
        if complete_in.notes:
            inspection.notes = (inspection.notes or "") + "\n" + complete_in.notes if inspection.notes else complete_in.notes
        if complete_in.inspector_name:
            inspection.inspector_name = complete_in.inspector_name

    # Ejecutar validación final de compliance y registrar log inmutable de finalización
    final_compliance = await ComplianceEngine.validate_inspection_compliance(
        inspection_id=id,
        db=db,
        record_audit_log=False,
        actor=inspection.inspector_name
    )

    completion_audit_log = AuditLog(
        inspection_id=id,
        event_type=AuditEventType.INSPECTION_COMPLETED,
        event_detail={
            "status": "COMPLETED",
            "inspector_name": inspection.inspector_name,
            "compliance_percentage": final_compliance.compliance_percentage,
            "is_fully_compliant": final_compliance.is_fully_compliant,
            "critical_deviations_count": final_compliance.critical_deviations_count,
            "major_deviations_count": final_compliance.major_deviations_count,
            "completed_at": str(inspection.completed_at),
        },
        actor=inspection.inspector_name,
        created_at=datetime.utcnow()
    )
    db.add(completion_audit_log)

    await db.commit()
    return await get_inspection_detail_internal(id, db, include_compliance=True)



@router.get("", response_model=List[InspectionDetailRead], summary="Listar inspecciones")
async def list_inspections(
    asset_id: Optional[int] = None,
    status_filter: Optional[InspectionStatus] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Inspection)
        .options(
            joinedload(Inspection.asset),
            selectinload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses).joinedload(InspectionResponse.item)
        )
        .order_by(Inspection.started_at.desc())
    )

    if asset_id is not None:
        query = query.where(Inspection.asset_id == asset_id)
    if status_filter is not None:
        query = query.where(Inspection.status == status_filter)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    inspections = result.scalars().all()

    response_list = []
    for insp in inspections:
        total_items = len(insp.template.items) if insp.template and insp.template.items else 0
        completed_items = sum(
            1 for r in insp.responses
            if (r.val_boolean is not None or r.val_numeric is not None or (r.val_text and r.val_text.strip()))
        )
        progress = round((completed_items / total_items * 100.0), 1) if total_items > 0 else 0.0

        response_list.append(
            InspectionDetailRead(
                id=insp.id,
                asset_id=insp.asset_id,
                template_id=insp.template_id,
                inspector_name=insp.inspector_name,
                status=insp.status,
                started_at=insp.started_at,
                completed_at=insp.completed_at,
                notes=insp.notes,
                asset=insp.asset,
                template=insp.template,
                responses=insp.responses,
                total_items=total_items,
                completed_items=completed_items,
                progress_percentage=progress
            )
        )

    return response_list


@router.post(
    "/{id}/evidence",
    response_model=InspectionEvidenceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Adjuntar evidencia multimedia (foto/video) a una inspección"
)
async def upload_inspection_evidence(
    id: int,
    file: UploadFile = File(...),
    item_id: Optional[int] = Form(None),
    uploaded_by: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Sube un archivo de evidencia multimedia (foto o video).
    Valida tamaño, tipo MIME y estado de la inspección.
    Genera URL prefirmada y registra la evidencia en la base de datos.
    """
    inspection = await db.get(Inspection, id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspección con ID {id} no encontrada"
        )

    if inspection.status == InspectionStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede adjuntar evidencia a una inspección cerrada (COMPLETED)"
        )

    # Validar tipo MIME
    content_type = file.content_type or ""
    if content_type not in settings.ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido ('{content_type}'). Tipos aceptados: {', '.join(settings.ALLOWED_MIME_TYPES)}"
        )

    # Validar tamaño del archivo
    content = await file.read()
    file_size = len(content)
    if file_size > settings.MAX_EVIDENCE_SIZE_BYTES:
        max_mb = settings.MAX_EVIDENCE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo excede el tamaño máximo permitido de {max_mb} MB"
        )

    # Determinar tipo de archivo (IMAGE o VIDEO)
    file_type = FileType.VIDEO if content_type.startswith("video/") else FileType.IMAGE

    # Validar item_id si se proporcionó
    if item_id is not None:
        item = await db.get(ChecklistItem, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ítem de checklist con ID {item_id} no encontrado"
            )

    # Subir archivo al storage desacoplado
    storage_key, size_bytes = storage_service.upload_file(
        file_obj=BytesIO(content),
        filename=file.filename or "evidence.jpg",
        content_type=content_type,
        folder_prefix=f"inspections/{id}"
    )

    # Crear registro en la base de datos
    evidence = InspectionEvidence(
        inspection_id=id,
        item_id=item_id,
        file_type=file_type,
        storage_url=storage_key,
        file_size_bytes=file_size,
        uploaded_by=uploaded_by or inspection.inspector_name
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)

    # Generar URL prefirmada
    presigned = storage_service.get_presigned_url(storage_key)

    return InspectionEvidenceRead(
        id=evidence.id,
        inspection_id=evidence.inspection_id,
        item_id=evidence.item_id,
        file_type=evidence.file_type,
        storage_url=evidence.storage_url,
        presigned_url=presigned,
        file_size_bytes=evidence.file_size_bytes,
        uploaded_by=evidence.uploaded_by,
        uploaded_at=evidence.uploaded_at
    )

