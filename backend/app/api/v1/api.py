from fastapi import APIRouter
from app.api.v1.endpoints import hierarchy, checklists, inspections, stats, compliance, normatives

api_router = APIRouter()

api_router.include_router(hierarchy.router, prefix="/hierarchy", tags=["Jerarquía Hospitalaria"])
api_router.include_router(checklists.router, prefix="/checklists", tags=["Plantillas y Checklists"])
api_router.include_router(inspections.router, prefix="/inspections", tags=["Inspecciones Digitales"])
api_router.include_router(compliance.router, prefix="", tags=["Auditoría y Compliance en Tiempo Real"])
api_router.include_router(normatives.router, prefix="/normatives", tags=["Catálogo de Normativas y Vigencia"])
api_router.include_router(stats.router, prefix="", tags=["Métricas e Historial"])

