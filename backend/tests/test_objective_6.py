"""
Pruebas exhaustivas para el Objetivo Específico 6 (OE-6):
Autenticación, Autorización, Roles (RBAC), Alcance Multi-Hospital,
Inmutabilidad de Inspecciones, Reglas de Objeto (O+C) y Auditoría de Seguridad.
"""

import io
import time
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.user import User, UserRole
from app.models.hierarchy import Hospital, Sector, Asset
from app.models.inspection import Inspection, InspectionStatus
from app.models.compliance import AuditLog, AuditEventType, ComplianceResult, NormativeReference
from app.models.notification import Alert, AlertSeverity, AlertStatus
from app.core.security import (
    verify_password,
    sign_file_url,
    verify_file_signature,
    create_access_token,
    create_sse_ticket,
    validate_password_policy,
)


# ============================================================================
# 1. AUTENTICACIÓN, TOKENS Y POLÍTICA DE SEGURIDAD
# ============================================================================

@pytest.mark.asyncio
async def test_auth_login_success(anon_client: AsyncClient):
    """Login exitoso retorna access_token, refresh_token opaco y perfil de usuario."""
    resp = await anon_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@hospital.gob.ar", "password": "Demo2026!"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["has_global_scope"] is True
    assert "users:read" in data["user"]["permissions"]


@pytest.mark.asyncio
async def test_auth_login_invalid_credentials(anon_client: AsyncClient):
    """Contraseña incorrecta retorna 401 Unauthorized."""
    resp = await anon_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@hospital.gob.ar", "password": "WrongPassword123!"}
    )
    assert resp.status_code == 401
    assert "inválidas" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_login_nonexistent_email(anon_client: AsyncClient):
    """Correo electrónico no registrado retorna 401 genérico idéntico a contraseña incorrecta."""
    resp = await anon_client.post(
        "/api/v1/auth/login",
        data={"username": "noexiste_usuario@hospital.gob.ar", "password": "CualquierPassword1!"}
    )
    assert resp.status_code == 401
    assert "inválidas" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_login_inactive_user(anon_client: AsyncClient, db_session: AsyncSession):
    """Usuario inactivo (baja lógica) no puede iniciar sesión (401)."""
    res = await db_session.execute(select(User).where(User.email == "tecnico2@hospital.gob.ar"))
    user = res.scalar_one()
    user.is_active = False
    await db_session.commit()

    resp = await anon_client.post(
        "/api/v1/auth/login",
        data={"username": "tecnico2@hospital.gob.ar", "password": "Demo2026!"}
    )
    assert resp.status_code == 401
    assert "inactivo" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_account_lockout_after_failed_attempts(anon_client: AsyncClient):
    """Tras 5 intentos fallidos consecutivos la cuenta se bloquea (423 Locked)."""
    # 4 intentos iniciales fallan con 401
    for _ in range(4):
        r = await anon_client.post(
            "/api/v1/auth/login",
            data={"username": "tecnico@hospital.gob.ar", "password": "BadPassword1!"}
        )
        assert r.status_code == 401

    # 5to intento: Bloquea la cuenta (423 Locked)
    lock_resp = await anon_client.post(
        "/api/v1/auth/login",
        data={"username": "tecnico@hospital.gob.ar", "password": "BadPassword1!"}
    )
    assert lock_resp.status_code == 423
    assert "bloqueada" in lock_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_refresh_token_rotation_and_reuse_detection(anon_client: AsyncClient):
    """Rotación de tokens de refresco y detección de reutilización maliciosa."""
    # 1. Login inicial
    login_res = await anon_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@hospital.gob.ar", "password": "Demo2026!"}
    )
    data1 = login_res.json()
    ref1 = data1["refresh_token"]

    # 2. Refresco exitoso
    ref_res = await anon_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": ref1}
    )
    assert ref_res.status_code == 200
    data2 = ref_res.json()
    ref2 = data2["refresh_token"]
    assert ref2 != ref1

    # 3. Intento de reusar el token antiguo (ref1) -> Invalida toda la familia (401)
    reuse_res = await anon_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": ref1}
    )
    assert reuse_res.status_code == 401

    # 4. Ahora ref2 también debería haber quedado revocado por la detección de reuso
    ref2_retry = await anon_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": ref2}
    )
    assert ref2_retry.status_code == 401


@pytest.mark.asyncio
async def test_auth_logout_revokes_token(anon_client: AsyncClient):
    """Logout revoca el token de refresco."""
    login_res = await anon_client.post(
        "/api/v1/auth/login",
        data={"username": "supervisor@hospital.gob.ar", "password": "Demo2026!"}
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    access_token = login_data["access_token"]
    ref_token = login_data["refresh_token"]

    logout_res = await anon_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": ref_token},
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert logout_res.status_code == 204

    # Intento de refresco posterior debe fallar
    retry_res = await anon_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": ref_token}
    )
    assert retry_res.status_code == 401


@pytest.mark.asyncio
async def test_auth_token_expired(anon_client: AsyncClient, db_session: AsyncSession):
    """Un token JWT vencido es rechazado con 401."""
    res = await db_session.execute(select(User).where(User.email == "tecnico@hospital.gob.ar"))
    user = res.scalar_one()
    expired_token = create_access_token(user, expires_delta=timedelta(seconds=-10))

    resp = await anon_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_auth_token_tampered_signature(anon_client: AsyncClient, db_session: AsyncSession):
    """Un token JWT con firma alterada es rechazado con 401."""
    res = await db_session.execute(select(User).where(User.email == "tecnico@hospital.gob.ar"))
    user = res.scalar_one()
    token = create_access_token(user)
    tampered = token[:-4] + "wxyz"

    resp = await anon_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tampered}"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_auth_wrong_token_type(anon_client: AsyncClient, db_session: AsyncSession):
    """Un token con tipo no-access (ej: type=sse) es rechazado en endpoints de API con 401."""
    res = await db_session.execute(select(User).where(User.email == "tecnico@hospital.gob.ar"))
    user = res.scalar_one()
    sse_token = create_sse_ticket(user)

    resp = await anon_client.get(
        "/api/v1/hierarchy",
        headers={"Authorization": f"Bearer {sse_token}"}
    )
    assert resp.status_code == 401
    assert "tipo de token inválido" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_token_version_invalidation(anon_client: AsyncClient, db_session: AsyncSession):
    """Al incrementar token_version, los tokens emitidos anteriormente quedan invalidados (401)."""
    res = await db_session.execute(select(User).where(User.email == "tecnico@hospital.gob.ar"))
    user = res.scalar_one()
    token = create_access_token(user)

    # 1. Con la versión actual funciona
    ok_resp = await anon_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert ok_resp.status_code == 200

    # 2. Se incrementa token_version (ej. por reseteo o cambio de rol)
    user.token_version += 1
    await db_session.commit()

    # 3. El token previo ahora es rechazado
    revoked_resp = await anon_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert revoked_resp.status_code == 401
    assert "revocada" in revoked_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auth_password_policy_and_must_change_password(
    anon_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Política de contraseñas (>= 10 caracteres, letras, números, no común ni igual a email)
    y bloqueo con 403 de endpoints de negocio ante must_change_password=True.
    """
    # 1. Verificación de la función de política
    ok, _ = validate_password_policy("corta", "user@test.com")
    assert not ok
    ok, _ = validate_password_policy("sololetrasypunto", "user@test.com")
    assert not ok
    ok, _ = validate_password_policy("123456789012", "user@test.com")
    assert not ok
    ok, _ = validate_password_policy("password123", "user@test.com")
    assert not ok
    ok, _ = validate_password_policy("user@test.com2026", "user@test.com")
    assert not ok
    ok, err = validate_password_policy("PasswordValida2026!", "user@test.com")
    assert ok
    assert err == ""

    # 2. must_change_password bloquea endpoints de negocio
    res = await db_session.execute(select(User).where(User.email == "tecnico@hospital.gob.ar"))
    user = res.scalar_one()
    user.must_change_password = True
    await db_session.commit()

    token = create_access_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    # Endpoint de negocio da 403
    biz_resp = await anon_client.get("/api/v1/hierarchy", headers=headers)
    assert biz_resp.status_code == 403
    assert "cambiar su contraseña obligatoria" in biz_resp.json()["detail"].lower()

    # /auth/me se mantiene accesible para consultar el estado
    me_resp = await anon_client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["must_change_password"] is True

    # Cambiar contraseña personal vía PUT /auth/me/password
    change_resp = await anon_client.put(
        "/api/v1/auth/me/password",
        json={"current_password": "Demo2026!", "new_password": "NuevaPassword2026!"},
        headers=headers,
    )
    assert change_resp.status_code == 204

    # Tras el cambio, must_change_password se desactiva
    await db_session.refresh(user)
    assert user.must_change_password is False

    # El nuevo token permite acceder a la jerarquía
    new_token = create_access_token(user)
    new_headers = {"Authorization": f"Bearer {new_token}"}
    biz_ok = await anon_client.get("/api/v1/hierarchy", headers=new_headers)
    assert biz_ok.status_code == 200


# ============================================================================
# 2. MATRIZ PARAMETRIZADA RBAC (Rol × Endpoint → Status Code)
# ============================================================================

RBAC_MATRIX_CASES = [
    # (method, endpoint, payload, exp_anon, exp_tech, exp_sup, exp_aud, exp_admin)
    ("GET", "/api/v1/hierarchy", None, 401, 200, 200, 200, 200),
    ("POST", "/api/v1/hierarchy/sectors", {"hospital_id": 1, "name": "Sector RBAC", "floor_level": "PB"}, 401, 403, 201, 403, 201),
    ("GET", "/api/v1/checklists/templates", None, 401, 200, 200, 200, 200),
    ("POST", "/api/v1/checklists/templates", {"title": "Tmpl RBAC", "asset_type": "MANIFOLD", "version": "1.0"}, 401, 403, 201, 403, 201),
    ("POST", "/api/v1/inspections", {"asset_id": 1, "notes": "Inspeccion RBAC"}, 401, 201, 201, 403, 201),
    ("GET", "/api/v1/audit-logs", None, 401, 403, 200, 200, 200),
    ("GET", "/api/v1/normatives", None, 401, 200, 200, 200, 200),
    ("PUT", "/api/v1/normatives/9999", {"description": "Norm edit RBAC"}, 401, 403, 403, 403, 404),
    ("GET", "/api/v1/stats", None, 401, 200, 200, 200, 200),
    ("GET", "/api/v1/alerts", None, 401, 200, 200, 200, 200),
    ("POST", "/api/v1/alerts/run-checks", None, 401, 403, 200, 403, 200),
    ("GET", "/api/v1/notifications/channels", None, 401, 403, 200, 403, 200),
    ("GET", "/api/v1/users", None, 401, 403, 200, 403, 200),
    ("GET", "/api/v1/roles", None, 401, 403, 200, 403, 200),
    ("GET", "/api/v1/reports/executive/data", None, 401, 403, 200, 200, 200),
]

RBAC_UNPACKED_CASES = []
for m, ep, pay, anon_s, tech_s, sup_s, aud_s, admin_s in RBAC_MATRIX_CASES:
    RBAC_UNPACKED_CASES.append((m, ep, pay, "ANON", anon_s))
    RBAC_UNPACKED_CASES.append((m, ep, pay, "TECH", tech_s))
    RBAC_UNPACKED_CASES.append((m, ep, pay, "SUP", sup_s))
    RBAC_UNPACKED_CASES.append((m, ep, pay, "AUD", aud_s))
    RBAC_UNPACKED_CASES.append((m, ep, pay, "ADMIN", admin_s))


@pytest.mark.asyncio
@pytest.mark.parametrize("method,endpoint,payload,role,expected_status", RBAC_UNPACKED_CASES)
async def test_rbac_matrix_access(
    method: str,
    endpoint: str,
    payload: dict,
    role: str,
    expected_status: int,
    anon_client: AsyncClient,
    tech_client: AsyncClient,
    supervisor_client: AsyncClient,
    auditor_client: AsyncClient,
    admin_client: AsyncClient,
):
    """
    Matriz parametrizada exhaustiva que valida el acceso (200/201 vs 401/403)
    para cada uno de los 4 roles principales y para usuario anónimo.
    """
    clients = {
        "ANON": anon_client,
        "TECH": tech_client,
        "SUP": supervisor_client,
        "AUD": auditor_client,
        "ADMIN": admin_client,
    }
    client: AsyncClient = clients[role]

    if method == "GET":
        resp = await client.get(endpoint)
    elif method == "POST":
        resp = await client.post(endpoint, json=payload or {})
    elif method == "PUT":
        resp = await client.put(endpoint, json=payload or {})
    elif method == "DELETE":
        resp = await client.delete(endpoint)
    else:
        raise ValueError(f"Método HTTP no soportado: {method}")

    assert resp.status_code == expected_status, (
        f"Fallo en {method} {endpoint} para rol {role}: "
        f"esperado {expected_status}, obtenido {resp.status_code} ({resp.text[:150]})"
    )


# ============================================================================
# 3. GESTIÓN DE USUARIOS Y ROLES (RBAC Y DELEGACIÓN SUPERVISOR)
# ============================================================================

@pytest.mark.asyncio
async def test_admin_can_create_and_manage_any_user(admin_client: AsyncClient):
    """Admin puede crear usuarios de cualquier rol y asignar hospitales."""
    payload = {
        "email": "nuevo.auditor@hospital.gob.ar",
        "full_name": "Lic. Auditor Externo",
        "role": "AUDITOR",
        "password": "PasswordSegura2026!",
        "hospital_ids": [1],
    }
    resp = await admin_client.post("/api/v1/users", json=payload)
    assert resp.status_code == 201
    user_data = resp.json()
    assert user_data["email"] == "nuevo.auditor@hospital.gob.ar"
    assert user_data["role"] == "AUDITOR"
    assert user_data["hospital_ids"] == [1]


@pytest.mark.asyncio
async def test_supervisor_can_only_manage_technicians_in_assigned_hospital(
    client: AsyncClient, # supervisor del Hospital 1
):
    """Supervisor solo puede crear y gestionar Técnicos de sus propios hospitales."""
    # 1. Crear técnico en Hospital 1 (permitido)
    tech_payload = {
        "email": "tecnico.valido@hospital.gob.ar",
        "full_name": "Técnico Hospital 1",
        "role": "TECHNICIAN",
        "password": "PasswordSegura2026!",
        "hospital_ids": [1],
    }
    create_ok = await client.post("/api/v1/users", json=tech_payload)
    assert create_ok.status_code == 201

    # 2. Intentar crear un Supervisor -> 403 Forbidden
    sup_payload = {
        "email": "otro.supervisor@hospital.gob.ar",
        "full_name": "Otro Supervisor",
        "role": "SUPERVISOR",
        "password": "PasswordSegura2026!",
        "hospital_ids": [1],
    }
    create_sup = await client.post("/api/v1/users", json=sup_payload)
    assert create_sup.status_code == 403

    # 3. Intentar asignar técnico a un hospital ajeno (Hospital 2) -> 403 Forbidden
    alien_tech_payload = {
        "email": "tecnico.ajeno@hospital.gob.ar",
        "full_name": "Técnico Hospital Ajeno",
        "role": "TECHNICIAN",
        "password": "PasswordSegura2026!",
        "hospital_ids": [2],
    }
    create_alien = await client.post("/api/v1/users", json=alien_tech_payload)
    assert create_alien.status_code == 403


@pytest.mark.asyncio
async def test_supervisor_management_boundary_checks(
    client: AsyncClient, # supervisor Hospital 1
    db_session: AsyncSession,
):
    """
    Límites del Supervisor:
    - No puede otorgar alcance global (403)
    - No puede cambiar el rol de un técnico (403)
    - No puede desactivar a un supervisor (403)
    """
    # 1. Intentar crear técnico con alcance global
    global_tech_payload = {
        "email": "tech.global@hospital.gob.ar",
        "full_name": "Técnico Global Fake",
        "role": "TECHNICIAN",
        "password": "PasswordSegura2026!",
        "has_global_scope": True,
        "hospital_ids": [1],
    }
    g_res = await client.post("/api/v1/users", json=global_tech_payload)
    assert g_res.status_code == 403

    # 2. Intentar cambiar el rol de un técnico a SUPERVISOR
    res_tech = await db_session.execute(select(User).where(User.email == "tecnico@hospital.gob.ar"))
    tech = res_tech.scalar_one()

    patch_role = await client.patch(f"/api/v1/users/{tech.id}", json={"role": "SUPERVISOR"})
    assert patch_role.status_code == 403

    # 3. Intentar desactivar a un supervisor
    res_sup = await db_session.execute(select(User).where(User.email == "supervisor@hospital.gob.ar"))
    sup = res_sup.scalar_one()

    # Si intenta operar sobre otro supervisor (o sobre sí mismo)
    deact_res = await client.post(f"/api/v1/users/{sup.id}/deactivate")
    assert deact_res.status_code == 403


@pytest.mark.asyncio
async def test_user_creation_duplicate_email_conflict(admin_client: AsyncClient):
    """Intentar crear un usuario con correo ya registrado devuelve 409 Conflict."""
    payload = {
        "email": "admin@hospital.gob.ar",
        "full_name": "Admin Duplicado",
        "role": "ADMIN",
        "password": "PasswordSegura2026!",
    }
    res = await admin_client.post("/api/v1/users", json=payload)
    assert res.status_code == 409
    assert "registrado" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_technician_cannot_manage_users(tech_client: AsyncClient):
    """Un técnico no tiene permisos para listar ni crear usuarios (403)."""
    get_res = await tech_client.get("/api/v1/users")
    assert get_res.status_code == 403

    post_res = await tech_client.post("/api/v1/users", json={
        "email": "hacker@test.com", "full_name": "Hacker", "role": "ADMIN", "password": "Demo123456!"
    })
    assert post_res.status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_self_deactivate(admin_client: AsyncClient, db_session: AsyncSession):
    """Regla de seguridad: un Administrador no puede auto-desactivarse."""
    res = await db_session.execute(select(User).where(User.email == "admin@hospital.gob.ar"))
    admin = res.scalar_one()

    resp = await admin_client.patch(f"/api/v1/users/{admin.id}", json={"is_active": False})
    assert resp.status_code == 400
    assert "desactivar" in resp.json()["detail"].lower()


# ============================================================================
# 4. CONTROL DE ACCESO POR OBJETO Y VISIBILIDAD (REGLA O+C)
# ============================================================================

@pytest.mark.asyncio
async def test_technician_can_see_own_and_completed_others_and_404_on_open(
    tech_client: AsyncClient,
    tech_client_2: AsyncClient,
):
    """
    Regla D11 / §6.4 (11):
    - Técnico ve sus propias inspecciones.
    - Técnico ve inspecciones COMPLETED de otros técnicos.
    - Si solicita una inspección abierta ajena por ID -> 404 Not Found (cloaking).
    """
    # 1. Técnico 1 inicia una inspección (IN_PROGRESS)
    start_res = await tech_client.post(
        "/api/v1/inspections",
        json={"asset_id": 1, "notes": "Inspección privada de Tec 1"}
    )
    assert start_res.status_code == 201
    insp1_id = start_res.json()["id"]

    # 2. Técnico 2 intenta obtener por ID la inspección abierta de Técnico 1 -> 404 (cloaking)
    get_open_alien = await tech_client_2.get(f"/api/v1/inspections/{insp1_id}")
    assert get_open_alien.status_code == 404

    # 3. Técnico 1 completa la inspección
    await tech_client.put(
        f"/api/v1/inspections/{insp1_id}/batch-responses",
        json={"responses": [{"item_id": 1, "val_numeric": 4.5}, {"item_id": 2, "val_boolean": True}]}
    )
    comp_res = await tech_client.post(f"/api/v1/inspections/{insp1_id}/complete", json={"notes": "Finalizada"})
    assert comp_res.status_code == 200

    # 4. Ahora que está COMPLETED, Técnico 2 puede consultarla por ID -> 200 OK
    get_completed_alien = await tech_client_2.get(f"/api/v1/inspections/{insp1_id}")
    assert get_completed_alien.status_code == 200
    assert get_completed_alien.json()["id"] == insp1_id


@pytest.mark.asyncio
async def test_technician_cannot_modify_other_technician_inspection(
    tech_client: AsyncClient,
    tech_client_2: AsyncClient,
):
    """Técnico 2 no puede guardar respuestas en una inspección de Técnico 1 (403/404)."""
    # Técnico 1 inicia inspección
    start_res = await tech_client.post(
        "/api/v1/inspections",
        json={"asset_id": 1, "notes": "Inspección de Tec 1"}
    )
    insp1_id = start_res.json()["id"]

    # Técnico 2 intenta modificar respuestas
    edit_res = await tech_client_2.put(
        f"/api/v1/inspections/{insp1_id}/batch-responses",
        json={"responses": [{"item_id": 1, "val_numeric": 5.0}]}
    )
    assert edit_res.status_code == 403


@pytest.mark.asyncio
async def test_technician_list_and_history_filters_open_inspections(
    tech_client: AsyncClient,
    tech_client_2: AsyncClient,
):
    """
    Listados de inspecciones e historial de componente:
    - Oculta inspecciones abiertas ajenas al técnico.
    - Muestra inspecciones completadas ajenas.
    - Permite descargar el informe PDF del acta de una completada ajena.
    """
    # 1. Técnico 1 inicia una inspección
    start_res = await tech_client.post("/api/v1/inspections", json={"asset_id": 1, "notes": "Abierta por Tec 1"})
    insp_id = start_res.json()["id"]

    # 2. Técnico 2 lista inspecciones: NO debe figurar insp_id
    list_t2 = await tech_client_2.get("/api/v1/inspections")
    assert list_t2.status_code == 200
    ids_t2 = [i["id"] for i in list_t2.json()]
    assert insp_id not in ids_t2

    # 3. Técnico 2 consulta historial del activo 1: NO debe figurar insp_id
    hist_t2 = await tech_client_2.get("/api/v1/assets/1/history")
    assert hist_t2.status_code == 200
    hist_ids_open = [h["id"] for h in hist_t2.json()]
    assert insp_id not in hist_ids_open

    # 4. Técnico 1 responde y completa la inspección
    await tech_client.put(
        f"/api/v1/inspections/{insp_id}/batch-responses",
        json={"responses": [{"item_id": 1, "val_numeric": 4.6}, {"item_id": 2, "val_boolean": True}]}
    )
    await tech_client.post(f"/api/v1/inspections/{insp_id}/complete")

    # 5. Ahora que está COMPLETED:
    # a) Figura en el listado de inspecciones de Técnico 2
    list_t2_after = await tech_client_2.get("/api/v1/inspections")
    assert insp_id in [i["id"] for i in list_t2_after.json()]

    # b) Figura en el historial del activo de Técnico 2
    hist_t2_after = await tech_client_2.get("/api/v1/assets/1/history")
    assert insp_id in [h["id"] for h in hist_t2_after.json()]

    # c) Técnico 2 puede descargar el acta en PDF
    pdf_res = await tech_client_2.get(f"/api/v1/reports/inspections/{insp_id}/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"


@pytest.mark.asyncio
async def test_supervisor_can_modify_and_complete_technician_inspection(
    tech_client: AsyncClient,
    client: AsyncClient, # supervisor
):
    """Un Supervisor sí puede editar respuestas y completar la inspección abierta de un técnico."""
    # Técnico 1 inicia inspección
    start_res = await tech_client.post("/api/v1/inspections", json={"asset_id": 1, "notes": "Iniciada por tec"})
    insp_id = start_res.json()["id"]

    # Supervisor modifica respuestas (execute_all)
    sup_edit = await client.put(
        f"/api/v1/inspections/{insp_id}/batch-responses",
        json={"responses": [{"item_id": 1, "val_numeric": 4.9}, {"item_id": 2, "val_boolean": True}]}
    )
    assert sup_edit.status_code == 200

    # Supervisor completa la inspección (complete_all)
    sup_complete = await client.post(f"/api/v1/inspections/{insp_id}/complete", json={"notes": "Cerrada por Sup"})
    assert sup_complete.status_code == 200
    comp_json = sup_complete.json()
    assert comp_json["status"] == "COMPLETED"
    assert comp_json["completed_by_id"] is not None


@pytest.mark.asyncio
async def test_auditor_cannot_modify_any_inspection(
    auditor_client: AsyncClient,
    tech_client: AsyncClient,
):
    """El Auditor tiene prohibidas todas las operaciones de modificación (403)."""
    # 1. Iniciar inspección -> 403
    start_res = await auditor_client.post("/api/v1/inspections", json={"asset_id": 1})
    assert start_res.status_code == 403

    # Técnico crea una inspección válida para probar escrituras del auditor
    ok_start = await tech_client.post("/api/v1/inspections", json={"asset_id": 1})
    insp_id = ok_start.json()["id"]

    # 2. Cargar respuestas -> 403
    put_resp = await auditor_client.put(
        f"/api/v1/inspections/{insp_id}/batch-responses",
        json={"responses": [{"item_id": 1, "val_numeric": 4.5}]}
    )
    assert put_resp.status_code == 403

    # 3. Subir evidencia -> 403
    fake_file = io.BytesIO(b"\xFF\xD8\xFF\xE0" + b"Foto" * 10)
    up_resp = await auditor_client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("foto.jpg", fake_file, "image/jpeg")}
    )
    assert up_resp.status_code == 403

    # 4. Cerrar inspección -> 403
    comp_resp = await auditor_client.post(f"/api/v1/inspections/{insp_id}/complete")
    assert comp_resp.status_code == 403


# ============================================================================
# 5. AISLAMIENTO MULTI-HOSPITAL
# ============================================================================

@pytest.mark.asyncio
async def test_multi_hospital_strict_isolation(
    client: AsyncClient, # Supervisor Hospital 1
    supervisor_b_client: AsyncClient, # Supervisor Hospital 2 (B)
    tech_b_client: AsyncClient, # Técnico Hospital 2 (B)
    admin_client: AsyncClient # Admin Global
):
    """Los recursos de Hospital A y B están completamente aislados entre sí."""
    # 1. Supervisor A consulta jerarquía: solo ve Hospital 1
    hier_a = await client.get("/api/v1/hierarchy")
    assert hier_a.status_code == 200
    h_a_codes = [h["code"] for h in hier_a.json()["hospitals"]]
    assert "H-TEST" in h_a_codes
    assert "H-TEST-B" not in h_a_codes

    # 2. Supervisor B consulta jerarquía: solo ve Hospital 2
    hier_b = await supervisor_b_client.get("/api/v1/hierarchy")
    assert hier_b.status_code == 200
    h_b_codes = [h["code"] for h in hier_b.json()["hospitals"]]
    assert "H-TEST-B" in h_b_codes
    assert "H-TEST" not in h_b_codes

    # 3. Supervisor A intenta iniciar inspección en activo de Hospital B (asset 3) -> 404
    cross_insp = await client.post(
        "/api/v1/inspections",
        json={"asset_id": 3, "notes": "Intento de cruce"}
    )
    assert cross_insp.status_code == 404

    # 4. Técnico B inicia inspección en Hospital B (asset 3) -> 201
    insp_b_res = await tech_b_client.post("/api/v1/inspections", json={"asset_id": 3})
    assert insp_b_res.status_code == 201
    insp_b_id = insp_b_res.json()["id"]

    # 5. Supervisor A intenta acceder a la inspección de Hospital B -> 404 Not Found
    get_cross_insp = await client.get(f"/api/v1/inspections/{insp_b_id}")
    assert get_cross_insp.status_code == 404

    # 6. Admin global ve ambos hospitales
    hier_admin = await admin_client.get("/api/v1/hierarchy")
    assert hier_admin.status_code == 200
    admin_codes = [h["code"] for h in hier_admin.json()["hospitals"]]
    assert "H-TEST" in admin_codes
    assert "H-TEST-B" in admin_codes


# ============================================================================
# 6. INMUTABILIDAD DE INSPECCIONES CERRADAS (REGLA DE ORO #1)
# ============================================================================

@pytest.mark.asyncio
async def test_completed_inspection_is_strictly_immutable_even_for_admin(
    admin_client: AsyncClient,
    tech_client: AsyncClient,
):
    """Regla #1: una vez COMPLETED, nadie (ni ADMIN) puede editar respuestas ni alterar evidencias."""
    # 1. Crear y completar inspección con una evidencia
    start_res = await tech_client.post("/api/v1/inspections", json={"asset_id": 1})
    insp_id = start_res.json()["id"]

    fake_file = io.BytesIO(b"\xFF\xD8\xFF\xE0" + b"Evidencia" * 10)
    upload_res = await tech_client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("foto.jpg", fake_file, "image/jpeg")}
    )
    ev_id = upload_res.json()["id"]

    await tech_client.put(
        f"/api/v1/inspections/{insp_id}/batch-responses",
        json={"responses": [{"item_id": 1, "val_numeric": 4.5}, {"item_id": 2, "val_boolean": True}]}
    )
    await tech_client.post(f"/api/v1/inspections/{insp_id}/complete")

    # 2. Admin intenta modificar respuestas -> 400 Bad Request
    admin_edit = await admin_client.put(
        f"/api/v1/inspections/{insp_id}/batch-responses",
        json={"responses": [{"item_id": 1, "val_numeric": 5.2}]}
    )
    assert admin_edit.status_code == 400

    # 3. Admin intenta subir nueva evidencia -> 400 Bad Request
    extra_file = io.BytesIO(b"\xFF\xD8\xFF\xE0" + b"Extra" * 10)
    admin_upload = await admin_client.post(
        f"/api/v1/inspections/{insp_id}/evidence",
        files={"file": ("extra.jpg", extra_file, "image/jpeg")}
    )
    assert admin_upload.status_code == 400

    # 4. Admin intenta eliminar evidencia existente -> 400 Bad Request
    admin_delete = await admin_client.delete(f"/api/v1/evidence/{ev_id}")
    assert admin_delete.status_code == 400


# ============================================================================
# 7. CATÁLOGO DE NORMATIVAS: EDICIÓN EXCLUSIVA DE ADMIN
# ============================================================================

@pytest.mark.asyncio
async def test_normatives_modification_restricted_to_admin(
    client: AsyncClient, # Supervisor
    admin_client: AsyncClient,
    db_session: AsyncSession,
):
    """Solo ADMIN puede actualizar el catálogo de normativas (normatives:write)."""
    res = await db_session.execute(select(NormativeReference).where(NormativeReference.code == "ISO 7396-1:2016"))
    norm = res.scalars().first()
    if not norm:
        norm = NormativeReference(
            code="ISO 7396-1:2016",
            title="Sistemas de canalización de gases medicinales",
            issuing_body="ISO",
            current_version="2016",
            is_current=True,
            description="Original",
        )
        db_session.add(norm)
        await db_session.commit()
    norm_id = norm.id

    # 1. Supervisor intenta modificar normativa -> 403 Forbidden
    sup_put = await client.put(
        f"/api/v1/normatives/{norm_id}",
        json={"description": "Intento de modificación por supervisor"}
    )
    assert sup_put.status_code == 403

    # 2. Admin modifica la normativa -> 200 OK
    admin_put = await admin_client.put(
        f"/api/v1/normatives/{norm_id}",
        json={"description": "Actualización oficial por Administrador"}
    )
    assert admin_put.status_code == 200


# ============================================================================
# 8. AUDITOR: SOLO LECTURA EN COMPLIANCE (SIN EFECTOS COLATERALES)
# ============================================================================

@pytest.mark.asyncio
async def test_auditor_compliance_is_read_only_and_does_not_mutate_db(
    auditor_client: AsyncClient,
    tech_client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Auditor consulta compliance en solo lectura (recalculate=false):
    - Retorna 200 OK
    - NO inserta ni modifica filas en compliance_results
    - NO inserta eventos de auditoría de validación
    - Si intenta forzar recálculo (recalculate=true) -> 403 Forbidden
    """
    # Iniciar y responder inspección
    start_res = await tech_client.post("/api/v1/inspections", json={"asset_id": 1})
    insp_id = start_res.json()["id"]

    await tech_client.put(
        f"/api/v1/inspections/{insp_id}/batch-responses",
        json={"responses": [{"item_id": 1, "val_numeric": 4.8}, {"item_id": 2, "val_boolean": True}]}
    )

    # Conteo previo en base de datos
    cr_count_before = (await db_session.execute(select(func.count(ComplianceResult.id)))).scalar() or 0
    al_count_before = (await db_session.execute(
        select(func.count(AuditLog.id)).where(AuditLog.event_type.in_([AuditEventType.VALIDATION_RUN, AuditEventType.COMPLIANCE_CHECK]))
    )).scalar() or 0

    # 1. Auditor consulta compliance en modo lectura (recalculate=false) -> 200 OK
    audit_get = await auditor_client.get(f"/api/v1/inspections/{insp_id}/compliance?recalculate=false")
    assert audit_get.status_code == 200
    comp_data = audit_get.json()
    assert "compliance_percentage" in comp_data

    # Conteo posterior en base de datos: DEBE SER IDÉNTICO (0 mutaciones)
    cr_count_after = (await db_session.execute(select(func.count(ComplianceResult.id)))).scalar() or 0
    al_count_after = (await db_session.execute(
        select(func.count(AuditLog.id)).where(AuditLog.event_type.in_([AuditEventType.VALIDATION_RUN, AuditEventType.COMPLIANCE_CHECK]))
    )).scalar() or 0

    assert cr_count_after == cr_count_before, "La consulta del Auditor no debe alterar compliance_results"
    assert al_count_after == al_count_before, "La consulta del Auditor no debe generar eventos de validación"

    # 2. Auditor intenta forzar recálculo persistente (recalculate=true) -> 403 Forbidden
    audit_recalc = await auditor_client.get(f"/api/v1/inspections/{insp_id}/compliance?recalculate=true")
    assert audit_recalc.status_code == 403


# ============================================================================
# 9. TICKETS SSE Y URLS FIRMADAS PARA EVIDENCIA
# ============================================================================

@pytest.mark.asyncio
async def test_sse_stream_ticket_and_url_signing(
    tech_client: AsyncClient,
    anon_client: AsyncClient,
):
    """Generación de ticket temporal para SSE y verificación de URLs firmadas para archivos locales."""
    # 1. Solicitar ticket para SSE
    ticket_res = await tech_client.post("/api/v1/auth/stream-ticket")
    assert ticket_res.status_code == 200
    ticket = ticket_res.json()["ticket"]
    assert len(ticket) > 20

    # 2. Intento de conectar a stream SSE sin ticket y sin header -> 401
    no_auth_sse = await anon_client.get("/api/v1/alerts/stream")
    assert no_auth_sse.status_code == 401

    # 3. Intento de conectar con ticket alterado o inválido -> 401
    bad_ticket_sse = await anon_client.get("/api/v1/alerts/stream?ticket=ticket_invalido_123")
    assert bad_ticket_sse.status_code == 401

    # 4. URL firmada HMAC para archivo local
    fake_path = "inspections/1/foto.jpg"
    signed_query = sign_file_url(fake_path)
    assert "exp=" in signed_query
    assert "sig=" in signed_query

    # Validación unitaria de verify_file_signature
    exp_val = int(signed_query.split("exp=")[1].split("&")[0])
    sig_val = signed_query.split("sig=")[1]
    assert verify_file_signature(fake_path, exp_val, sig_val) is True
    assert verify_file_signature(fake_path, exp_val - 100000, sig_val) is False
    assert verify_file_signature(fake_path, exp_val, "bad_sig") is False

    # 5. Intento de acceder a la URL firmada con firma alterada -> 403
    bad_url = f"/api/v1/evidence/file/{fake_path}{signed_query}".replace("sig=", "sig=invalid_signature_")
    bad_res = await anon_client.get(bad_url)
    assert bad_res.status_code == 403

    # 6. Intento de acceder sin firma ni exp -> 403
    unsigned_res = await anon_client.get(f"/api/v1/evidence/file/{fake_path}")
    assert unsigned_res.status_code == 403
