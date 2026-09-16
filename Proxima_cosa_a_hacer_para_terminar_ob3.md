# 📌 Próximos Pasos para Finalizar el Objetivo Específico 3

> **Proyecto:** Protocolo de Inspección Digital de Gases Medicinales — Taller de Bioingeniería (Grupo 19)  
> **Definición Oficial del Objetivo 3:**  
> *"Desarrollar una base de datos centralizada que almacene el historial detallado de inspección por cada componente de la instalación permitiendo adjuntar evidencia multimedia."*

---

## 1. 🔍 Estado Actual de la Implementación

### ✅ Lo que ya está completado y testeado:
1. **Base de Datos y Modelos Relacionales:**
   - Modelo `InspectionEvidence` vinculado a la inspección padre y opcionalmente a un ítem específico (`item_id`).
   - Bitácora inmutable `AuditLog` para auditoría legal.
   - Restricción de inmutabilidad: no se pueden subir ni borrar evidencias en inspecciones cerradas (`status == 'COMPLETED'`).
2. **Servicio de Almacenamiento Desacoplado (`StorageService`):**
   - Soporte para almacenamiento local (`./uploads/evidence`), MinIO y Amazon S3.
   - Validación server-side estricta de tipos MIME permitidos (`image/*`, `video/*`) y tamaño máximo (25 MB).
   - Generación de presigned URLs / URLs locales seguras para previsualización.
3. **Endpoints de la API Backend:**
   - `POST /api/v1/inspections/{id}/evidence` (Carga multipart de fotos/videos).
   - `DELETE /api/v1/evidence/{id}` (Eliminación controlada).
   - `GET /api/v1/assets/{id}/history` (Retorna cronología de inspecciones y evidencias de un activo específico).
   - Pruebas automatizadas de integración en `backend/tests/test_objective_3.py`.
4. **Carga Multimedia en Pantalla de Inspección (`frontend`):**
   - `MediaUploader.tsx`: Componente para adjuntar archivos a nivel general o por punto de verificación.
   - `EvidenceThumbnail.tsx`: Miniaturas, visor ampliado de fotos y reproductor de video.

---

## 2. 🚀 Tareas Pendientes para el Cierre Definitivo (100%)

Para dar por completamente cerrado y demostrable el Objetivo 3 ante la cátedra, restan las siguientes 3 tareas visuales y operativas en el frontend:

### Tarea 1: Conectar el Historial por Componente en el Dashboard (UI)
* **Problema:** El endpoint `GET /api/v1/assets/{id}/history` y el componente `ComponentHistoryTimeline.tsx` existen y funcionan, pero actualmente en el Dashboard las tarjetas de activos solo tienen el botón *"Auditar"*, por lo que el usuario no tiene una vía directa para consultar el historial de un equipo sin iniciar una nueva inspección.
* **Acción:**
  - Agregar en cada tarjeta de activo (`asset-card` en `DashboardPage.tsx`) un botón secundario o icono de reloj/bitácora (ej. *"Historial"* o *"Ficha Técnica"*).
  - Al presionarlo, abrir un **Modal o Drawer lateral** (`AssetHistoryModal`) que renderice `ComponentHistoryTimeline` para ese activo en particular.
  - Adaptar los estilos de `ComponentHistoryTimeline.tsx` a las variables CSS del nuevo tema Claro/Oscuro (`var(--surface)`, `var(--border)`, `var(--ink)`, `var(--accent)`).

### Tarea 2: Habilitar Captura Nativa de Cámara en Móviles y Tablets en Campo
* **Problema:** En dispositivos móviles, el selector de archivos por defecto suele abrir el explorador de archivos en lugar de la cámara directa.
* **Acción:**
  - En `MediaUploader.tsx`, configurar el input HTML5 con los atributos:
    ```html
    <input type="file" accept="image/*" capture="environment" />
    ```
  - Permitir al bioingeniero elegir entre tomar una foto en el acto o seleccionar un archivo de la galería/disco.

### Tarea 3: Acceso a Antecedentes y Fotos Previas durante la Inspección
* **Problema:** Durante la realización de un checklist en campo, el técnico a menudo necesita comparar la lectura actual de un manómetro o el estado de una válvula con la foto de la inspección anterior.
* **Acción:**
  - En `InspectionPage.tsx`, agregar un enlace o botón desplegable *"Consultar inspecciones previas de este activo"*.
  - Mostrar una ventana modal rápida con las últimas fotos y desvíos detectados en auditorías pasadas del mismo activo.

---

## 3. 📋 Criterios de Aceptación para la Defensa del TP

- [ ] Desde la grilla de activos del Dashboard, al hacer clic en *"Historial"* de un Manifold o Cilindro, se despliega su línea de tiempo cronológica con todas sus fechas, auditores y fotos adjuntas.
- [ ] Al inspeccionar en una tablet o celular, el botón de evidencia permite abrir la cámara trasera de forma nativa e inmediata.
- [ ] Las imágenes y videos cargados se visualizan correctamente tanto en Modo Claro como en Modo Oscuro.
- [ ] Los tests automatizados en `pytest backend/tests/test_objective_3.py` se ejecutan y pasan al 100%.
