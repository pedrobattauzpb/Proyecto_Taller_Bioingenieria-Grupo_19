import pytest
from httpx import AsyncClient
from io import BytesIO
from app.models.hierarchy import Asset
from app.models.checklist import ChecklistTemplate
from app.models.inspection import Inspection, InspectionStatus
from app.models.evidence import InspectionEvidence, FileType


@pytest.mark.asyncio
async def test_evidence_upload_and_validation(client: AsyncClient, db_session):
    """
    Verifica B.2 y B.3: Carga multipart de evidencia multimedia, validación server-side de tipo MIME y tamaño.
    """
    # 1. Crear una inspección
    create_resp = await client.post(
        "/api/v1/inspections",
        json={
            "asset_id": 1,
            "inspector_name": "Bioing. Juan Pérez",
            "notes": "Inspección inicial de prueba de evidencia"
        }
    )
    assert create_resp.status_code == 201
    inspection_id = create_resp.json()["id"]

    # 2. Intentar subir archivo con tipo MIME inválido (ej. text/plain o application/pdf)
    fake_txt = BytesIO(b"Este es un archivo de texto no permitido")
    resp_invalid_mime = await client.post(
        f"/api/v1/inspections/{inspection_id}/evidence",
        files={"file": ("invalido.txt", fake_txt, "text/plain")},
        data={"uploaded_by": "Inspector Test"}
    )
    assert resp_invalid_mime.status_code == 400
    assert "Tipo de archivo no permitido" in resp_invalid_mime.json()["detail"]

    # 3. Subir imagen válida (JPEG)
    fake_img = BytesIO(b"\xFF\xD8\xFF\xE0" + b"0" * 1024)  # Cabecera simulada JPEG + payload
    resp_valid_img = await client.post(
        f"/api/v1/inspections/{inspection_id}/evidence",
        files={"file": ("manometro.jpg", fake_img, "image/jpeg")},
        data={"uploaded_by": "Bioing. Juan Pérez"}
    )
    assert resp_valid_img.status_code == 201
    img_data = resp_valid_img.json()
    assert img_data["file_type"] == "IMAGE"
    assert img_data["inspection_id"] == inspection_id
    assert "storage_url" in img_data
    assert "presigned_url" in img_data
    assert img_data["uploaded_by"] == "Bioing. Juan Pérez"
    evidence_id_1 = img_data["id"]

    # 4. Subir video válido (MP4) asociado a un ítem
    fake_video = BytesIO(b"\x00\x00\x00\x18ftypmp42" + b"0" * 2048)
    resp_valid_video = await client.post(
        f"/api/v1/inspections/{inspection_id}/evidence",
        files={"file": ("fuga_valvula.mp4", fake_video, "video/mp4")},
        data={"item_id": 1, "uploaded_by": "Bioing. Juan Pérez"}
    )
    assert resp_valid_video.status_code == 201
    video_data = resp_valid_video.json()
    assert video_data["file_type"] == "VIDEO"
    assert video_data["item_id"] == 1
    assert "presigned_url" in video_data
    evidence_id_2 = video_data["id"]

    # 5. Consultar detalle de inspección y verificar que incluye las 2 evidencias
    insp_detail_resp = await client.get(f"/api/v1/inspections/{inspection_id}")
    assert insp_detail_resp.status_code == 200
    detail = insp_detail_resp.json()
    assert len(detail["evidences"]) == 2


@pytest.mark.asyncio
async def test_asset_history_timeline(client: AsyncClient, db_session):
    """
    Verifica B.2: GET /api/v1/assets/{id}/history devuelve el historial cronológico con evidencias adjuntas.
    """
    # 1. Crear dos inspecciones para el activo 1
    insp1 = await client.post(
        "/api/v1/inspections",
        json={"asset_id": 1, "inspector_name": "Inspector Alpha", "notes": "Primera pasada"}
    )
    id1 = insp1.json()["id"]

    # Adjuntar evidencia a id1
    fake_img = BytesIO(b"\xFF\xD8\xFF\xE0" + b"A" * 500)
    await client.post(
        f"/api/v1/inspections/{id1}/evidence",
        files={"file": ("foto1.jpg", fake_img, "image/jpeg")}
    )

    # Crear segunda inspección
    insp2 = await client.post(
        "/api/v1/inspections",
        json={"asset_id": 1, "inspector_name": "Inspector Beta", "notes": "Segunda pasada"}
    )
    id2 = insp2.json()["id"]

    # 2. Consultar historial del activo 1
    history_resp = await client.get("/api/v1/assets/1/history")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) >= 2
    # Comprobar que contiene la evidencia
    found_evidence = any(len(h["evidences"]) > 0 for h in history)
    assert found_evidence is True

    # 3. Consultar historial de activo inexistente -> 404
    hist_404 = await client.get("/api/v1/assets/99999/history")
    assert hist_404.status_code == 404


@pytest.mark.asyncio
async def test_evidence_deletion_rules(client: AsyncClient, db_session):
    """
    Verifica B.2: DELETE /api/v1/evidence/{id}
    - Permitido si la inspección padre está en DRAFT o IN_PROGRESS.
    - Rechazado si la inspección padre está en COMPLETED.
    """
    # 1. Crear inspección en DRAFT
    insp_resp = await client.post(
        "/api/v1/inspections",
        json={"asset_id": 1, "inspector_name": "Auditor Clínico"}
    )
    inspection_id = insp_resp.json()["id"]

    # 2. Subir evidencia
    fake_img = BytesIO(b"\xFF\xD8\xFF\xE0" + b"E" * 500)
    ev_resp = await client.post(
        f"/api/v1/inspections/{inspection_id}/evidence",
        files={"file": ("borrable.jpg", fake_img, "image/jpeg")},
        data={"uploaded_by": "Auditor Clínico"}
    )
    assert ev_resp.status_code == 201
    evidence_id = ev_resp.json()["id"]

    # 3. Eliminar evidencia mientras está en DRAFT -> Éxito
    del_resp = await client.delete(f"/api/v1/evidence/{evidence_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["id"] == evidence_id

    # Verificar que ya no existe
    get_ev = await client.get(f"/api/v1/evidence/{evidence_id}")
    assert get_ev.status_code == 404

    # 4. Subir nueva evidencia para probar bloqueo por cierre
    ev_resp2 = await client.post(
        f"/api/v1/inspections/{inspection_id}/evidence",
        files={"file": ("no_borrable.jpg", fake_img, "image/jpeg")}
    )
    evidence_id_2 = ev_resp2.json()["id"]

    # Responder los ítems obligatorios para poder completar la inspección
    # La plantilla del manifold tiene ítems 1 y 2
    await client.put(
        f"/api/v1/inspections/{inspection_id}/batch-responses",
        json={
            "responses": [
                {"item_id": 1, "val_numeric": 4.5},
                {"item_id": 2, "val_boolean": True}
            ]
        }
    )

    # Cerrar la inspección
    complete_resp = await client.post(
        f"/api/v1/inspections/{inspection_id}/complete",
        json={"notes": "Inspección cerrada para auditoría"}
    )
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "COMPLETED"

    # 5. Intentar borrar evidencia de la inspección COMPLETED -> Debe ser RECHAZADO (400)
    del_blocked_resp = await client.delete(f"/api/v1/evidence/{evidence_id_2}")
    assert del_blocked_resp.status_code == 400
    assert "cerrada" in del_blocked_resp.json()["detail"].lower()

    # 6. Intentar subir evidencia a una inspección COMPLETED -> Debe ser RECHAZADO (400)
    post_blocked_resp = await client.post(
        f"/api/v1/inspections/{inspection_id}/evidence",
        files={"file": ("otra.jpg", fake_img, "image/jpeg")}
    )
    assert post_blocked_resp.status_code == 400
    assert "cerrada" in post_blocked_resp.json()["detail"].lower()
