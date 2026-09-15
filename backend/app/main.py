from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import async_engine, Base
from app.api.v1.api import api_router
from app.db.init_db import init_db_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    # En desarrollo local o SQLite, crear tablas automáticamente si no existen
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Cargar datos semilla si la base está vacía
    await init_db_data()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API para el Protocolo de Inspección Digital de Gases Medicinales (Res. MSAL 1130/2000 e ISO 7396-1)",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# Configuración de CORS para clientes Web y Móvil
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS if settings.BACKEND_CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health Check"])
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs_url": f"{settings.API_V1_STR}/docs"
    }


@app.get("/health", tags=["Health Check"])
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG
    }
