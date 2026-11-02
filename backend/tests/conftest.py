import os
os.environ.setdefault("ALERTS_SCHEDULER_ENABLED", "False")
os.environ.setdefault("ALERTS_DISPATCH_SYNC", "True")

import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from app.main import app
from app.core.database import Base, get_db
from app.models.hierarchy import Hospital, Sector, Asset, AssetType
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.models.user import User, UserRole
from app.core.security import hash_password, create_access_token

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    future=True,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="function")
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        # Sembrar datos iniciales en la base de prueba en memoria
        # Hospital Principal
        hospital = Hospital(name="Hospital Test", code="H-TEST", address="Calle Test 123")
        # Hospital Secundario (para pruebas de aislamiento multi-tenant)
        hospital_b = Hospital(name="Hospital Test B", code="H-TEST-B", address="Av. Secundaria 456")
        session.add_all([hospital, hospital_b])
        await session.flush()

        sector = Sector(hospital_id=hospital.id, name="Sector Quirófanos", floor_level="Piso 1")
        sector_b = Sector(hospital_id=hospital_b.id, name="Sector Quirófanos B", floor_level="Piso 2")
        session.add_all([sector, sector_b])
        await session.flush()

        asset_manifold = Asset(sector_id=sector.id, tag_code="TEST-MAN-01", name="Manifold O2 Test", asset_type=AssetType.MANIFOLD)
        asset_cylinder = Asset(sector_id=sector.id, tag_code="TEST-CIL-01", name="Cilindro O2 Test", asset_type=AssetType.GAS_CYLINDER)
        asset_manifold_b = Asset(sector_id=sector_b.id, tag_code="TEST-MAN-B01", name="Manifold O2 Test B", asset_type=AssetType.MANIFOLD)
        session.add_all([asset_manifold, asset_cylinder, asset_manifold_b])
        await session.flush()

        # Plantilla Manifold
        tmpl_m = ChecklistTemplate(title="Template Manifold Test", asset_type=AssetType.MANIFOLD, version="1.0", is_active=True)
        session.add(tmpl_m)
        await session.flush()

        item_m1 = ChecklistItem(
            template_id=tmpl_m.id, order_index=1, code="M-01", title="Presión Colector",
            input_type=ItemType.NUMERIC, unit="bar", is_mandatory=True,
            referencia_normativa="ISO 7396-1:cl.5.3", min_value=4.0, max_value=5.5
        )
        item_m2 = ChecklistItem(
            template_id=tmpl_m.id, order_index=2, code="M-02", title="Alarma Presión",
            input_type=ItemType.BOOLEAN, is_mandatory=True,
            referencia_normativa="ISO 7396-1:cl.6.2"
        )
        session.add_all([item_m1, item_m2])

        # Plantilla Cilindro Res. 1130/2000
        tmpl_c = ChecklistTemplate(title="Template Cilindros Test", asset_type=AssetType.GAS_CYLINDER, version="1.0", is_active=True)
        session.add(tmpl_c)
        await session.flush()

        item_c1 = ChecklistItem(
            template_id=tmpl_c.id, order_index=1, code="C-01", title="Cruz Griega Verde",
            input_type=ItemType.BOOLEAN, is_mandatory=True,
            referencia_normativa="Res1130/2000:1.2.2.a"
        )
        item_c2 = ChecklistItem(
            template_id=tmpl_c.id, order_index=2, code="C-02", title="Presión Carga Remanente",
            input_type=ItemType.NUMERIC, unit="bar", is_mandatory=True,
            referencia_normativa="Res1130/2000:1.2.2.c", min_value=50.0, max_value=200.0
        )
        session.add_all([item_c1, item_c2])

        # Usuarios para pruebas de roles y seguridad
        pwd_hash = hash_password("Demo2026!")

        admin = User(
            email="admin@hospital.gob.ar",
            full_name="Administrador General",
            hashed_password=pwd_hash,
            role=UserRole.ADMIN,
            is_active=True,
            has_global_scope=True,
            must_change_password=False,
        )
        supervisor = User(
            email="supervisor@hospital.gob.ar",
            full_name="Ing. Laura Supervisor",
            hashed_password=pwd_hash,
            role=UserRole.SUPERVISOR,
            is_active=True,
            must_change_password=False,
            hospitals=[hospital],
        )
        tecnico = User(
            email="tecnico@hospital.gob.ar",
            full_name="Tec. Juan Pérez",
            hashed_password=pwd_hash,
            role=UserRole.TECHNICIAN,
            is_active=True,
            must_change_password=False,
            hospitals=[hospital],
        )
        tecnico2 = User(
            email="tecnico2@hospital.gob.ar",
            full_name="Tec. Martín Gómez",
            hashed_password=pwd_hash,
            role=UserRole.TECHNICIAN,
            is_active=True,
            must_change_password=False,
            hospitals=[hospital],
        )
        auditor = User(
            email="auditor@hospital.gob.ar",
            full_name="Dra. Carmen Auditor",
            hashed_password=pwd_hash,
            role=UserRole.AUDITOR,
            is_active=True,
            must_change_password=False,
            hospitals=[hospital],
        )
        supervisor_b = User(
            email="supervisor.b@hospital.gob.ar",
            full_name="Ing. Roberto B",
            hashed_password=pwd_hash,
            role=UserRole.SUPERVISOR,
            is_active=True,
            must_change_password=False,
            hospitals=[hospital_b],
        )
        tecnico_b = User(
            email="tecnico.b@hospital.gob.ar",
            full_name="Tec. Lucas B",
            hashed_password=pwd_hash,
            role=UserRole.TECHNICIAN,
            is_active=True,
            must_change_password=False,
            hospitals=[hospital_b],
        )

        session.add_all([admin, supervisor, tecnico, tecnico2, auditor, supervisor_b, tecnico_b])
        await session.commit()
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def _make_client_for_user(user: User, db_session: AsyncSession):
    from app.core.config import settings
    from app.services.storage import storage_service

    orig_backend = settings.STORAGE_BACKEND
    settings.STORAGE_BACKEND = "local"
    storage_service.backend = "local"
    storage_service.s3_client = None

    token = create_access_token(user)
    headers = {"Authorization": f"Bearer {token}"}

    async def override_get_db():
        yield db_session

    return headers, override_get_db, orig_backend


@pytest.fixture(scope="function")
async def client(db_session):
    """Cliente autenticado como SUPERVISOR (mantiene compatibilidad con tests existentes)."""
    res = await db_session.execute(select(User).where(User.email == "supervisor@hospital.gob.ar"))
    user = res.scalar_one()

    headers, override_get_db, orig_backend = _make_client_for_user(user, db_session)
    app.dependency_overrides[get_db] = override_get_db

    from app.core.config import settings
    from app.services.storage import storage_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
        yield c

    app.dependency_overrides.clear()
    settings.STORAGE_BACKEND = orig_backend


@pytest.fixture(scope="function")
async def supervisor_client(client):
    """Alias explícito para el cliente Supervisor."""
    yield client


@pytest.fixture(scope="function")
async def admin_client(db_session):
    """Cliente autenticado como ADMIN."""
    res = await db_session.execute(select(User).where(User.email == "admin@hospital.gob.ar"))
    user = res.scalar_one()

    headers, override_get_db, orig_backend = _make_client_for_user(user, db_session)
    app.dependency_overrides[get_db] = override_get_db

    from app.core.config import settings
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
        yield c

    app.dependency_overrides.clear()
    settings.STORAGE_BACKEND = orig_backend


@pytest.fixture(scope="function")
async def tech_client(db_session):
    """Cliente autenticado como TECHNICIAN (tecnico)."""
    res = await db_session.execute(select(User).where(User.email == "tecnico@hospital.gob.ar"))
    user = res.scalar_one()

    headers, override_get_db, orig_backend = _make_client_for_user(user, db_session)
    app.dependency_overrides[get_db] = override_get_db

    from app.core.config import settings
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
        yield c

    app.dependency_overrides.clear()
    settings.STORAGE_BACKEND = orig_backend


@pytest.fixture(scope="function")
async def tech_client_2(db_session):
    """Cliente autenticado como TECHNICIAN 2 (tecnico2)."""
    res = await db_session.execute(select(User).where(User.email == "tecnico2@hospital.gob.ar"))
    user = res.scalar_one()

    headers, override_get_db, orig_backend = _make_client_for_user(user, db_session)
    app.dependency_overrides[get_db] = override_get_db

    from app.core.config import settings
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
        yield c

    app.dependency_overrides.clear()
    settings.STORAGE_BACKEND = orig_backend


@pytest.fixture(scope="function")
async def auditor_client(db_session):
    """Cliente autenticado como AUDITOR."""
    res = await db_session.execute(select(User).where(User.email == "auditor@hospital.gob.ar"))
    user = res.scalar_one()

    headers, override_get_db, orig_backend = _make_client_for_user(user, db_session)
    app.dependency_overrides[get_db] = override_get_db

    from app.core.config import settings
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
        yield c

    app.dependency_overrides.clear()
    settings.STORAGE_BACKEND = orig_backend


@pytest.fixture(scope="function")
async def supervisor_b_client(db_session):
    """Cliente autenticado como SUPERVISOR del Hospital B."""
    res = await db_session.execute(select(User).where(User.email == "supervisor.b@hospital.gob.ar"))
    user = res.scalar_one()

    headers, override_get_db, orig_backend = _make_client_for_user(user, db_session)
    app.dependency_overrides[get_db] = override_get_db

    from app.core.config import settings
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
        yield c

    app.dependency_overrides.clear()
    settings.STORAGE_BACKEND = orig_backend


@pytest.fixture(scope="function")
async def tech_b_client(db_session):
    """Cliente autenticado como TECHNICIAN del Hospital B."""
    res = await db_session.execute(select(User).where(User.email == "tecnico.b@hospital.gob.ar"))
    user = res.scalar_one()

    headers, override_get_db, orig_backend = _make_client_for_user(user, db_session)
    app.dependency_overrides[get_db] = override_get_db

    from app.core.config import settings
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as c:
        yield c

    app.dependency_overrides.clear()
    settings.STORAGE_BACKEND = orig_backend



@pytest.fixture(scope="function")
async def anon_client(db_session):
    """Cliente anónimo (sin cabecera Authorization)."""
    from app.core.config import settings
    from app.services.storage import storage_service

    orig_backend = settings.STORAGE_BACKEND
    settings.STORAGE_BACKEND = "local"
    storage_service.backend = "local"
    storage_service.s3_client = None

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
    settings.STORAGE_BACKEND = orig_backend
