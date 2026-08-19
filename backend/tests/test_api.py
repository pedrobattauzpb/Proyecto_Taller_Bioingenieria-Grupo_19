import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_get_hierarchy_tree(client: AsyncClient):
    response = await client.get("/api/v1/hierarchy")
    assert response.status_code == 200
    data = response.json()
    assert "hospitals" in data
    assert "metrics" in data
    assert len(data["hospitals"]) >= 1
    assert data["metrics"]["total_hospitals"] >= 1
    assert data["metrics"]["total_assets"] >= 2


@pytest.mark.asyncio
async def test_normative_checklist_templates_integrity(client: AsyncClient):
    """
    Verifica que las plantillas de checklists contengan trazabilidad normativa
    explícita en cada uno de sus ítems (Res. 1130/2000 e ISO 7396-1).
    """
    # 1. Template Manifold (ISO 7396-1)
    res_m = await client.get("/api/v1/checklists/template?asset_type=MANIFOLD")
    assert res_m.status_code == 200
    data_m = res_m.json()
    assert data_m["asset_type"] == "MANIFOLD"
    assert len(data_m["items"]) > 0
    for item in data_m["items"]:
        assert item["referencia_normativa"] is not None
        assert len(item["referencia_normativa"].strip()) > 0
        assert "ISO" in item["referencia_normativa"] or "Res" in item["referencia_normativa"]

    # 2. Template Cilindros de Gas (Res. MSAL 1130/2000 [AJUSTE])
    res_c = await client.get("/api/v1/checklists/template?asset_type=GAS_CYLINDER")
    assert res_c.status_code == 200
    data_c = res_c.json()
    assert data_c["asset_type"] == "GAS_CYLINDER"
    assert len(data_c["items"]) > 0
    for item in data_c["items"]:
        assert item["referencia_normativa"] is not None
        assert "Res1130/2000" in item["referencia_normativa"]


@pytest.mark.asyncio
async def test_inspection_full_lifecycle(client: AsyncClient):
    """
    Prueba el ciclo de vida completo de una inspección digital:
    1. Iniciar sesión de inspección para un Manifold.
    2. Guardar respuestas parciales con debounce / batch.
    3. Intentar completar con ítems faltantes -> 422 Unprocessable Entity.
    4. Completar todos los ítems obligatorios -> Estado COMPLETED.
    5. Consultar estadísticas de dashboard y verificar conteos.
    6. Consultar historial de inspecciones del activo.
    """
    # 1. Obtener jerarquía y resolver activo
    hier_res = await client.get("/api/v1/hierarchy")
    assert hier_res.status_code == 200
    hospitals = hier_res.json()["hospitals"]
    asset_id = hospitals[0]["sectors"][0]["assets"][0]["id"]

    # 2. Iniciar inspección
    create_payload = {
        "asset_id": asset_id,
        "template_id": 1,
        "inspector_name": "Bioing. Santiago Tester",
        "notes": "Inspección de rutina periódica de gases medicinales."
    }
    insp_res = await client.post("/api/v1/inspections", json=create_payload)
    assert insp_res.status_code == 201
    insp_data = insp_res.json()
    insp_id = insp_data["id"]
    assert insp_data["status"] == "IN_PROGRESS"
    assert insp_data["inspector_name"] == "Bioing. Santiago Tester"
    assert len(insp_data["template"]["items"]) == 2

    item_1_id = insp_data["template"]["items"][0]["id"]
    item_2_id = insp_data["template"]["items"][1]["id"]

    # 3. Guardar solo 1 respuesta (item 1 numérico: 4.8 bar)
    batch_payload_1 = {
        "responses": [
            {
                "item_id": item_1_id,
                "val_numeric": 4.8,
                "observations": "Presión estabilizada normal."
            }
        ]
    }
    put_res_1 = await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json=batch_payload_1)
    assert put_res_1.status_code == 200
    put_data_1 = put_res_1.json()
    assert put_data_1["completed_items"] == 1
    assert put_data_1["progress_percentage"] == 50.0

    # 4. Intentar cerrar inspección incompleta -> Debe fallar con 422
    complete_res_fail = await client.post(f"/api/v1/inspections/{insp_id}/complete")
    assert complete_res_fail.status_code == 422
    assert "missing_items" in complete_res_fail.json()["detail"]

    # 5. Completar ítem 2 (booleano: True)
    batch_payload_2 = {
        "responses": [
            {
                "item_id": item_2_id,
                "val_boolean": True,
                "observations": "Alarma acústica probada correctamente."
            }
        ]
    }
    put_res_2 = await client.put(f"/api/v1/inspections/{insp_id}/batch-responses", json=batch_payload_2)
    assert put_res_2.status_code == 200
    put_data_2 = put_res_2.json()
    assert put_data_2["completed_items"] == 2
    assert put_data_2["progress_percentage"] == 100.0

    # 6. Cerrar inspección exitosamente
    complete_res_ok = await client.post(
        f"/api/v1/inspections/{insp_id}/complete",
        json={"notes": "Cierre conforme sin novedades operativas."}
    )
    assert complete_res_ok.status_code == 200
    complete_data = complete_res_ok.json()
    assert complete_data["status"] == "COMPLETED"
    assert complete_data["completed_at"] is not None

    # 7. Verificar Stats Dashboard
    stats_res = await client.get("/api/v1/stats")
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert stats_data["completed_inspections"] >= 1
    assert len(stats_data["recent_inspections"]) >= 1

    # 8. Verificar Historial del Activo
    history_res = await client.get(f"/api/v1/assets/{asset_id}/history")
    assert history_res.status_code == 200
    history_data = history_res.json()
    assert len(history_data) >= 1
    assert history_data[0]["id"] == insp_id
    assert history_data[0]["status"] == "COMPLETED"
