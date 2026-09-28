import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_download_inspection_pdf_and_excel(client: AsyncClient):
    """
    Test completo del flujo de generación de Acta de Inspección Técnica:
    1. Iniciar inspección sobre un Manifold.
    2. Cargar respuestas conformes y no conformes.
    3. Completar la inspección.
    4. Descargar PDF y verificar magic bytes %PDF- y headers.
    5. Descargar Excel y verificar magic bytes PK (ZIP) y headers.
    """
    # 1. Iniciar inspección
    start_res = await client.post(
        "/api/v1/inspections",
        json={
            "asset_id": 1,
            "inspector_name": "Bioing. Santiago Auditor",
            "notes": "Auditoría semestral de presiones",
        },
    )
    assert start_res.status_code == 201
    insp_data = start_res.json()
    insp_id = insp_data["id"]
    items = insp_data["template"]["items"]

    # 2. Responder ítems (1 conforme, 1 no conforme para verificar dictamen)
    responses_payload = []
    for it in items:
        if it["input_type"] == "NUMERIC":
            responses_payload.append({
                "item_id": it["id"],
                "val_numeric": 4.8,  # Conforme (4.0 a 5.5 bar)
                "observations": "Presión dentro de norma ISO 7396-1",
            })
        else:
            responses_payload.append({
                "item_id": it["id"],
                "val_boolean": False,  # No conforme para probar sección de desvíos
                "observations": "Alarma no respondió adecuadamente",
            })

    batch_res = await client.put(
        f"/api/v1/inspections/{insp_id}/batch-responses",
        json={"responses": responses_payload},
    )
    assert batch_res.status_code == 200

    # 3. Completar inspección
    comp_res = await client.post(
        f"/api/v1/inspections/{insp_id}/complete",
        json={
            "inspector_name": "Bioing. Santiago Auditor",
            "notes": "Inspección finalizada con 1 observación crítica.",
        },
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "COMPLETED"

    # 4. Descargar PDF del Acta
    pdf_res = await client.get(f"/api/v1/reports/inspections/{insp_id}/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert "attachment;" in pdf_res.headers.get("content-disposition", "")
    assert f"Acta_Inspeccion_{insp_id}" in pdf_res.headers.get("content-disposition", "")
    assert len(pdf_res.content) > 1000
    assert pdf_res.content.startswith(b"%PDF-")

    # 5. Descargar Excel del Acta
    excel_res = await client.get(f"/api/v1/reports/inspections/{insp_id}/excel")
    assert excel_res.status_code == 200
    assert "spreadsheetml.sheet" in excel_res.headers["content-type"]
    assert "attachment;" in excel_res.headers.get("content-disposition", "")
    assert len(excel_res.content) > 1000
    assert excel_res.content.startswith(b"PK\x03\x04")  # Magic bytes ZIP/XLSX


@pytest.mark.asyncio
async def test_download_inspection_pdf_not_found(client: AsyncClient):
    """Verifica que solicitar el PDF de una inspección inexistente devuelve HTTP 404."""
    res = await client.get("/api/v1/reports/inspections/99999/pdf")
    assert res.status_code == 404
    assert "no encontrada" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_download_inspection_excel_not_found(client: AsyncClient):
    """Verifica que solicitar el Excel de una inspección inexistente devuelve HTTP 404."""
    res = await client.get("/api/v1/reports/inspections/99999/excel")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_download_asset_history_pdf(client: AsyncClient):
    """
    Verifica la generación del informe histórico en PDF de un activo:
    1. Generar inspecciones previas sobre el activo.
    2. Descargar el historial PDF y verificar su estructura.
    """
    # Descargar historial del activo 1 (Manifold pre-sembrado)
    res = await client.get("/api/v1/reports/assets/1/history-pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "Historial_Activo_" in res.headers.get("content-disposition", "")
    assert len(res.content) > 1000
    assert res.content.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_download_asset_history_pdf_not_found(client: AsyncClient):
    """Verifica 404 para un activo inexistente."""
    res = await client.get("/api/v1/reports/assets/99999/history-pdf")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_download_executive_pdf_and_excel(client: AsyncClient):
    """
    Verifica la generación del informe ejecutivo institucional tanto en PDF como en Excel.
    """
    # 1. PDF Ejecutivo
    pdf_res = await client.get("/api/v1/reports/executive/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert "Informe_Ejecutivo_" in pdf_res.headers.get("content-disposition", "")
    assert len(pdf_res.content) > 1000
    assert pdf_res.content.startswith(b"%PDF-")

    # 2. Excel Ejecutivo
    excel_res = await client.get("/api/v1/reports/executive/excel")
    assert excel_res.status_code == 200
    assert "spreadsheetml.sheet" in excel_res.headers["content-type"]
    assert len(excel_res.content) > 1000
    assert excel_res.content.startswith(b"PK\x03\x04")


@pytest.mark.asyncio
async def test_get_executive_report_data_json(client: AsyncClient):
    """
    Verifica que el endpoint JSON para alimentar los gráficos de la UI retorna
    la estructura correcta de métricas, sectores y severidades.
    """
    res = await client.get("/api/v1/reports/executive/data")
    assert res.status_code == 200
    data = res.json()

    assert "hospital_name" in data
    assert "global_compliance_percentage" in data
    assert "sector_stats" in data
    assert "asset_type_stats" in data
    assert "severity_distribution" in data
    assert isinstance(data["sector_stats"], list)
    assert isinstance(data["asset_type_stats"], list)
    assert isinstance(data["severity_distribution"], dict)
