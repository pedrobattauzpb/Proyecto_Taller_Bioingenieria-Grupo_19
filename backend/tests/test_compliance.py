import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime

from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.hierarchy import Asset, Hospital, Sector, AssetType
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.compliance import NormativeReference, NormativeVersion, ComplianceStatus, ComplianceSeverity
from app.models.inspection import Inspection, InspectionStatus
from app.services.compliance_engine import ComplianceEngine


@pytest.mark.asyncio
async def test_compliance_engine_evaluation_logic():
    """Valida la lógica unitaria del algoritmo de evaluación por tipo de ítem"""
    # 1. Booleano
    bool_item = ChecklistItem(
        id=1,
        template_id=1,
        code="TEST-01",
        title="Verificación de estanqueidad",
        input_type=ItemType.BOOLEAN,
        is_mandatory=True,
        referencia_normativa="ISO 7396-1:cl.5.7"
    )

    class MockResp:
        def __init__(self, val_bool=None, val_num=None, val_txt=None):
            self.val_boolean = val_bool
            self.val_numeric = val_num
            self.val_text = val_txt

    # Conforme
    status, exp, act, det, sev = ComplianceEngine.evaluate_item_compliance(bool_item, MockResp(val_bool=True))
    assert status == ComplianceStatus.COMPLIANT
    assert sev == ComplianceSeverity.OBSERVATION

    # No Conforme
    status, exp, act, det, sev = ComplianceEngine.evaluate_item_compliance(bool_item, MockResp(val_bool=False))
    assert status == ComplianceStatus.NON_COMPLIANT
    assert sev in [ComplianceSeverity.CRITICAL, ComplianceSeverity.MAJOR]

    # 2. Numérico
    num_item = ChecklistItem(
        id=2,
        template_id=1,
        code="TEST-02",
        title="Presión de suministro",
        input_type=ItemType.NUMERIC,
        unit="bar",
        is_mandatory=True,
        referencia_normativa="ISO 7396-1:cl.5.3",
        min_value=4.0,
        max_value=5.5
    )

    # Conforme central
    status, _, _, _, _ = ComplianceEngine.evaluate_item_compliance(num_item, MockResp(val_num=4.8))
    assert status == ComplianceStatus.COMPLIANT

    # Fuera de rango inferior
    status, _, _, det, sev = ComplianceEngine.evaluate_item_compliance(num_item, MockResp(val_num=3.2))
    assert status == ComplianceStatus.NON_COMPLIANT
    assert "por debajo" in det

    # Fuera de rango superior
    status, _, _, det, sev = ComplianceEngine.evaluate_item_compliance(num_item, MockResp(val_num=6.0))
    assert status == ComplianceStatus.NON_COMPLIANT
    assert "excede" in det

    # Zona de Warning (4.0 a 4.15 es cerca del límite inferior con span 1.5 y margen 0.15)
    status, _, _, det, _ = ComplianceEngine.evaluate_item_compliance(num_item, MockResp(val_num=4.1))
    assert status == ComplianceStatus.WARNING
    assert "próximo al umbral" in det or "cercano" in det


@pytest.mark.asyncio
async def test_normative_catalog_and_currency_endpoints():
    """Valida los endpoints REST del catálogo de normativas y chequeo de vigencia"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Catálogo general
        res = await client.get("/api/v1/normatives")
        assert res.status_code == 200
        normatives = res.json()
        assert len(normatives) >= 3

        codes = [n["code"] for n in normatives]
        assert "ISO 7396-1:2016" in codes
        assert "Res1130/2000" in codes

        # Chequeo de vigencia de plantilla de Manifold
        res_tmpl = await client.get("/api/v1/checklists/template?asset_type=MANIFOLD")
        assert res_tmpl.status_code == 200
        template_id = res_tmpl.json()["id"]

        res_check = await client.get(f"/api/v1/normatives/templates/{template_id}/currency-check")
        assert res_check.status_code == 200
        report = res_check.json()
        assert "all_current" in report
        assert report["all_current"] is True
        assert len(report["clauses"]) > 0


@pytest.mark.asyncio
async def test_inspection_realtime_compliance_and_audit_flow():
    """Valida el ciclo completo de auditoría en tiempo real sobre una inspección clínica"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Obtener un activo
        res_hier = await client.get("/api/v1/hierarchy")
        assert res_hier.status_code == 200
        asset = res_hier.json()["hospitals"][0]["sectors"][0]["assets"][0]

        # 2. Iniciar inspección
        res_create = await client.post("/api/v1/inspections", json={
            "asset_id": asset["id"],
            "inspector_name": "Bioing. Auditor Test",
            "notes": "Prueba de auditoría y compliance"
        })
        assert res_create.status_code == 201
        inspection = res_create.json()
        insp_id = inspection["id"]

        # Traer template para conocer los IDs de ítems
        res_insp = await client.get(f"/api/v1/inspections/{insp_id}")
        assert res_insp.status_code == 200
        detail = res_insp.json()
        items = detail["template"]["items"]

        # 3. Guardar respuestas con un desvío (uno conforme, uno fuera de rango)
        num_item = next(i for i in items if i["input_type"] == "NUMERIC")
        bool_item = next(i for i in items if i["input_type"] == "BOOLEAN")

        batch_payload = {
            "responses": [
                {
                    "item_id": num_item["id"],
                    "val_numeric": 1.5,  # Fuera de rango para generar desvío
                    "observations": "Presión muy baja detectada en rampa"
                },
                {
                    "item_id": bool_item["id"],
                    "val_boolean": True,
                    "observations": "Conforme"
                }
            ]
        }

        res_batch = await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json=batch_payload)
        assert res_batch.status_code == 200
        updated = res_batch.json()

        # Debe incluir compliance_summary en la respuesta
        assert "compliance_summary" in updated
        summary = updated["compliance_summary"]
        assert summary is not None
        assert summary["non_compliant_items"] >= 1
        assert summary["compliant_items"] >= 1
        assert summary["is_fully_compliant"] is False

        # 4. Endpoint directo de compliance
        res_comp = await client.get(f"/api/v1/inspections/{insp_id}/compliance")
        assert res_comp.status_code == 200
        comp_data = res_comp.json()
        assert comp_data["inspection_id"] == insp_id
        assert len(comp_data["results"]) == len(items)

        # 5. Endpoint de audit-logs inmutable
        res_logs = await client.get(f"/api/v1/audit-logs?inspection_id={insp_id}")
        assert res_logs.status_code == 200
        logs = res_logs.json()
        assert len(logs) >= 1
        assert logs[0]["event_type"] == "VALIDATION_RUN"
