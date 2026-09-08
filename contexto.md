# Protocolo de Inspección Digital de Gases Medicinales
## Contexto, Arquitectura y Especificación Técnica del Proyecto (Grupo 19)

---

### 1. 🎯 Propósito y Dominio del Sistema

El proyecto consiste en un sistema **GMAO / CMMS (Gestión de Mantenimiento Asistido por Ordenador)** diseñado específicamente para el ámbito de la **Bioingeniería Hospitalaria e Ingeniería Clínica**.

Su objetivo principal es digitalizar, estandarizar y auditar de forma integral las **inspecciones técnicas y listas de verificación (checklists)** en redes e instalaciones de distribución de gases medicinales (Oxígeno $O_2$, Aire Medicinal, Vacío y Óxido Nitroso $N_2O$).

#### 📜 Marcos Normativos Integrados
1. **Resolución MSAL 1130/2000 (Ministerio de Salud de la Nación Argentina)**:
   - Buenas Prácticas de Fabricación y Control de Gases Medicinales.
   - Requisitos de envases y cilindros a presión: prueba hidráulica periódica (IRAM 2529, vigencia máx. 5 años), rotulado con nombre genérico, lote, vencimiento, leyenda *"Uso Exclusivo Medicinal"*, identificación visual obligatoria con **cruz griega verde**, código cromático reglamentario y válvulas no intercambiables con precinto termocontraíble.
2. **Norma ISO 7396-1:2016 (Sistemas de distribución de gases medicinales)**:
   - Requerimientos de seguridad para redes de tuberías de gases comprimidos y vacío.
   - Protocolos para manifolds centrales de suministro (baterías y conmutación automática), válvulas de corte de área (AVSU), bocas terminales/tomas rápidas y unidades de regulación de presión en 1ra y 2da etapa.

---

### 2. 🏗️ Arquitectura General y Estructura del Repositorio

El proyecto está configurado como un monorepo desacoplado:

```
Proyecto_Taller_Bioingenieria-Grupo_19/
├── backend/                  # API REST asíncrona en Python con FastAPI
│   ├── alembic/              # Control de versiones de base de datos
│   │   └── versions/         # Migración inicial de tablas clínicas y normativas
│   ├── app/
│   │   ├── api/v1/           # Routers y controladores HTTP:
│   │   │   ├── hierarchy.py  # Árbol de Hospitales -> Sectores -> Activos
│   │   │   ├── checklists.py # Consulta de plantillas normativas e ítems
│   │   │   ├── inspections.py# Ciclo de vida de inspecciones (create, batch, complete)
│   │   │   └── stats.py      # Indicadores y KPIs hospitalarios
│   │   ├── core/             # Configuración (pydantic-settings), CORS y conexión a BD
│   │   ├── db/               # Inicializador de datos y seed normativo completo
│   │   ├── models/           # Declaración ORM (SQLAlchemy 2.0 Async):
│   │   │   ├── hierarchy.py  # Hospital, Sector, Asset, AssetType
│   │   │   ├── checklist.py  # ChecklistTemplate, ChecklistItem, ItemType
│   │   │   └── inspection.py # Inspection, InspectionResponse, InspectionStatus
│   │   └── schemas/          # Modelos de validación y serialización Pydantic v2
│   ├── tests/                # Pruebas automatizadas (test_api.py con pytest-asyncio)
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                 # Aplicación multiplataforma (Web / Tablet / Móvil)
│   ├── app/                  # Navegación basada en archivos (Expo Router v4)
│   │   ├── index.tsx         # Redirección inicial hacia el Dashboard
│   │   ├── dashboard.tsx     # Vista principal: KPIs, selector jerárquico e inicio rápido
│   │   ├── history.tsx       # Módulo de auditoría, trazabilidad y búsqueda histórica
│   │   └── inspections/
│   │       └── [id].tsx      # Pantalla interactiva de checklist y ejecución en campo
│   ├── components/
│   │   ├── checklist/        # ChecklistCard, AutoSaveIndicator, NormativeBadge
│   │   ├── hierarchy/        # Selector jerárquico desplegable (Hospital -> Sector -> Activo)
│   │   ├── layout/           # Header y Sidebar responsivos
│   │   └── ui/               # Componentes atómicos (Button, Card, Badge, Input, ProgressBar)
│   ├── services/             # api.ts (cliente Axios centralizado) y types.ts (interfaces TypeScript)
│   └── package.json
│
├── docker-compose.yml        # Orquestación de contenedores (PostgreSQL 16 + FastAPI)
├── .env.example              # Variables de entorno modelo
├── README.md                 # Documentación inicial del proyecto
└── contexto.md               # Este documento de especificación integral
```

---

### 3. 🗄️ Modelo de Datos y Jerarquía Clínica

#### Jerarquía de Activos Hospitalarios
- **Hospital**: Identificador, nombre, código oficial y dirección.
- **Sector**: Áreas físicas/funcionales vinculadas a un hospital (p. ej. *Manifold Central*, *UTI Adultos*, *Quirófanos Centrales*, *Guardia de Emergencias*).
- **Asset (Activo)**: Equipo o punto de red controlado. Clasificado por `AssetType`:
  - `MANIFOLD`: Centrales de suministro y bancadas de tubos.
  - `AVSU_VALVE`: Válvulas de corte de área para sectorización y emergencias.
  - `TERMINAL_UNIT`: Bocas terminales de pared o columnas de consumo.
  - `PRESSURE_REGULATOR`: Estaciones reguladoras de presión.
  - `GAS_CYLINDER`: Cilindros y tubos de gases comprimidos fijos o portátiles.

#### Sistema de Checklists Normativos
- **ChecklistTemplate**: Plantilla asociada a un tipo de activo, versionada y con estado activo/inactivo.
- **ChecklistItem**:
  - `input_type`: `BOOLEAN` (Pasa / No Pasa), `NUMERIC` (con tolerancias `min_value` y `max_value` en unidad `bar`), o `TEXT`.
  - `referencia_normativa`: Código directo de la norma (ej: `ISO 7396-1:cl.5.3`, `Res1130/2000:1.2.2.a`).
  - `is_mandatory`: Obligatoriedad técnica del ítem.

#### Ciclo de Inspección
- **Inspection**:
  - Estado (`InspectionStatus`): `DRAFT` -> `IN_PROGRESS` -> `COMPLETED`.
  - Fechas de inicio y cierre, nombre del inspector actuante y notas globales.
- **InspectionResponse**:
  - Respuesta individual por ítem con valores tipados (`val_boolean`, `val_numeric`, `val_text`) y campo libre de observaciones técnicas.

---

### 4. ⚙️ Reglas de Negocio y Flujo de Trabajo

1. **Selección de Activo e Inicio:**
   - El usuario selecciona un activo en el selector jerárquico del Dashboard e inicia la inspección.
   - La API asocia automáticamente la plantilla normativa vigente para el tipo de activo correspondiente.
2. **Auto-guardado en Segundo Plano (Debounce):**
   - En el frontend, cada respuesta disparada actualiza el estado local y activa un temporizador *debounce* (500 ms).
   - Los cambios se envían por lotes al endpoint `PUT /api/v1/inspections/{id}/batch-responses`.
   - El componente `AutoSaveIndicator` muestra visualmente el estado: *Guardando...*, *Guardado*, o *Error de sincronización*.
3. **Validación de Rangos y Parámetros Críticos:**
   - Para ítems numéricos (como presiones de línea o de prueba), se compara con `min_value` y `max_value`, alertando al inspector si el valor medido está fuera de norma.
4. **Cierre, Validación y Congelamiento:**
   - Al solicitar el cierre de la inspección (`POST /api/v1/inspections/{id}/complete`), el backend valida que **todos** los ítems obligatorios (`is_mandatory = True`) hayan sido evaluados.
   - Si faltan ítems, la API responde con código `422 Unprocessable Entity` listando los identificadores faltantes.
   - Al completarse con éxito, se sella la fecha `completed_at`, el estado pasa a `COMPLETED` y queda bloqueada la edición de respuestas.
5. **Auditoría e Historial:**
   - Los registros quedan disponibles en la pantalla de historial y a través de `GET /api/v1/assets/{id}/history` para trazabilidad ante auditorías ministeriales o de calidad hospitalaria.

---

### 5. 🔌 Endpoints de la API v1

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/health` | Chequeo de estado del servicio y ambiente. |
| `GET` | `/api/v1/hierarchy` | Árbol completo (Hospitales -> Sectores -> Activos) con métricas globales. |
| `GET` | `/api/v1/checklists/template?asset_type={type}` | Obtiene la plantilla activa según el tipo de activo. |
| `GET` | `/api/v1/checklists/templates` | Lista todas las plantillas disponibles en el sistema. |
| `POST`| `/api/v1/inspections` | Inicia una nueva sesión de inspección para un activo. |
| `GET` | `/api/v1/inspections/{id}` | Obtiene el detalle de la inspección, ítems del template y respuestas actuales. |
| `PUT` | `/api/v1/inspections/{id}/batch-responses` | Guarda/actualiza respuestas en lote con debounce. |
| `POST`| `/api/v1/inspections/{id}/complete` | Cierra y sella la inspección tras validar obligatoriedad. |
| `GET` | `/api/v1/inspections` | Lista inspecciones con filtros opcionales de estado y paginación. |
| `GET` | `/api/v1/assets/{id}/history` | Historial cronológico de inspecciones de un activo específico. |
| `GET` | `/api/v1/stats` | KPIs resumidos (activos totales, inspecciones en curso, completadas y recientes). |

---

### 6. 💻 Stack Tecnológico

- **Backend:**
  - **Python 3.11+**
  - **FastAPI** (asíncrono con ciclo de vida `lifespan`)
  - **Pydantic v2 & Pydantic-Settings**
  - **SQLAlchemy 2.0 (Async)** con motor `asyncpg` (PostgreSQL) y fallback automático a `aiosqlite` (desarrollo local)
  - **Alembic** (migraciones de esquema relacional)
  - **Pytest + pytest-asyncio + HTTPX** (suite de tests de integración)
- **Frontend:**
  - **React Native (v0.76) + React 18**
  - **Expo SDK 52** con **Expo Router v4** (enrutamiento declarativo)
  - **React Native Web** (soporte nativo para navegadores de escritorio)
  - **TypeScript**
  - **Lucide Icons (`lucide-react-native`)**
  - **Axios** para comunicación con la API
- **Infraestructura:**
  - **Docker & Docker Compose** (servicio de base de datos PostgreSQL 16 Alpine y contenedor de API FastAPI con migración y seed automáticos).

---

### 7. 🚀 Guía de Ejecución Rápida

#### Modo 1: Con Docker Compose (Recomendado)
```bash
docker-compose up --build
```
- API REST: `http://localhost:8000`
- Documentación interactiva Swagger: `http://localhost:8000/api/v1/docs`

#### Modo 2: Ejecución Local en Desarrollo

1. **Backend:**
   ```bash
   cd backend
   # Crear y activar entorno virtual
   python -m venv .venv
   # En Windows: .venv\Scripts\activate | En Linux/Mac: source .venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   python -m app.db.seed_data
   uvicorn app.main:app --reload --port 8000
   ```

2. **Frontend:**
   ```bash
   cd frontend
   pnpm install    # o npm install
   pnpm web        # o npm run web
   ```
   La aplicación web estará disponible en `http://localhost:8081`.

3. **Ejecutar Pruebas Automatizadas:**
   ```bash
   cd backend
   pytest -v
   ```
