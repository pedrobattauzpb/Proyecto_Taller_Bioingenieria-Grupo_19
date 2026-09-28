# Protocolo de Inspección Digital de Gases Medicinales
## Contexto, Dominio y Especificación Técnica del Proyecto (Grupo 19)

> 📘 **Nota para Desarrolladores y Agentes de IA:**  
> Para una visión arquitectónica exhaustiva con diagramas Mermaid (Arquitectura de Sistemas, Modelo ERD completo, Diagrama de Secuencia, Catálogo de Endpoints y Árbol de Componentes), consultar el documento maestro: [ARQUITECTURA.md](./ARQUITECTURA.md).

---

### 1. 🎯 Propósito y Dominio del Sistema

El proyecto consiste en un sistema **GMAO / CMMS (Gestión de Mantenimiento Asistido por Ordenador)** diseñado específicamente para el ámbito de la **Bioingeniería Hospitalaria e Ingeniería Clínica**.

Su objetivo principal es digitalizar, estandarizar y auditar de forma integral las **inspecciones técnicas y listas de verificación (checklists)** en redes e instalaciones de distribución de gases medicinales (Oxígeno $O_2$, Aire Medicinal, Vacío y Óxido Nitroso $N_2O$), garantizando trazabilidad normativa completa, validación de cumplimiento en tiempo real, almacenamiento de evidencia multimedia y generación de informes estructurados.

#### 📜 Marcos Normativos Integrados

1. **Resolución MSAL 1130/2000 (Ministerio de Salud de la Nación Argentina)**:
   - Buenas Prácticas de Fabricación y Control de Gases Medicinales (ANMAT / INAME). Clasifica al gas medicinal como un **medicamento crítico**.
   - Requisitos de envases y cilindros a presión: prueba hidráulica periódica (IRAM 2529, vigencia máx. 5 años), rotulado con nombre genérico, lote, pureza declarada (ej. $O_2 \ge 99.5\%$), vencimiento, leyenda obligatoria *"El empleo y dosificación de este gas debe ser prescrito por un médico"*, identificación visual obligatoria con **cruz griega verde**, código cromático reglamentario (Res. 324/77) y válvulas no intercambiables con precinto termocontraíble.
   - Almacenamiento: segregación física estricta entre gases medicinales e industriales, separación de cilindros llenos y vacíos, ventilación adecuada, control térmico (0°C a 45°C) y cadenas de sujeción antivuelco.
   - El sistema indexa **74 ítems de auditoría** (`RES1130-ID-001` a `RES1130-ID-074`) catalogados por severidad STPA (Nivel 1: Crítica/Catastrófica, Nivel 2: Grave/Mayor, Nivel 3: Menor/Leve).

2. **Norma ISO 7396-1:2016 (Sistemas de distribución de gases medicinales)**:
   - Requerimientos de seguridad para redes de tuberías de gases comprimidos y vacío.
   - Centrales y Manifolds (cl. 5 y 6): mínimo 3 fuentes independientes (primaria, secundaria, reserva), conmutación automática entre bancadas, filtros de alta presión $\le 100\ \mu m$, válvulas de retención en latiguillos pigtail, venteo exterior de válvulas de alivio PRV.
   - Presiones de trabajo reglamentarias: redes de gases comprimidos entre **4.0 y 5.5 bar** (400–500 kPa); herramientas quirúrgicas entre 8.0 y 10.0 bar; vacío clínico $\le 60\text{ kPa}$ absolutos.
   - Válvulas de corte de área AVSU (cl. 8): caja ventilada con tapa destructible, rotulación indeleble con listado de camas/quirófanos servidos, tomas de entrada de emergencia NIST/DISS.
   - Bocas terminales (cl. 11 e ISO 9170-1): encastre mecánico indexado no intercambiable por gas, estanqueidad automática al desacoplar.
   - Alarmas clínicas (cl. 6 e IEC 60601-1-8): alarma roja destellante (0.4–2.8 Hz) ante desvío de presión $\pm 20\%$, respaldo eléctrico por batería $\ge 4\text{ horas}$.
   - El sistema indexa más de **150 parámetros** agrupados en categorías `AUD-SUP`, `AUD-ALM`, `AUD-PIP`, `AUD-VAL`, `AUD-TRM`, `AUD-MRK` y `AUD-TST`.

3. **Norma IRAM 2529**: Inspección periódica y ensayo de presión hidrostática para cilindros de acero sin costura. Plazo de validez legal máximo: 5 años.

4. **Gestión de Vigencia Normativa (Normative Currency)**: La base de datos soporta trazabilidad histórica de normas con relación `superseded_by` (ej. ISO 7396-1:2007 superada por ISO 7396-1:2016), permitiendo detección proactiva de checklists que referencian normas derogadas.

---

### 2. 📊 Estado de los Objetivos Específicos

| Objetivo | Descripción | Estado |
|---|---|---|
| **OE-1** | Listas de verificación digitales dinámicas con trazabilidad normativa explícita, soporte táctil y auto-guardado atómico | ✅ Completado |
| **OE-2** | Motor de cumplimiento normativo en tiempo real (`ComplianceEngine`), catálogo de normas vigentes, alertas de severidad y bitácora de auditoría inmutable | ✅ Completado |
| **OE-3** | Base de datos centralizada con historial detallado de inspección por componente y soporte de evidencia multimedia (fotos/videos) | ✅ Completado |
| **OE-4** | Motor de reportes que genere informes estructurados automáticos sobre el estado de la infraestructura respecto a las normativas | 🔲 Pendiente |

---

### 3. 🏗️ Estructura del Repositorio

```
Proyecto_Taller_Bioingenieria-Grupo_19/
├── backend/                     # API REST asíncrona en Python con FastAPI
│   ├── alembic/                 # Control de versiones de base de datos
│   │   └── versions/            # 4 migraciones (clinical → compliance → evidence → unify)
│   ├── app/
│   │   ├── api/v1/endpoints/    # Routers HTTP:
│   │   │   ├── hierarchy.py     #   Árbol Hospital → Sector → Activo (CRUD)
│   │   │   ├── checklists.py    #   Plantillas normativas e ítems (CRUD)
│   │   │   ├── inspections.py   #   Ciclo de vida completo de inspecciones
│   │   │   ├── compliance.py    #   Validación de cumplimiento y bitácora
│   │   │   ├── normatives.py    #   Catálogo y vigencia de normas
│   │   │   └── stats.py         #   KPIs y métricas hospitalarias
│   │   ├── core/                # Configuración (pydantic-settings), CORS, DB engine
│   │   ├── db/                  # Inicializador de datos y seed normativo completo
│   │   ├── models/              # ORM (SQLAlchemy 2.0 Async):
│   │   │   ├── hierarchy.py     #   Hospital, Sector, Asset, AssetType
│   │   │   ├── checklist.py     #   ChecklistTemplate, ChecklistItem, ItemType
│   │   │   ├── inspection.py    #   Inspection, InspectionResponse, InspectionStatus
│   │   │   ├── evidence.py      #   InspectionEvidence, FileType
│   │   │   └── compliance.py    #   ComplianceResult, AuditLog, NormativeReference,
│   │   │                        #   NormativeVersion, ComplianceStatus, ComplianceSeverity
│   │   ├── schemas/             # Pydantic v2 (validación y serialización)
│   │   └── services/            # Capa de lógica de negocio:
│   │       ├── compliance_engine.py   # Motor de cumplimiento normativo
│   │       └── storage.py             # Servicio de almacenamiento multimedia
│   ├── tests/                   # 13 tests (pytest-asyncio + httpx):
│   │   ├── test_api.py          #   Liveness, jerarquía, plantillas, ciclo de inspección
│   │   ├── test_compliance.py   #   ComplianceEngine, severidades, audit logs
│   │   ├── test_evidence_and_history.py  # MIME validation, historial de activo
│   │   └── test_objective_3.py  #   Evidence upload, inmutabilidad, timeline
│   ├── uploads/evidence/        # Almacenamiento local de archivos multimedia
│   ├── gases_medicinales.db     # Base de datos SQLite de desarrollo
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                    # SPA React (Web + Capacitor Ready)
│   ├── src/
│   │   ├── App.tsx              # Router: /, /dashboard, /inspections, /inspections/:id
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx    # KPIs, selector jerárquico, grilla de activos,
│   │   │   │                        # historial por componente y inicio de inspección
│   │   │   ├── HistoryPage.tsx      # Catálogo de inspecciones con búsqueda y filtros
│   │   │   └── InspectionPage.tsx   # Checklist interactivo, auto-save, compliance
│   │   │                            # en vivo, multimedia, cierre y sellado
│   │   ├── components/
│   │   │   ├── checklist/       # ChecklistCard, AutoSaveIndicator, ComplianceBadge,
│   │   │   │                    # ComplianceAlertBanner, ComplianceSummaryCard,
│   │   │   │                    # NormativeStatusIndicator, MediaUploader,
│   │   │   │                    # EvidenceThumbnail
│   │   │   ├── hierarchy/       # HierarchySelector (cascada Hospital → Sector → Activo)
│   │   │   ├── history/         # ComponentHistoryTimeline (línea de tiempo vertical)
│   │   │   ├── layout/          # Header (responsive), Sidebar (desktop + drawer mobile),
│   │   │   │                    # Layout con <Outlet />
│   │   │   └── ui/              # Button, Card, Badge, Input, ProgressBar, SegmentedControl
│   │   ├── hooks/               # useComplianceValidation
│   │   ├── context/             # ThemeContext (claro/oscuro con localStorage)
│   │   ├── services/            # api.ts (Axios), types.ts (interfaces TypeScript)
│   │   └── lib/                 # cn() (clsx + tailwind-merge)
│   └── package.json
│
├── normas/                      # Matrices normativas de referencia
│   ├── extraccion_resolucion_1130.md   # 74 ítems de auditoría Res. 1130/2000
│   └── extraccion_iso_7396_1.md        # 150+ parámetros ISO 7396-1:2016
│
├── docker-compose.yml           # PostgreSQL 16 Alpine + FastAPI + MinIO
├── CONTEXTO.md                  # Este documento
├── ARQUITECTURA.md              # Documento maestro de arquitectura (SSOT)
└── README.md                    # Guía de inicio rápido
```

---

### 4. 🗄️ Modelo de Datos y Jerarquía Clínica

#### Jerarquía de Activos Hospitalarios
- **Hospital**: Identificador, nombre, código oficial (`HAC-AO-01`) y dirección.
- **Sector**: Áreas físicas/funcionales vinculadas a un hospital (ej. *Manifold Central*, *UTI Adultos*, *Quirófanos Centrales*, *Guardia de Emergencias*).
- **Asset (Activo)**: Equipo o punto de red controlado. Clasificado por `AssetType`:
  - `MANIFOLD`: Centrales de suministro y bancadas de tubos.
  - `AVSU_VALVE`: Válvulas de corte de área para sectorización y emergencias.
  - `TERMINAL_UNIT`: Bocas terminales de pared o columnas de consumo.
  - `PRESSURE_REGULATOR`: Estaciones reguladoras de presión (1ra y 2da etapa).
  - `GAS_CYLINDER`: Cilindros y tubos de gases comprimidos fijos o portátiles.
  - Otros: `PANEL_ALARMA`, `POLIDUCTO`, `COMPRESOR`.

#### Sistema de Checklists Normativos
- **ChecklistTemplate**: Plantilla asociada a un tipo de activo, versionada (default `"1.0"`) y con estado activo/inactivo. 5 plantillas preconfiguradas: Manifold (5 ítems), AVSU (4), Bocas Terminales (4), Reguladores de Presión (4), Cilindros Res. 1130/2000 (6).
- **ChecklistItem**:
  - `input_type`: `BOOLEAN` (Pasa / No Pasa), `NUMERIC` (con tolerancias `min_value` y `max_value`, unidad `bar`), o `TEXT`.
  - `referencia_normativa`: Código directo de la norma (ej: `ISO 7396-1:cl.5.3`, `Res1130/2000:1.2.2.a`).
  - `is_mandatory`: Obligatoriedad técnica del ítem (condiciona el cierre de la inspección).

#### Ciclo de Inspección
- **Inspection**: Estado `DRAFT` → `IN_PROGRESS` → `COMPLETED`. Fechas de inicio/cierre, inspector actuante y notas. Al completarse, la inspección se sella y se vuelve **inmutable**.
- **InspectionResponse**: Respuesta individual por ítem con valores tipados (`val_boolean`, `val_numeric`, `val_text`) y campo libre de observaciones técnicas.

#### Evidencia Multimedia
- **InspectionEvidence**: Fotos (`IMAGE`) y videos (`VIDEO`) adjuntos a la inspección o a ítems específicos, con validación de MIME type (`image/*`, `video/*`), límite de 25 MB, autor (`uploaded_by`) y timestamp. Almacenamiento desacoplado vía `StorageService` (S3/MinIO/disco local con URLs prefirmadas).
- Inmutabilidad: no se puede adjuntar ni eliminar evidencia una vez que la inspección está en estado `COMPLETED`.

#### Catálogo Normativo y Cumplimiento
- **NormativeReference**: Registro maestro de normas con código, título, organismo emisor, versión vigente, flag `is_current` y relación `superseded_by` para trazabilidad de derogaciones.
- **NormativeVersion**: Versiones históricas de cada norma con fechas de vigencia.
- **ComplianceResult**: Resultado de evaluación de cumplimiento por ítem: estado (`COMPLIANT`, `NON_COMPLIANT`, `WARNING`, `NOT_EVALUATED`), severidad (`CRITICAL`, `MAJOR`, `MINOR`, `OBSERVATION`), valor esperado vs. real, detalle del desvío y referencia normativa.
- **AuditLog**: Bitácora inmutable (append-only) con eventos `VALIDATION_RUN`, `INSPECTION_COMPLETED`, `EVIDENCE_ATTACHED`, `RESPONSES_UPDATED`, etc. Garantiza no repudio para auditorías ministeriales.

---

### 5. ⚙️ Motor de Cumplimiento Normativo (`ComplianceEngine`)

El motor reside en `backend/app/services/compliance_engine.py` y opera como un servicio de auditoría en tiempo real:

1. **Evaluación individual de ítems** (`evaluate_item_compliance`):
   - **BOOLEAN**: `True` → `COMPLIANT`; `False` → `NON_COMPLIANT`.
   - **NUMERIC**: Compara contra `min_value` y `max_value`. Si está fuera de rango, `NON_COMPLIANT`. Si excede el 30% del rango ($val < 0.7 \cdot min$ o $val > 1.3 \cdot max$), severidad `CRITICAL`. Si está dentro del rango pero en la **banda de alerta preventiva del 10%** cerca de los límites, `WARNING`.
   - **TEXT**: Valida presencia de registro mandatorio.
   - Ítems obligatorios sin respuesta: `NOT_EVALUATED` con severidad `MAJOR`.

2. **Clasificación de severidad** (`classify_severity`):
   - Palabras clave críticas: *"alarma", "fuga", "hermeticidad", "presión", "prueba hidráulica", "estanqueidad", "conmutación", "cruz griega", "seguridad"*.
   - Si es obligatorio y contiene palabra clave o está muy fuera de rango: `CRITICAL`. Si es obligatorio sin factores agravantes: `MAJOR`. No obligatorio: `MINOR`.

3. **Vigencia normativa** (`check_normative_currency`): Cruza cada ítem del checklist con el catálogo de `NormativeReference`. Detecta normas superadas/derogadas y sugiere sustitutos.

4. **Validación completa** (`validate_inspection_compliance`): Evalúa todos los ítems, persiste `ComplianceResult`, calcula métricas globales (% cumplimiento, conteos por severidad) y registra `AuditLog` inmutable.

---

### 6. ⚙️ Reglas de Negocio y Flujo de Trabajo

1. **Selección de Activo e Inicio:** El usuario selecciona un activo en el Dashboard e inicia la inspección. La API asocia automáticamente la plantilla normativa vigente para el tipo de activo.
2. **Auto-guardado en Segundo Plano (Debounce):** Cada respuesta activa un temporizador debounce (700 ms). Los cambios se envían por lotes al endpoint `PUT /api/v1/inspections/{id}/batch-responses`. El componente `AutoSaveIndicator` muestra el estado visual.
3. **Validación en Tiempo Real:** El frontend consulta `GET /api/v1/inspections/{id}/compliance` y muestra `ComplianceAlertBanner` si hay desvíos críticos o valores en zona de advertencia.
4. **Evidencia Multimedia:** El inspector puede adjuntar fotos/videos desde cámara nativa (`capture="environment"`) o galería. Se valida MIME type y tamaño (máx. 25 MB) y se almacena en S3/MinIO/disco local.
5. **Consulta de Antecedentes:** Desde el Dashboard o durante la inspección, el inspector puede consultar el historial técnico completo del activo (inspecciones previas, desvíos y evidencias) mediante `ComponentHistoryTimeline`.
6. **Cierre, Validación y Congelamiento:** El backend valida que **todos** los ítems obligatorios tengan respuesta (HTTP 422 si faltan). Al completarse, se sella `completed_at`, estado → `COMPLETED`, se ejecuta la validación final de compliance y se registra el `AuditLog`. La inspección queda bloqueada para edición (HTTP 400 ante cualquier intento).

---

### 7. 🔌 Endpoints de la API v1

| Módulo | Método | Endpoint | Descripción |
| :--- | :--- | :--- | :--- |
| **Salud** | `GET` | `/health` | Monitoreo y liveness probe. |
| **Jerarquía** | `GET` | `/api/v1/hierarchy` | Árbol completo (Hospitales → Sectores → Activos) con métricas. |
| **Jerarquía** | `POST` | `/api/v1/hierarchy/hospitals` | Alta de Hospital. |
| **Jerarquía** | `POST` | `/api/v1/hierarchy/sectors` | Alta de Sector. |
| **Jerarquía** | `POST` | `/api/v1/hierarchy/assets` | Alta de Activo. |
| **Checklists** | `GET` | `/api/v1/checklists/template?asset_type={type}` | Plantilla activa por tipo de activo. |
| **Checklists** | `GET` | `/api/v1/checklists/templates` | Lista todas las plantillas. |
| **Checklists** | `POST` | `/api/v1/checklists/templates` | Crea plantilla con ítems en cascada. |
| **Inspección** | `POST` | `/api/v1/inspections` | Inicia inspección vinculando plantilla automáticamente. |
| **Inspección** | `GET` | `/api/v1/inspections/{id}` | Detalle con ítems, respuestas, evidencias y compliance. |
| **Inspección** | `PUT` | `/api/v1/inspections/{id}/batch-responses` | Auto-guardado atómico por lotes. |
| **Inspección** | `POST` | `/api/v1/inspections/{id}/complete` | Cierre, validación de obligatoriedad y sellado. |
| **Inspección** | `GET` | `/api/v1/inspections` | Listado paginado con filtros (`status`, `asset_id`). |
| **Evidencia** | `POST` | `/api/v1/inspections/{id}/evidence` | Carga multimedia (multipart, MIME + 25MB). |
| **Evidencia** | `GET` | `/api/v1/evidence/{id}` | Detalle de evidencia con presigned URL. |
| **Evidencia** | `DELETE` | `/api/v1/evidence/{id}` | Borrado (bloqueado si inspección `COMPLETED`). |
| **Compliance** | `GET` | `/api/v1/inspections/{id}/compliance` | Evaluación en vivo por `ComplianceEngine`. |
| **Compliance** | `GET` | `/api/v1/inspections/{id}/compliance-summary` | Resumen rápido sin write a AuditLog. |
| **Auditoría** | `GET` | `/api/v1/audit-logs` | Bitácora inmutable append-only. |
| **Normativas** | `GET` | `/api/v1/normatives` | Catálogo de normas con versiones. |
| **Normativas** | `GET` | `/api/v1/normatives/{id}` | Detalle de norma. |
| **Normativas** | `PUT` | `/api/v1/normatives/{id}` | Actualiza norma (dar de baja, superseded_by). |
| **Normativas** | `GET` | `/api/v1/normatives/templates/{id}/currency-check` | Verifica vigencia de normas del checklist. |
| **Historial** | `GET` | `/api/v1/assets/{id}/history` | Línea de tiempo de inspecciones de un activo. |
| **Estadísticas** | `GET` | `/api/v1/stats` | KPIs (activos, inspecciones, compliance global). |

---

### 8. 💻 Stack Tecnológico

- **Backend:**
  - **Python 3.11+**
  - **FastAPI** (asíncrono con ciclo de vida `lifespan`)
  - **Pydantic v2 & Pydantic-Settings**
  - **SQLAlchemy 2.0 (Async)** con motor `asyncpg` (PostgreSQL) y fallback a `aiosqlite` (desarrollo local)
  - **Alembic** (4 migraciones versionadas)
  - **Pytest + pytest-asyncio + HTTPX** (13 tests, 100% passing)
  - **boto3** (integración S3/MinIO para almacenamiento multimedia)
  - **python-multipart** (procesamiento de uploads)
- **Frontend:**
  - **React 19 + TypeScript 6**
  - **Vite 8** (bundler)
  - **Tailwind CSS v4** (sistema de diseño con variables semánticas claro/oscuro)
  - **React Router v7** (enrutamiento declarativo SPA)
  - **Radix UI Primitives** (`@radix-ui/react-dialog`, `react-select`, `react-tabs`)
  - **Lucide Icons (`lucide-react`)** (iconografía médica y técnica)
  - **Axios** (cliente HTTP)
  - **Capacitor Ready** (empaquetado nativo para tablets/smartphones)
- **Infraestructura:**
  - **Docker & Docker Compose** (PostgreSQL 16 Alpine, MinIO, FastAPI con migración y seed automáticos)

---

### 9. 🎨 Sistema de Diseño y Tema Visual

El frontend implementa un sistema de variables CSS semánticas con soporte claro/oscuro:

| Variable | Propósito | Claro | Oscuro |
|---|---|---|---|
| `--bg` | Fondo de la app | `#f5f7f9` | `#10161b` |
| `--surface` | Fondo de tarjetas | `#ffffff` | `#171f26` |
| `--surface-2` | Fondos secundarios | `#eef2f5` | `#1d262e` |
| `--ink` | Texto principal | `#16212b` | `#eaeef1` |
| `--ink-soft` | Subtítulos | `#55636e` | `#a7b2ba` |
| `--ink-faint` | Metadatos tenues | `#8b96a0` | `#6f7a83` |
| `--border` | Bordes y divisorias | `#e1e6ea` | `#2a343c` |
| `--accent` | Verde azulado clínico | `#2f6f6b` | `#56a39d` |
| `--ok` | Conforme / Operativo | `#1f8a5a` | `#4bbf85` |
| `--warn` | No conformidad | `#b8770a` | `#d99a3d` |
| `--info` | Informativo | `#375d8a` | `#7ea3d1` |

El tema se gestiona mediante `ThemeContext.tsx` con persistencia en `localStorage` y fallback a `prefers-color-scheme`.

---

### 10. 🚀 Guía de Ejecución Rápida

#### Modo 1: Con Docker Compose (Recomendado para entorno completo)
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
   npm install
   npm run dev
   ```
   La aplicación web estará disponible en `http://localhost:5173` (con proxy reverso automático configurado hacia el backend en `http://localhost:8000`).

3. **Ejecutar Pruebas Automatizadas:**
   ```bash
   cd backend
   .venv\Scripts\pytest -v    # Windows
   # o: pytest -v             # Linux/Mac con venv activado
   ```

---

### 11. 📖 Datos Semillados en Desarrollo

El script `app/db/seed_data.py` precarga:
- **Normas:** ISO 7396-1:2016 (vigente), Res1130/2000, IRAM 2529, e ISO 7396-1:2007 (superada, con `superseded_by` apuntando a 2016).
- **Hospital:** "Hospital de Alta Complejidad Dr. Arturo Oñativia" (`HAC-AO-01`).
- **Sectores:** Manifold Central, UTI Adultos, Quirófanos Centrales, Guardia y Emergencias.
- **11 Activos clínicos** con tags, números de serie y fechas de instalación.
- **5 Plantillas de Checklist activas** con tolerancias numéricas y referencias normativas específicas por cláusula.
