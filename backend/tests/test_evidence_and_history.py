import pytest
import io
from httpx import AsyncClient
from app.models.hierarchy import AssetType
from app.models.inspection import InspectionStatus
from app.services.storage import storage_service


@pytest.fixture(autouse=True)
def configure_test_storage(monkeypatch):
    monkeypatch.setattr(storage_service, "backend", "local")
    monkeypatch.setattr(storage_service, "s3_client", None)


@pytest.mark.asyncio
async def test_evidence_upload_and_server_side_validation(client: AsyncClient):
    # 1. Crear una inspección en progreso
    create_resp = await client.post(
        "/api/v1/inspections",
        json={
            "asset_id": 1,
            "inspector_name": "Bioing. Test Evidence",
            "notes": "Test de evidencias multimedia"
        }
    )
    assert create_resp.status_code == 201
    insp_data = create_resp.json()
    insp_id = insp_data["id"]

    # 2. Validar rechazo de tipo MIME no permitido (B.3)
    fake_exe = io.BytesIO(b"MZ\x90\x00executable content")
    bad_mime_resp = await client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("malicious.exe", fake_exe, "application/x-msdownload")}
    )
    assert bad_mime_resp.status_code == 400
    assert "Tipo de archivo no permitido" in bad_mime_resp.json()["detail"]

    # 3. Validar rechazo de archivo vacío
    empty_file = io.BytesIO(b"")
    empty_resp = await client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("empty.jpg", empty_file, "image/jpeg")}
    )
    assert empty_resp.status_code == 400
    assert "vacío" in empty_resp.json()["detail"]

    # 4. Carga exitosa de una imagen (JPEG)
    dummy_image = io.BytesIO(b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"A" * 1024)
    upload_resp = await client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("manometro_o2.jpg", dummy_image, "image/jpeg")},
        data={"item_id": 1, "uploaded_by": "Bioing. Test Evidence"}
    )
    assert upload_resp.status_code == 201
    evidence_data = upload_resp.json()
    assert evidence_data["file_type"] == "IMAGE"
    assert evidence_data["inspection_id"] == insp_id
    assert evidence_data["item_id"] == 1
    assert "storage_url" in evidence_data
    assert "presigned_url" in evidence_data
    assert evidence_data["uploaded_by"] == "Bioing. Test Evidence"
    evidence_id = evidence_data["id"]

    # 5. Carga exitosa de un video (MP4)
    dummy_video = io.BytesIO(b"\x00\x00\x00\x18ftypmp42" + b"V" * 2048)
    upload_video_resp = await client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("prueba_fuga.mp4", dummy_video, "video/mp4")},
        data={"uploaded_by": "Bioing. Video Tester"}
    )
    assert upload_video_resp.status_code == 201
    video_data = upload_video_resp.json()
    assert video_data["file_type"] == "VIDEO"
    assert video_data["item_id"] is None

    # 6. Verificar que la inspección ahora lista las 2 evidencias
    detail_resp = await client.get(f"/api/v1/inspections/{insp_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert len(detail["evidences"]) == 2
    assert any(e["id"] == evidence_id for e in detail["evidences"])

    # 7. Eliminar la evidencia de video mientras la inspección sigue en progreso
    del_resp = await client.delete(f"/api/v1/evidence/{video_data['id']}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # 8. Verificar que la evidencia de video fue removida
    detail_resp2 = await client.get(f"/api/v1/inspections/{insp_id}")
    assert len(detail_resp2.json()["evidences"]) == 1


@pytest.mark.asyncio
async def test_completed_inspection_locks_evidence(client: AsyncClient):
    """
    Regla médica y de auditoría:
    No se puede eliminar evidencia ni agregar nueva evidencia si la inspección está COMPLETED.
    """
    # 1. Crear e iniciar inspección
    create_resp = await client.post(
        "/api/v1/inspections",
        json={
            "asset_id": 1,
            "inspector_name": "Bioing. Auditor Jefe",
            "notes": "Auditoría para cierre"
        }
    )
    insp_id = create_resp.json()["id"]

    # 2. Subir evidencia mientras está abierta
    img_bytes = io.BytesIO(b"\xFF\xD8\xFF" + b"X" * 500)
    upload_resp = await client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("foto_valvula.jpg", img_bytes, "image/jpeg")}
    )
    assert upload_resp.status_code == 201
    evidence_id = upload_resp.json()["id"]

    # 3. Responder ítems obligatorios requeridos para cerrar la inspección
    batch_resp = await client.put(
        f"/api/v1/inspections/{insp_id}/batch-responses",
        json={
            "responses": [
                {"item_id": 1, "val_numeric": 4.5},
                {"item_id": 2, "val_boolean": True}
            ]
        }
    )
    assert batch_resp.status_code == 200

    # 4. Completar la inspección
    complete_resp = await client.post(
        f"/api/v1/inspections/{insp_id}/complete",
        json={"notes": "Inspección formalmente firmada y cerrada"}
    )
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "COMPLETED"

    # 4. Intentar eliminar la evidencia de la inspección cerrada -> DEBE RECHAZARSE (400)
    del_attempt = await client.delete(f"/api/v1/evidence/{evidence_id}")
    assert del_attempt.status_code == 400
    assert "cerrada" in del_attempt.json()["detail"].lower()

    # 5. Intentar agregar nueva evidencia a la inspección cerrada -> DEBE RECHAZARSE (400)
    extra_img = io.BytesIO(b"\xFF\xD8\xFF" + b"Y" * 500)
    add_attempt = await client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("foto_tardia.jpg", extra_img, "image/jpeg")}
    )
    assert add_attempt.status_code == 400
    assert "completada y cerrada" in add_attempt.json()["detail"].lower()


@pytest.mark.asyncio
async def test_asset_inspection_history_timeline(client: AsyncClient):
    """
    Verifica GET /api/v1/assets/{id}/history retornando la trazabilidad cronológica con evidencias
    """
    asset_id = 1

    # Crear inspección 1
    insp1 = await client.post(
        "/api/v1/inspections",
        json={"asset_id": asset_id, "inspector_name": "Inspector 1"}
    )
    id1 = insp1.json()["id"]

    # Adjuntar foto a insp1
    photo = io.BytesIO(b"\xFF\xD8\xFF" + b"1" * 300)
    await client.post(
        f"/api/v1/inspections/{id1}/evidence",
        files={"file": ("history_photo1.jpg", photo, "image/jpeg")}
    )

    # Crear inspección 2
    insp2 = await client.post(
        "/api/v1/inspections",
        json={"asset_id": asset_id, "inspector_name": "Inspector 2"}
    )
    id2 = insp2.json()["id"]

    # Consultar historial del activo
    history_resp = await client.get(f"/api/v1/assets/{asset_id}/history")
    assert history_resp.status_code == 200
    history = history_resp.json()

    assert len(history) >= 2
    # Inspección más reciente debe estar primera (orden cronológico descendente)
    assert history[0]["id"] == id2
    assert history[1]["id"] == id1

    # Verificar que el ítem del historial contiene sus evidencias y notas
    insp1_history = next(h for h in history if h["id"] == id1)
    assert len(insp1_history["evidences"]) == 1
    assert "presigned_url" in insp1_history["evidences"][0]
    assert insp1_history["asset_id"] == asset_id
