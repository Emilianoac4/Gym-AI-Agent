# Migracion a otra computadora

## Objetivo
Mover el proyecto GymAI a otra PC y dejar backend + mobile listos.

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

## 6) Problemas comunes
- Si Expo no conecta por LAN, usa otra red Wi-Fi o hotspot.
- Si backend no conecta a DB, revisar DATABASE_URL y firewall.
- Si hay errores de tipos, correr `npm run typecheck` en backend y mobile.

## Archivos clave para migracion
- `backend/.env.example`
- `mobile/.env.example`
- `scripts/setup-new-pc.ps1`
- `scripts/package-for-transfer.ps1`
