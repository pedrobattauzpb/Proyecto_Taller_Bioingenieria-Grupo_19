# Releases - GMOS Gases Medicinales

## Versión 1.0.0 (`GMOSv1.apk`)

Binario de aplicación Android para inspección y auditoría de sistemas de gases medicinales hospitalarios.

### Características
- **Empaquetado**: Capacitor 7 + React 19 + Vite 8.
- **Conectividad**: Opción 1 - Red Wi-Fi Local.
- **Endpoint por defecto**: `http://192.168.1.96:8000/api/v1` (soporte de tráfico cleartext habilitado en `AndroidManifest.xml`).
- **Compatibilidad**: Android 7.0+ (API 24 a 36).

### Instrucciones de Instalación y Uso
1. Copiar `GMOSv1.apk` a tu dispositivo Android (vía USB, WhatsApp, Google Drive o descargándolo desde el repositorio).
2. Habilitar la instalación de aplicaciones desde fuentes desconocidas si el sistema lo solicita.
3. Asegurarse de que el teléfono esté conectado a la misma red Wi-Fi que el servidor (`192.168.1.96`).
4. Abrir la aplicación: cargará la interfaz clínica GMAO y se sincronizará en tiempo real con el backend.
