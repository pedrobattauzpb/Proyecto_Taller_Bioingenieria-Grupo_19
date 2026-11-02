from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    users,
    hierarchy,
    checklists,
    inspections,
    stats,
    compliance,
    normatives,
    evidence,
    reports,
    alerts,
    notifications,
)

api_router = APIRouter()

api_router.include_router(auth.auth_router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(users.users_router, prefix="/users", tags=["Usuarios"])
api_router.include_router(users.roles_router, prefix="/roles", tags=["Roles"])

api_router.include_router(hierarchy.router, prefix="/hierarchy", tags=["Jerarquía Hospitalaria"])
api_router.include_router(checklists.router, prefix="/checklists", tags=["Plantillas y Checklists"])
api_router.include_router(inspections.router, prefix="/inspections", tags=["Inspecciones Digitales"])
api_router.include_router(compliance.router, prefix="", tags=["Auditoría y Compliance en Tiempo Real"])
api_router.include_router(normatives.router, prefix="/normatives", tags=["Catálogo de Normativas y Vigencia"])
api_router.include_router(stats.router, prefix="", tags=["Métricas e Historial"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["Evidencia Multimedia"])
api_router.include_router(reports.router, prefix="", tags=["Reportes Técnicos y Normativos"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alertas y Notificaciones"])
api_router.include_router(alerts.asset_router, prefix="/assets", tags=["Alertas y Notificaciones"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Configuración de Notificaciones"])
