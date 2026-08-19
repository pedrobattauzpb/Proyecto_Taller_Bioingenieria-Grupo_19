# Protocolo de Inspección Digital de Gases Medicinales

Sistema integral (GMAO / CMMS) para digitalizar, estandarizar y auditar el estado de las instalaciones hospitalarias y redes de distribución de gases medicinales (Oxígeno, Aire Medicinal, Vacío, Óxido Nitroso) bajo normativas **Resolución 1130/2000 del Ministerio de Salud de la Nación** y norma **ISO 7396-1:2016**.

## 🚀 Alcance de la Fase 1 (Objetivo Específico 1)
- **Módulo de Listas de Verificación Digital e Inspecciones**
- Soporte multiplataforma: **Escritorio PC / Laptop** (gestión y auditoría) y **Dispositivos Móviles** (carga ágil en campo con controles táctiles).
- **Trazabilidad Normativa Explícita (`NormativeBadge`)**: Cada ítem de checklist está indexado a su cláusula de origen (Res. 1130/2000 e ISO 7396-1).
- **Control de Cilindros/Envases (`GAS_CYLINDER`)**: Verificación de cruz griega verde, prueba hidráulica, rotulado y conexiones reglamentarias.
- **Auto-guardado en segundo plano** con debounce y validación de rangos de presión (`min_value` y `max_value`).

---

## 🛠️ Stack Tecnológico

- **Frontend:** React Native con Expo (Expo Router + Expo Web), TypeScript, Lucide Icons, diseño clínico adaptativo.
- **Backend:** Python 3.11+ con FastAPI (asíncrono), Pydantic v2, SQLAlchemy 2.0.
- **Base de Datos:** PostgreSQL 16 / SQLite (desarrollo local) con migraciones Alembic.
- **Infraestructura:** Docker Compose.

---

## 📦 Puesta en Marcha

### Opción 1: Ejecución con Docker Compose (PostgreSQL + FastAPI)

```bash
docker-compose up --build
```
- **Backend API:** `http://localhost:8000`
- **Swagger Docs:** `http://localhost:8000/api/v1/docs`

---

### Opción 2: Ejecución Local en Desarrollo

#### 1. Backend (FastAPI)
```bash
cd backend
source .venv/bin/activate
alembic upgrade head
python -m app.db.seed_data
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend (Expo Web / Mobile)
```bash
cd frontend
pnpm web
# o pnpm start para abrir en Expo Go (Android / iOS)
```
- La aplicación se abrirá en `http://localhost:8081`.

---

## 🧪 Pruebas Automatizadas

```bash
cd backend
source .venv/bin/activate
pytest -v
```

---

## 📋 Endpoints de la API v1

- `GET /api/v1/hierarchy`: Árbol jerárquico (`Hospital` -> `Sectores` -> `Activos`) con métricas.
- `GET /api/v1/checklists/template?asset_type={type}`: Obtiene plantilla activa según tipo de activo (`MANIFOLD`, `AVSU_VALVE`, `TERMINAL_UNIT`, `PRESSURE_REGULATOR`, `GAS_CYLINDER`).
- `POST /api/v1/inspections`: Inicia una sesión de inspección vinculada a un activo.
- `PUT /api/v1/inspections/{id}/batch-responses`: Guardado y actualización atómica por lotes con auto-guardado debounce.
- `POST /api/v1/inspections/{id}/complete`: Cierre, firma y validación de completitud de la inspección.
- `GET /api/v1/inspections/{id}`: Detalle completo de la inspección, ítems evaluados y respuestas.
- `GET /api/v1/assets/{id}/history`: Historial cronológico de inspecciones de un activo.
- `GET /api/v1/stats`: Métricas generales resumidas de actividad clínica.
