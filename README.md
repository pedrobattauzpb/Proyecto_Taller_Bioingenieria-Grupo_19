# Protocolo de Inspección Digital de Gases Medicinales

**GMAO / CMMS para inspección, trazabilidad y auditoría de instalaciones hospitalarias de gases medicinales.**  
Proyecto de Taller de Bioingeniería · Grupo 19

Digitaliza las inspecciones de redes de oxígeno, aire medicinal, vacío y óxido nitroso: desde la carga del checklist en campo hasta la evaluación de cumplimiento, el registro de evidencias, la emisión de informes y el seguimiento de alertas.

**[Arquitectura](./ARQUITECTURA.md) · [Contexto y dominio](./contexto.md) · [Aplicación Android](./releases/README.md)**

## Funcionalidades

El sistema integra los cinco objetivos específicos del proyecto:

| Módulo | Capacidades |
| --- | --- |
| **Inspecciones digitales — OE-1** | Plantillas por tipo de activo, respuestas booleanas/numéricas/textuales, referencias normativas, controles táctiles y autoguardado por lotes. |
| **Cumplimiento normativo — OE-2** | Evaluación de tolerancias, advertencias preventivas, clasificación de severidad, consulta de vigencia normativa y bitácora de auditoría. |
| **Historial y evidencias — OE-3** | Antecedentes por activo, fotografías y videos asociados a inspecciones o ítems, almacenamiento local o compatible con S3. |
| **Reportes — OE-4** | Actas de inspección en PDF y Excel, historial técnico en PDF e informes ejecutivos con indicadores por hospital, sector y tipo de activo. |
| **Alertas y notificaciones — OE-5** | Alertas en vivo mediante SSE, controles programados, reconocimiento/resolución/silenciamiento y canales de correo y webhook configurables. |
| **Seguridad y roles RBAC — OE-6** | Autenticación JWT y refresh rotativo con detección de reuso, hash Argon2id, permisos granulares (Técnico, Supervisor, Auditor, Admin), control de visibilidad O+C (Own + Completed), aislamiento estricto multi-hospital y administración de usuarios. |

La interfaz incluye dashboard, catálogo de inspecciones, centro de reportes, bandeja de alertas y configuración de notificaciones, con diseño responsivo y tema claro/oscuro.

### Dominio y reglas principales

- **Jerarquía clínica:** Hospital → Sector → Activo → Inspecciones.
- **Activos:** centrales manifold, válvulas AVSU, bocas terminales, reguladores de presión y cilindros, entre otros.
- **Referencias normativas:** Resolución MSAL 1130/2000, ISO 7396-1:2016 e IRAM 2529. Las matrices de referencia están en [`normas/`](./normas/).
- **Cierre controlado:** todos los ítems obligatorios deben tener respuesta antes de completar una inspección.
- **Inmutabilidad:** una inspección completada no admite cambios en respuestas ni altas o bajas de evidencia.
- **Evidencia multimedia:** límite de 25 MB por archivo; formatos habilitados en la configuración del backend.

> La evaluación automática sirve de apoyo a la inspección técnica; no sustituye el criterio profesional ni la consulta de las normas oficiales vigentes.

## Arquitectura y tecnologías

```text
Navegador / Android (Capacitor)
              │
     React + TypeScript
              │ REST / SSE
          FastAPI
              ├── Cumplimiento, reportes y alertas
              ├── SQLAlchemy Async → PostgreSQL / SQLite
              └── Evidencias → MinIO / S3 / Disco local
```

| Capa | Tecnologías |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7, Radix UI, Recharts y Axios. |
| Backend | Python 3.11+, FastAPI, Pydantic 2, SQLAlchemy 2 Async y Alembic. |
| Persistencia | PostgreSQL 16 para el entorno Docker; SQLite para desarrollo local. |
| Archivos y reportes | MinIO / AWS S3 / disco local, ReportLab y openpyxl. |
| Notificaciones | SSE, SMTP, webhooks y comprobaciones periódicas. |
| Aplicación móvil | Capacitor 8 y proyecto Android. |
| Pruebas | pytest, pytest-asyncio y HTTPX. |

Los diagramas, modelos de datos y reglas de desarrollo se detallan en [`ARQUITECTURA.md`](./ARQUITECTURA.md). Los contratos ejecutables de la API se consultan en Swagger.

## Puesta en marcha

### Opción A · Desarrollo local sin Docker

**Requisitos:** Python 3.11+, Node.js compatible con Vite 8 (20.19+ o 22.12+) y npm.

#### 1. Preparar el backend

Desde la raíz del repositorio, en **PowerShell**:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Crear `backend/.env` con esta configuración mínima:

```dotenv
ENVIRONMENT=development
DEBUG=True
DATABASE_URL=sqlite+aiosqlite:///./gases_medicinales.db
SYNC_DATABASE_URL=sqlite:///./gases_medicinales.db
STORAGE_BACKEND=local
STORAGE_LOCAL_DIR=./uploads/evidence
BACKEND_CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
FRONTEND_BASE_URL=http://localhost:5173
```

Iniciar la API desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

En Linux/macOS, usar `.venv/bin/python` en lugar de `.\.venv\Scripts\python.exe`.

Al iniciar, el backend crea las tablas que falten y ejecuta la carga semilla. Esto permite probar una base SQLite nueva sin configurar PostgreSQL ni MinIO. Los datos iniciales incluyen dos hospitales de demostración (`HAC-AO-01` y `HDB-01`), sectores, activos, plantillas, catálogo normativo y las siguientes cuentas de prueba:

| Usuario | Rol | Hospital Asignado | Contraseña |
|---|---|---|---|
| `admin@gmao.local` | Administrador | Global (Todos) | `Demo2026!` |
| `supervisor@gmao.local` | Supervisor | Hospital Demo A (`HAC-AO-01`) | `Demo2026!` |
| `tecnico@gmao.local` | Técnico | Hospital Demo A (`HAC-AO-01`) | `Demo2026!` |
| `tecnico2@gmao.local` | Técnico (2) | Hospital Demo A (`HAC-AO-01`) | `Demo2026!` |
| `auditor@gmao.local` | Auditor | Global (Todos) | `Demo2026!` |
| `supervisor.b@gmao.local` | Supervisor | Hospital Demo B (`HDB-01`) | `Demo2026!` |
| `tecnico.b@gmao.local` | Técnico | Hospital Demo B (`HDB-01`) | `Demo2026!` |

> La creación automática de tablas no migra esquemas existentes. Para bases versionadas, utilizar Alembic y realizar una copia de seguridad antes de aplicar cambios.

#### 2. Iniciar el frontend

En otra terminal, desde la raíz:

```powershell
cd frontend
npm ci
npm run dev
```

Abrir **http://localhost:5173**. Vite redirige las solicitudes `/api` al backend en `http://localhost:8000`; no hace falta definir una URL de API para este modo.

### Opción B · Backend e infraestructura con Docker

**Requisitos:** Docker y Docker Compose; Node.js y npm para ejecutar el frontend.

Desde la raíz del repositorio:

```powershell
docker compose up --build
```

Se levantan **PostgreSQL, MinIO y FastAPI**. El contenedor del backend ejecuta las migraciones y la carga semilla antes de iniciar la API.

**El frontend no está incluido en Compose.** Iniciarlo en otra terminal con los comandos del paso anterior (`cd frontend`, `npm ci`, `npm run dev`).

| Servicio | Dirección predeterminada |
| --- | --- |
| Aplicación web (Vite) | http://localhost:5173 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/api/v1/docs |
| ReDoc | http://localhost:8000/api/v1/redoc |
| Estado del backend | http://localhost:8000/health |
| MinIO — API de objetos | http://localhost:9000 |
| MinIO — consola | http://localhost:9001 |
| PostgreSQL | `localhost:5432` |

Compose utiliza volúmenes persistentes para PostgreSQL y MinIO. Las credenciales predeterminadas son de desarrollo: `postgres` / `postgres` para PostgreSQL y `minioadmin` / `minioadmin` para MinIO.

## Configuración

### Archivos de entorno

| Archivo | Uso |
| --- | --- |
| [`.env.example`](./.env.example) | Referencia de variables disponibles. Revisar los valores según el modo de ejecución. |
| `.env` en la raíz | Sustitución de variables declaradas en `docker-compose.yml`. |
| `backend/.env` | Configuración leída por FastAPI y Alembic en ejecución local. |
| `frontend/.env.local` | Configuración local de Vite, por ejemplo `VITE_API_URL`. |
| `frontend/.env.production` | Configuración de la compilación de producción; revisarla antes de generar la web o el APK. |

**No son intercambiables:** el backend local lee `backend/.env`, no el `.env` de la raíz. Compose solo transmite al contenedor las variables declaradas en su bloque `environment`; añadir una variable al `.env` raíz no basta para transmitirla.

### Variables principales

| Variable | Propósito |
| --- | --- |
| `DATABASE_URL` / `SYNC_DATABASE_URL` | Conexiones asíncrona (aplicación) y síncrona (Alembic). Ambas deben apuntar a la misma base. |
| `STORAGE_BACKEND` | `local`, `minio` o `s3`. Para desarrollo sin servicios externos, usar `local`. |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_NAME` | Conexión y bucket de MinIO. |
| `S3_BUCKET_NAME`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Configuración de AWS S3 en el backend. |
| `BACKEND_CORS_ORIGINS` | Orígenes permitidos para los clientes web/móvil. |
| `VITE_API_URL` | URL base de API del frontend; por defecto `/api/v1`. Se incorpora al compilar. |
| `ALERTS_ENABLED`, `ALERTS_SCHEDULER_ENABLED` | Activación de alertas y comprobaciones periódicas. |
| `ALERTS_SCHEDULER_INTERVAL_SECONDS` | Intervalo del scheduler; por defecto, 300 segundos. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_FROM` | Envío de notificaciones por correo. |
| `FRONTEND_BASE_URL` | URL de la aplicación utilizada en enlaces de notificaciones. |
| `SECRET_KEY` | Clave secreta criptográfica para firma de JWT y URLs HMAC (obligatoria en producción). |
| `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` | Credenciales para bootstrap automático del primer Administrador en entornos productivos. |

Los canales y reglas de notificación se administran desde `/settings/notifications`. El envío externo requiere configurar el canal correspondiente y, para correo, un servidor SMTP.

## Aplicación Android

El frontend incluye un proyecto Android con Capacitor. Para compilarlo se necesitan Android Studio y las herramientas del SDK de Android.

1. Configurar en `frontend/.env.local` una URL accesible desde el teléfono:
   ```dotenv
   VITE_API_URL=http://<IP-del-servidor>:8000/api/v1
   ```
2. Desde `frontend/`, ejecutar:
   ```powershell
   npm run build
   npx cap sync android
   npx cap open android
   ```
3. Generar e instalar el APK desde Android Studio.

Para pruebas en red local, iniciar Uvicorn con `--host 0.0.0.0`, permitir el puerto 8000 en el firewall y conectar ambos dispositivos a la misma red. `localhost` en el teléfono apunta al propio teléfono, no a la PC. El backend y el almacenamiento de evidencias deben ser accesibles desde el dispositivo.

Ver [`releases/`](./releases/) para el APK distribuido y sus instrucciones. Ese binario puede tener una dirección de servidor fija distinta de la configuración de una compilación nueva.

## Pruebas y verificaciones

Desde `backend/`, con las dependencias instaladas:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

La suite cubre el ciclo de inspección, cumplimiento, evidencias, historial, reportes y notificaciones mediante una base SQLite de pruebas en memoria.

Desde `frontend/`:

```powershell
npm run lint
npm run build
```

Para aplicar migraciones a una base versionada, desde `backend/`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

## Estructura del repositorio

```text
├── backend/
│   ├── app/
│   │   ├── api/v1/         # Endpoints REST y SSE
│   │   ├── core/           # Configuración y conexión a base de datos
│   │   ├── db/             # Inicialización y datos semilla
│   │   ├── models/         # Modelos SQLAlchemy
│   │   ├── schemas/        # Contratos Pydantic
│   │   └── services/       # Cumplimiento, almacenamiento, reportes y alertas
│   ├── alembic/            # Migraciones
│   └── tests/              # Pruebas automatizadas
├── frontend/
│   ├── src/                # Páginas, componentes, hooks y cliente de API
│   └── android/            # Proyecto nativo Capacitor
├── normas/                 # Matrices de referencia normativa
├── releases/               # Distribución Android
├── docker-compose.yml      # PostgreSQL + MinIO + backend
├── .env.example            # Referencia de configuración
├── contexto.md             # Dominio, objetivos y reglas de negocio
└── ARQUITECTURA.md          # Documento maestro de arquitectura
```

## Antes de desplegar fuera de desarrollo

La configuración incluida facilita las pruebas, **no constituye un despliegue hospitalario endurecido**. Antes de exponer el sistema, revisar autenticación y autorización, HTTPS, CORS, credenciales, acceso a evidencias, copias de seguridad y protección de datos. No almacenar secretos ni datos clínicos sensibles en el repositorio.
