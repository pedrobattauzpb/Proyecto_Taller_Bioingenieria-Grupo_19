import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.core.database import Base, get_db
from app.models.hierarchy import Hospital, Sector, Asset, AssetType
from app.models.checklist import ChecklistTemplate, ChecklistItem, ItemType
from app.db.seed_data import seed_database

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    future=True
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)




@pytest.fixture(scope="function")
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        # Sembrar datos iniciales en la base de prueba en memoria
        # Hospital
        hospital = Hospital(name="Hospital Test", code="H-TEST", address="Calle Test 123")
        session.add(hospital)
        await session.flush()

        sector = Sector(hospital_id=hospital.id, name="Sector Quirófanos", floor_level="Piso 1")
        session.add(sector)
        await session.flush()

        asset_manifold = Asset(sector_id=sector.id, tag_code="TEST-MAN-01", name="Manifold O2 Test", asset_type=AssetType.MANIFOLD)
        asset_cylinder = Asset(sector_id=sector.id, tag_code="TEST-CIL-01", name="Cilindro O2 Test", asset_type=AssetType.GAS_CYLINDER)
        session.add_all([asset_manifold, asset_cylinder])
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

        await session.commit()
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session):
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

