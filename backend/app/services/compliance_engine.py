import re
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.checklist import ChecklistItem, ItemType, ChecklistTemplate
from app.models.inspection import Inspection, InspectionResponse, InspectionStatus
from app.models.compliance import (
    ComplianceResult,
    ComplianceStatus,
    ComplianceSeverity,
    AuditLog,
    AuditEventType,
    NormativeReference,
    NormativeVersion,
)
from app.schemas.compliance import (
    ComplianceSummary,
    ComplianceResultRead,
    NormativeCurrencyReport,
    NormativeClauseCheck,
)


class ComplianceEngine:
    """Motor de validación y auditoría de cumplimiento normativo en tiempo real."""

    @staticmethod
    def parse_norm_code_from_reference(ref: str) -> str:
        """Extrae el código raíz de norma de una referencia (ej: 'ISO 7396-1:cl.5.3' -> 'ISO 7396-1')"""
        if not ref:
            return ""
        clean_ref = ref.strip()
        if clean_ref.startswith("ISO 7396-1"):
            return "ISO 7396-1"
        if clean_ref.startswith("Res1130/2000") or clean_ref.startswith("Res. 1130/2000"):
            return "Res1130/2000"
        if clean_ref.startswith("IRAM 2529"):
            return "IRAM 2529"
        parts = re.split(r"[:\s]", clean_ref)
        return parts[0] if parts else clean_ref

    @classmethod
    def classify_severity(
        cls,
        item: ChecklistItem,
        status: ComplianceStatus,
        is_far_out_of_range: bool = False
    ) -> ComplianceSeverity:
        """Clasifica la severidad regulatoria del desvío técnico."""
        if status == ComplianceStatus.COMPLIANT:
            return ComplianceSeverity.OBSERVATION
        if status == ComplianceStatus.WARNING:
            return ComplianceSeverity.MINOR

        title_lower = (item.title or "").lower()
        desc_lower = (item.description or "").lower()
        critical_keywords = [
            "alarma", "fuga", "hermeticidad", "presión", "prueba hidráulica",
            "estanqueidad", "conmutación", "cruz griega", "seguridad"
        ]

        is_critical_keyword = any(k in title_lower or k in desc_lower for k in critical_keywords)

        if item.is_mandatory and (is_critical_keyword or is_far_out_of_range):
            return ComplianceSeverity.CRITICAL
        elif item.is_mandatory:
            return ComplianceSeverity.MAJOR
        else:
            return ComplianceSeverity.MINOR

    @classmethod
    def evaluate_item_compliance(
        cls,
        item: ChecklistItem,
        response: Optional[InspectionResponse]
    ) -> Tuple[ComplianceStatus, Optional[str], Optional[str], Optional[str], ComplianceSeverity]:
        """
        Evalúa una respuesta contra los límites y requisitos de la norma.
        Retorna: (status, expected_value, actual_value, deviation_detail, severity)
        """
        if not response or (
            response.val_boolean is None
            and response.val_numeric is None
            and (response.val_text is None or response.val_text.strip() == "")
        ):
            if item.is_mandatory:
                return (
                    ComplianceStatus.NOT_EVALUATED,
                    "Respuesta obligatoria requerida",
                    "Sin respuesta",
                    "Punto de control normativo obligatorio pendiente de verificación técnica.",
                    ComplianceSeverity.MAJOR
                )
            return (
                ComplianceStatus.NOT_EVALUATED,
                "Opcional",
                "Sin respuesta",
                None,
                ComplianceSeverity.OBSERVATION
            )

        # 1. Ítem Booleano
        if item.input_type == ItemType.BOOLEAN:
            expected = "Conforme (True / Pasa)"
            actual = "Pasa (True)" if response.val_boolean else "No Pasa (False)"
            if response.val_boolean is True:
                return (ComplianceStatus.COMPLIANT, expected, actual, None, ComplianceSeverity.OBSERVATION)
            else:
                sev = cls.classify_severity(item, ComplianceStatus.NON_COMPLIANT)
                detail = f"Desvío normativo detectado en '{item.title}'. El requisito no cumple con la especificación obligatoria."
                return (ComplianceStatus.NON_COMPLIANT, expected, actual, detail, sev)

        # 2. Ítem Numérico
        if item.input_type == ItemType.NUMERIC:
            val = response.val_numeric
            unit = item.unit or ""
            has_min = item.min_value is not None
            has_max = item.max_value is not None

            if val is None:
                return (
                    ComplianceStatus.NOT_EVALUATED,
                    f"{item.min_value} a {item.max_value} {unit}".strip(),
                    "Nulo",
                    "Valor numérico obligatorio no ingresado.",
                    ComplianceSeverity.MAJOR if item.is_mandatory else ComplianceSeverity.MINOR
                )

            expected_parts = []
            if has_min:
                expected_parts.append(f"Mín: {item.min_value} {unit}")
            if has_max:
                expected_parts.append(f"Máx: {item.max_value} {unit}")
            expected = " / ".join(expected_parts) or "Valor nominal libre"
            actual = f"{val} {unit}".strip()

            is_below = has_min and val < item.min_value
            is_above = has_max and val > item.max_value

            if is_below or is_above:
                is_far = False
                if is_below and item.min_value:
                    is_far = val < (item.min_value * 0.7)
                elif is_above and item.max_value:
                    is_far = val > (item.max_value * 1.3)

                sev = cls.classify_severity(item, ComplianceStatus.NON_COMPLIANT, is_far_out_of_range=is_far)
                if is_below:
                    detail = f"Presión/magnitud por debajo del límite mínimo reglamentario ({val} < {item.min_value} {unit})."
                else:
                    detail = f"Presión/magnitud excede el umbral máximo de seguridad ({val} > {item.max_value} {unit})."
                return (ComplianceStatus.NON_COMPLIANT, expected, actual, detail, sev)

            in_warning_band = False
            warning_detail = None
            if has_min and has_max:
                span = item.max_value - item.min_value
                if span > 0:
                    margin = span * 0.10
                    if val <= (item.min_value + margin):
                        in_warning_band = True
                        warning_detail = f"Valor próximo al umbral mínimo normativo ({val} {unit}, margen +{round(margin, 2)})."
                    elif val >= (item.max_value - margin):
                        in_warning_band = True
                        warning_detail = f"Valor próximo al límite superior de seguridad ({val} {unit}, margen -{round(margin, 2)})."
            elif has_min and val <= (item.min_value * 1.10):
                in_warning_band = True
                warning_detail = f"Valor cercano al límite mínimo normativo ({val} {unit})."
            elif has_max and val >= (item.max_value * 0.90):
                in_warning_band = True
                warning_detail = f"Valor cercano al límite máximo de seguridad ({val} {unit})."

            if in_warning_band:
                return (ComplianceStatus.WARNING, expected, actual, warning_detail, ComplianceSeverity.MINOR)

            return (ComplianceStatus.COMPLIANT, expected, actual, None, ComplianceSeverity.OBSERVATION)

        # 3. Ítem de Texto
        if item.input_type == ItemType.TEXT:
            expected = "Texto descriptivo requerido" if item.is_mandatory else "Opcional"
            actual = (response.val_text or "").strip()
            if item.is_mandatory and not actual:
                return (
                    ComplianceStatus.NON_COMPLIANT,
                    expected,
                    "Vacío",
                    "Registro descriptivo mandatorio sin completar.",
                    ComplianceSeverity.MAJOR
                )
            return (ComplianceStatus.COMPLIANT, expected, actual or "Registrado", None, ComplianceSeverity.OBSERVATION)

        return (ComplianceStatus.COMPLIANT, "N/A", "N/A", None, ComplianceSeverity.OBSERVATION)

    @classmethod
    async def check_normative_currency(
        cls,
        template_id: int,
        db: AsyncSession
    ) -> NormativeCurrencyReport:
        """Comprueba si las referencias normativas del checklist están vigentes o superadas."""
        template = await db.get(ChecklistTemplate, template_id)
        if not template:
            return NormativeCurrencyReport(
                template_id=template_id,
                template_title="Desconocido",
                asset_type="N/A",
                all_current=False,
                total_items=0,
                current_items_count=0,
                outdated_items_count=0,
                clauses=[]
            )

        items_res = await db.execute(
            select(ChecklistItem)
            .where(ChecklistItem.template_id == template_id)
            .order_by(ChecklistItem.order_index)
        )
        items = items_res.scalars().all()

        norms_res = await db.execute(select(NormativeReference).options(selectinload(NormativeReference.superseded_by)))
        norms = {n.code: n for n in norms_res.scalars().all()}

        clauses: List[NormativeClauseCheck] = []
        outdated_count = 0
        current_count = 0

        for item in items:
            ref = item.referencia_normativa
            root_code = cls.parse_norm_code_from_reference(ref)

            matched = None
            for code, n in norms.items():
                if root_code in code or code in ref:
                    matched = n
                    break

            if matched:
                is_curr = matched.is_current
                if is_curr:
                    msg = f"Norma vigente activa: {matched.title} (v{matched.current_version})"
                    sugg = None
                    current_count += 1
                else:
                    outdated_count += 1
                    replacement = matched.superseded_by.code if matched.superseded_by else "Edición posterior vigente"
                    msg = f"ALERTA: La norma referenciada '{matched.code}' fue superada o dada de baja."
                    sugg = f"Actualizar checklist al estándar {replacement}"
            else:
                is_curr = True
                msg = f"Norma referencial técnica reconocida: {ref}"
                sugg = None
                current_count += 1

            clauses.append(
                NormativeClauseCheck(
                    item_id=item.id,
                    item_code=item.code,
                    item_title=item.title,
                    referencia_normativa=ref,
                    matched_norm_code=matched.code if matched else root_code,
                    is_current=is_curr,
                    status_message=msg,
                    suggested_replacement=sugg
                )
            )

        return NormativeCurrencyReport(
            template_id=template.id,
            template_title=template.title,
            asset_type=template.asset_type.value,
            all_current=(outdated_count == 0),
            total_items=len(items),
            current_items_count=current_count,
            outdated_items_count=outdated_count,
            clauses=clauses
        )

    @classmethod
    async def validate_inspection_compliance(
        cls,
        inspection_id: int,
        db: AsyncSession,
        record_audit_log: bool = True,
        actor: str = "SYSTEM"
    ) -> ComplianceSummary:
        """
        Ejecuta el algoritmo completo de auditoría técnica en tiempo real para una inspección.
        Evalúa cada ítem, persiste ComplianceResults y opcionalmente añade entrada a AuditLog.
        """
        insp_res = await db.execute(
            select(Inspection)
            .options(
                selectinload(Inspection.template).selectinload(ChecklistTemplate.items),
                selectinload(Inspection.responses)
            )
            .where(Inspection.id == inspection_id)
        )
        inspection = insp_res.scalars().first()
        if not inspection:
            raise ValueError(f"Inspección ID {inspection_id} no encontrada.")

        versions_res = await db.execute(select(NormativeVersion).where(NormativeVersion.is_active == True))
        active_versions = versions_res.scalars().all()
        version_by_ref_prefix: Dict[str, int] = {}
        for v in active_versions:
            norm = await db.get(NormativeReference, v.reference_id)
            if norm:
                version_by_ref_prefix[norm.code] = v.id

        resp_by_item = {r.item_id: r for r in inspection.responses}

        # Borrar resultados previos
        existing_results = await db.execute(
            select(ComplianceResult).where(ComplianceResult.inspection_id == inspection_id)
        )
        for old_r in existing_results.scalars().all():
            await db.delete(old_r)

        items = inspection.template.items if inspection.template and inspection.template.items else []
        items.sort(key=lambda x: x.order_index)

        compliance_models: List[ComplianceResult] = []
        compliant_count = 0
        non_compliant_count = 0
        warning_count = 0
        pending_count = 0

        crit_count = 0
        major_count = 0
        minor_count = 0
        obs_count = 0

        for item in items:
            resp = resp_by_item.get(item.id)
            status, expected, actual, detail, sev = cls.evaluate_item_compliance(item, resp)

            if status == ComplianceStatus.COMPLIANT:
                compliant_count += 1
            elif status == ComplianceStatus.NON_COMPLIANT:
                non_compliant_count += 1
            elif status == ComplianceStatus.WARNING:
                warning_count += 1
            else:
                pending_count += 1

            if sev == ComplianceSeverity.CRITICAL and status == ComplianceStatus.NON_COMPLIANT:
                crit_count += 1
            elif sev == ComplianceSeverity.MAJOR and status == ComplianceStatus.NON_COMPLIANT:
                major_count += 1
            elif sev == ComplianceSeverity.MINOR and (status == ComplianceStatus.NON_COMPLIANT or status == ComplianceStatus.WARNING):
                minor_count += 1
            else:
                obs_count += 1

            norm_ver_id = None
            for code, vid in version_by_ref_prefix.items():
                if code in item.referencia_normativa or cls.parse_norm_code_from_reference(item.referencia_normativa) in code:
                    norm_ver_id = vid
                    break

            c_result = ComplianceResult(
                inspection_id=inspection.id,
                item_id=item.id,
                response_id=resp.id if resp else None,
                compliance_status=status,
                normative_ref=item.referencia_normativa,
                expected_value=expected,
                actual_value=actual,
                deviation_detail=detail,
                severity=sev,
                validated_at=datetime.utcnow(),
                normative_version_id=norm_ver_id
            )
            db.add(c_result)
            compliance_models.append(c_result)

        total_items = len(items)
        evaluated_items = compliant_count + non_compliant_count + warning_count
        compliance_pct = round((compliant_count / total_items * 100.0), 1) if total_items > 0 else 0.0
        is_fully_compliant = (non_compliant_count == 0 and pending_count == 0 and total_items > 0)

        currency_report = await cls.check_normative_currency(inspection.template_id, db)

        if record_audit_log:
            log_event = AuditLog(
                inspection_id=inspection.id,
                event_type=AuditEventType.VALIDATION_RUN,
                event_detail={
                    "total_items": total_items,
                    "evaluated": evaluated_items,
                    "compliant": compliant_count,
                    "non_compliant": non_compliant_count,
                    "warnings": warning_count,
                    "pending": pending_count,
                    "compliance_percentage": compliance_pct,
                    "critical_deviations": crit_count,
                    "all_norms_current": currency_report.all_current,
                },
                actor=actor,
                created_at=datetime.utcnow()
            )
            db.add(log_event)

        await db.commit()

        for cr in compliance_models:
            await db.refresh(cr)

        return ComplianceSummary(
            inspection_id=inspection.id,
            status=inspection.status.value,
            total_items=total_items,
            evaluated_items=evaluated_items,
            compliant_items=compliant_count,
            non_compliant_items=non_compliant_count,
            warning_items=warning_count,
            pending_items=pending_count,
            compliance_percentage=compliance_pct,
            is_fully_compliant=is_fully_compliant,
            critical_deviations_count=crit_count,
            major_deviations_count=major_count,
            minor_deviations_count=minor_count,
            observation_deviations_count=obs_count,
            normative_currency=currency_report,
            results=[
                ComplianceResultRead(
                    id=cr.id,
                    inspection_id=cr.inspection_id,
                    item_id=cr.item_id,
                    response_id=cr.response_id,
                    compliance_status=cr.compliance_status,
                    normative_ref=cr.normative_ref,
                    expected_value=cr.expected_value,
                    actual_value=cr.actual_value,
                    deviation_detail=cr.deviation_detail,
                    severity=cr.severity,
                    validated_at=cr.validated_at,
                    normative_version_id=cr.normative_version_id
                )
                for cr in compliance_models
            ]
        )
