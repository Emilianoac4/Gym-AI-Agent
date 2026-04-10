# Migracion a otra computadora

## Objetivo
Mover el proyecto Tuco a otra PC y dejar backend + mobile listos.

## 1) Copiar el proyecto
Opciones:
- Zip: ejecutar `scripts/package-for-transfer.ps1` y copiar el zip a la nueva PC.
- Git: push/pull del repositorio.

## 2) Preparar nueva PC
Requisitos:
- Node.js 20+
- npm 10+
- VS Code (opcional)

Extraer proyecto y ejecutar:

```powershell
cd <ruta-del-proyecto>
.\scripts\setup-new-pc.ps1
```

## 3) Configurar variables de entorno
### backend/.env
Completar:
- DATABASE_URL
- JWT_SECRET
- OPENAI_API_KEY

### mobile/.env
Completar con IP local de la nueva PC:

```env
EXPO_PUBLIC_API_BASE_URL=http://<NUEVA_IP_LOCAL>:3000
```

## 4) Levantar servicios
Terminal 1 (backend):

```powershell
cd backend
npm run dev
```

Terminal 2 (mobile):

```powershell
cd mobile
npm run start
```

## 5) Verificacion rapida
- Backend health: `http://localhost:3000/health`
- App mobile abre Login en Expo Go

### Smoke test pre-deploy (API y permisos admin dashboard)
Ejecutar antes de cada deploy para validar autenticacion, permisos y cache del endpoint de resumen admin:

```powershell
cd <ruta-del-proyecto>
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-predeploy-admin-dashboard.ps1 `
	-BaseUrl http://localhost:3000 `
	-AdminIdentifier "<admin_email_o_username>" `
	-AdminPassword "<admin_password>" `
	-TrainerIdentifier "<trainer_email_o_username>" `
	-TrainerPassword "<trainer_password>"
```

Tambien puedes usar variables de entorno en lugar de parametros:

```powershell
$env:SMOKE_ADMIN_IDENTIFIER = "..."
$env:SMOKE_ADMIN_PASSWORD = "..."
$env:SMOKE_TRAINER_IDENTIFIER = "..."
$env:SMOKE_TRAINER_PASSWORD = "..."
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-predeploy-admin-dashboard.ps1 -BaseUrl http://localhost:3000
```

El script termina con codigo 0 si todo pasa y codigo 1 si hay algun FAIL.

## 6) Problemas comunes
- Si Expo no conecta por LAN, usa otra red Wi-Fi o hotspot.
- Si backend no conecta a DB, revisar DATABASE_URL y firewall.
- Si hay errores de tipos, correr `npm run typecheck` en backend y mobile.

## Archivos clave para migracion
- `backend/.env.example`
- `mobile/.env.example`
- `scripts/setup-new-pc.ps1`
- `scripts/package-for-transfer.ps1`

## Nota de despliegue web (portal central)
- El portal central de Tuco se publica en Cloudflare Pages.
- La fuente de verdad del portal es `platform-portal/`.
- La carpeta `platform-portal/platform-portal/` no es la ruta activa de despliegue.
