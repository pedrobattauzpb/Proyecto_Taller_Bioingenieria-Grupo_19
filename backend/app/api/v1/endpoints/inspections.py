from typing import List, Optional
from datetime import datetime
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from sqlalchemy.orm import selectinload, joinedload
from app.core.database import get_db
from app.core.config import settings
from app.core.permissions import Permission
from app.models.hierarchy import Asset, Sector
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.inspection import Inspection, InspectionResponse, InspectionStatus
from app.models.evidence import InspectionEvidence, FileType
from app.models.user import User
from app.schemas.inspection import (
    InspectionCreate, InspectionRead, InspectionDetailRead,
    BatchInspectionResponsesRequest, InspectionCompleteRequest,
    InspectionResponseRead
)
from app.schemas.evidence import InspectionEvidenceRead
from app.models.compliance import AuditLog, AuditEventType
from app.services.compliance_engine import ComplianceEngine
from app.services.storage import storage_service
from app.services.access_control import (
    scope_filter_hospital_ids,
    assert_hospital_in_scope,
    assert_can_read_inspection,
    assert_can_execute_inspection,
    assert_can_complete_inspection,
)
from app.services.auth_service import log_security_event
from app.api.deps import require_permissions, require_any_permission, get_request_context

router = APIRouter()


def _format_user_snapshot(user: User) -> str:
    lic = f" (Mat. {user.professional_license})" if user.professional_license else ""
    return f"{user.full_name}{lic}"


@router.post("", response_model=InspectionDetailRead, status_code=status.HTTP_201_CREATED, summary="Iniciar nueva inspección")
async def create_inspection(
    request: Request,
    inspection_in: InspectionCreate,
    user: User = Depends(require_permissions(Permission.INSPECTIONS_CREATE)),
    db: AsyncSession = Depends(get_db)
):
    """
    Inicia una nueva sesión de inspección para un activo clínico.
    Toma la identidad garantizada del usuario autenticado (inspector_id e inspector_name snapshot).
    """
    # Verificar activo y su alcance de hospital
    stmt = select(Asset).options(selectinload(Asset.sector)).where(Asset.id == inspection_in.asset_id)
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activo con ID {inspection_in.asset_id} no encontrado"
        )

    if asset.sector:
        assert_hospital_in_scope(user, asset.sector.hospital_id)

    # Verificar o resolver template
    template_id = inspection_in.template_id
    if not template_id:
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

    # Identidad tomada del usuario autenticado o snapshot provisto
    inspector_snapshot = inspection_in.inspector_name if inspection_in.inspector_name else _format_user_snapshot(user)
    now = datetime.utcnow()

    inspection = Inspection(
        asset_id=asset.id,
        template_id=template_id,
        inspector_id=user.id,
        inspector_name=inspector_snapshot,
        status=InspectionStatus.IN_PROGRESS,
        started_at=now,
        notes=inspection_in.notes
    )
    db.add(inspection)
    await db.flush()

    # Log de auditoría de inicio
    ip, ua = get_request_context(request)
    await log_security_event(
        db=db,
        event_type=AuditEventType.INSPECTION_STARTED,
        user=user,
        ip=ip,
        user_agent=ua,
        detail={"inspection_id": inspection.id, "asset_id": asset.id, "template_id": template_id}
    )

    await db.commit()
    return await get_inspection_detail_internal(inspection.id, db)


@router.get("/{id}", response_model=InspectionDetailRead, summary="Obtener detalle de inspección con respuestas")
async def get_inspection(
    id: int,
    user: User = Depends(require_any_permission(
        Permission.INSPECTIONS_READ_OWN,
        Permission.INSPECTIONS_READ_ALL,
        Permission.INSPECTIONS_READ_COMPLETED
    )),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Inspection)
        .options(
            joinedload(Inspection.asset).joinedload(Asset.sector),
            selectinload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses).joinedload(InspectionResponse.item),
            selectinload(Inspection.evidences)
        )
        .where(Inspection.id == id)
    )
    res = await db.execute(stmt)
    inspection = res.scalars().first()

    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Inspección con ID {id} no encontrada")

    # Regla D11 / §6.4 (11): Técnico ve propias y cerradas ajenas (abierta ajena -> 404)
    await assert_can_read_inspection(user, inspection, db)

    return await get_inspection_detail_internal(id, db, inspection_obj=inspection)


async def get_inspection_detail_internal(
    inspection_id: int,
    db: AsyncSession,
    include_compliance: bool = True,
    inspection_obj: Optional[Inspection] = None
) -> InspectionDetailRead:
    if inspection_obj:
        inspection = inspection_obj
    else:
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

    # Ordenar ítems de la plantilla
    if inspection.template and inspection.template.items:
        inspection.template.items.sort(key=lambda item: item.order_index)

    # Calcular progreso
    total_items = len(inspection.template.items) if inspection.template and inspection.template.items else 0
    completed_items = sum(
        1 for r in inspection.responses
        if (r.val_boolean is not None or r.val_numeric is not None or (r.val_text and r.val_text.strip()))
    )
    progress = round((completed_items / total_items * 100.0), 1) if total_items > 0 else 0.0

    # Evaluación de cumplimiento en tiempo real (si está configurada)
    compliance_summary = None
    if include_compliance:
        try:
            compliance_summary = await ComplianceEngine.validate_inspection_compliance(
                inspection_id=inspection.id,
                db=db,
                record_audit_log=False,
                actor="INSPECTION_DETAIL_READ"
            )
        except Exception:
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
        inspector_id=inspection.inspector_id,
        completed_by_id=inspection.completed_by_id,
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


@router.put("/{id}/batch-responses", response_model=InspectionDetailRead, summary="Guardado atómico por lotes con debounce")
async def batch_save_responses(
    id: int,
    batch_in: BatchInspectionResponsesRequest,
    user: User = Depends(require_any_permission(
        Permission.INSPECTIONS_EXECUTE_OWN,
        Permission.INSPECTIONS_EXECUTE_ALL
    )),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Inspection).options(joinedload(Inspection.asset).joinedload(Asset.sector)).where(Inspection.id == id)
    res = await db.execute(stmt)
    inspection = res.scalars().first()

    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Inspección con ID {id} no encontrada")

    # Regla de propiedad e inmutabilidad
    await assert_can_execute_inspection(user, inspection, db)

    # Obtener respuestas existentes
    existing_resp_res = await db.execute(
        select(InspectionResponse).where(InspectionResponse.inspection_id == id)
    )
    existing_responses = {r.item_id: r for r in existing_resp_res.scalars().all()}

    for item_resp in batch_in.responses:
        if item_resp.item_id in existing_responses:
            current = existing_responses[item_resp.item_id]
            current.val_boolean = item_resp.val_boolean
            current.val_numeric = item_resp.val_numeric
            current.val_text = item_resp.val_text
            current.observations = item_resp.observations
        else:
            new_resp = InspectionResponse(
                inspection_id=id,
                item_id=item_resp.item_id,
                val_boolean=item_resp.val_boolean,
                val_numeric=item_resp.val_numeric,
                val_text=item_resp.val_text,
                observations=item_resp.observations
            )
            db.add(new_resp)

    if inspection.status == InspectionStatus.DRAFT:
        inspection.status = InspectionStatus.IN_PROGRESS

    await db.commit()
    return await get_inspection_detail_internal(id, db)


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
    user: User = Depends(require_any_permission(
        Permission.INSPECTIONS_EXECUTE_OWN,
        Permission.INSPECTIONS_EXECUTE_ALL
    )),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Inspection).options(joinedload(Inspection.asset).joinedload(Asset.sector)).where(Inspection.id == id)
    res = await db.execute(stmt)
    inspection = res.scalars().first()

    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Inspección con ID {id} no encontrada")

    # Regla de objeto e inmutabilidad
    await assert_can_execute_inspection(user, inspection, db)

    # Validar ítem si se envía
    if item_id is not None:
        item = await db.get(ChecklistItem, item_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Ítem con ID {item_id} no encontrado")

    # Validar tipo MIME
    content_type = file.content_type or ""
    if content_type not in settings.ALLOWED_MIME_TYPES:
        allowed_str = ", ".join(settings.ALLOWED_MIME_TYPES)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Tipo de archivo no permitido. Aceptados: {allowed_str}")

    # Validar tamaño
    content = await file.read()
    file_size = len(content)
    if file_size > settings.MAX_EVIDENCE_SIZE_BYTES:
        max_mb = settings.MAX_EVIDENCE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"El archivo excede el tamaño máximo de {max_mb} MB")
    if file_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío")

    file_type = FileType.VIDEO if content_type.startswith("video/") else FileType.IMAGE

    # Subir al storage
    storage_key, size_bytes = storage_service.upload_file(
        file_obj=BytesIO(content),
        filename=file.filename or "evidence.jpg",
        content_type=content_type,
        folder_prefix=f"inspections/{id}"
    )

    uploader_snapshot = uploaded_by if uploaded_by else _format_user_snapshot(user)
    evidence = InspectionEvidence(
        inspection_id=id,
        item_id=item_id,
        file_type=file_type,
        storage_url=storage_key,
        file_size_bytes=size_bytes,
        uploaded_at=datetime.utcnow(),
        uploaded_by=uploader_snapshot,
        uploaded_by_id=user.id
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)

    presigned = storage_service.get_presigned_url(evidence.storage_url)
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


@router.post("/{id}/complete", response_model=InspectionDetailRead, summary="Completar y cerrar inspección")
async def complete_inspection(
    id: int,
    request: Request,
    complete_in: Optional[InspectionCompleteRequest] = None,
    user: User = Depends(require_any_permission(
        Permission.INSPECTIONS_COMPLETE_OWN,
        Permission.INSPECTIONS_COMPLETE_ALL
    )),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Inspection)
        .options(
            joinedload(Inspection.asset).joinedload(Asset.sector),
            selectinload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses)
        )
        .where(Inspection.id == id)
    )
    res = await db.execute(stmt)
    inspection = res.scalars().first()

    if not inspection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Inspección con ID {id} no encontrada")

    # Regla de propiedad e inmutabilidad
    await assert_can_complete_inspection(user, inspection, db)

    # Validar ítems obligatorios
    responses_by_item = {r.item_id: r for r in inspection.responses}
    missing_mandatory_items = []

    for item in inspection.template.items:
        if item.is_mandatory:
            resp = responses_by_item.get(item.id)
            if not resp:
                missing_mandatory_items.append(f"[{item.code}] {item.title}")
            else:
                has_val = (
                    resp.val_boolean is not None or
                    resp.val_numeric is not None or
                    (resp.val_text is not None and resp.val_text.strip() != "")
                )
                if not has_val:
                    missing_mandatory_items.append(f"[{item.code}] {item.title}")

    if missing_mandatory_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "No se puede completar la inspección. Faltan responder ítems obligatorios.",
                "missing_items": missing_mandatory_items
            }
        )

    now = datetime.utcnow()
    inspection.status = InspectionStatus.COMPLETED
    inspection.completed_at = now
    inspection.completed_by_id = user.id

    if complete_in and complete_in.notes:
        inspection.notes = (inspection.notes or "") + "\n" + complete_in.notes if inspection.notes else complete_in.notes

    # Validar compliance final
    final_compliance = await ComplianceEngine.validate_inspection_compliance(
        inspection_id=id,
        db=db,
        record_audit_log=False,
        actor=_format_user_snapshot(user)
    )

    ip, ua = get_request_context(request)
    actor_snapshot = f"{user.full_name} <{user.email}>"

    completion_audit_log = AuditLog(
        inspection_id=id,
        event_type=AuditEventType.INSPECTION_COMPLETED,
        event_detail={
            "status": "COMPLETED",
            "inspector_name": inspection.inspector_name,
            "completed_by": _format_user_snapshot(user),
            "completed_by_id": user.id,
            "compliance_percentage": final_compliance.compliance_percentage,
            "is_fully_compliant": final_compliance.is_fully_compliant,
            "critical_deviations_count": final_compliance.critical_deviations_count,
            "major_deviations_count": final_compliance.major_deviations_count,
            "completed_at": str(inspection.completed_at),
        },
        actor=actor_snapshot,
        actor_user_id=user.id,
        ip_address=ip[:45] if ip else None,
        user_agent=ua[:255] if ua else None,
        created_at=now
    )
    db.add(completion_audit_log)
    await db.commit()

    # Hook de alertas OE-5
    from app.services.notifications.hooks import on_inspection_completed
    await on_inspection_completed(db, inspection, final_compliance)

    return await get_inspection_detail_internal(id, db, include_compliance=True)


@router.get("", response_model=List[InspectionDetailRead], summary="Listar inspecciones")
async def list_inspections(
    asset_id: Optional[int] = None,
    status_filter: Optional[InspectionStatus] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_any_permission(
        Permission.INSPECTIONS_READ_OWN,
        Permission.INSPECTIONS_READ_ALL,
        Permission.INSPECTIONS_READ_COMPLETED
    )),
    db: AsyncSession = Depends(get_db)
):
    """
    Lista inspecciones según el alcance hospitalario y la visibilidad del usuario.
    - TECHNICIAN: ve sus propias inspecciones y las COMPLETED ajenas (O+C).
    - SUPERVISOR / AUDITOR / ADMIN: ven todas las de sus hospitales asignados.
    """
    query = (
        select(Inspection)
        .join(Asset, Inspection.asset_id == Asset.id)
        .join(Sector, Asset.sector_id == Sector.id)
        .options(
            joinedload(Inspection.asset),
            selectinload(Inspection.template).selectinload(ChecklistTemplate.items),
            selectinload(Inspection.responses).joinedload(InspectionResponse.item),
            selectinload(Inspection.evidences)
        )
        .order_by(Inspection.started_at.desc())
    )

    # 1. Filtro de alcance hospitalario
    allowed_hospitals = scope_filter_hospital_ids(user)
    if allowed_hospitals is not None:
        query = query.where(Sector.hospital_id.in_(allowed_hospitals))

    # 2. Regla D11 / §6.4 (11) Visibilidad del técnico (O+C)
    perms = [p.value for p in user.role.__class__.__members__.values()]  # check
    from app.core.permissions import ROLE_PERMISSIONS
    user_perms = ROLE_PERMISSIONS.get(user.role, frozenset())

    if Permission.INSPECTIONS_READ_ALL not in user_perms:
        # Es técnico: ve propias o cerradas ajenas
        query = query.where(
            or_(
                Inspection.inspector_id == user.id,
                Inspection.status == InspectionStatus.COMPLETED
            )
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
            for ev in (insp.evidences or [])
        ]

        response_list.append(
            InspectionDetailRead(
                id=insp.id,
                asset_id=insp.asset_id,
                template_id=insp.template_id,
                inspector_id=insp.inspector_id,
                completed_by_id=insp.completed_by_id,
                inspector_name=insp.inspector_name,
                status=insp.status,
                started_at=insp.started_at,
                completed_at=insp.completed_at,
                notes=insp.notes,
                asset=insp.asset,
                template=insp.template,
                responses=insp.responses,
                evidences=evidences_read,
                total_items=total_items,
                completed_items=completed_items,
                progress_percentage=progress
            )
        )

    return response_list
