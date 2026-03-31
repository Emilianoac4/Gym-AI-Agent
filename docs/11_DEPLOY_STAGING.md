# 11 - Deploy Staging (Fuera de Red Local)

## Objetivo

Publicar el backend en internet y conectar la app mobile para pruebas reales en 4G/WiFi externo.

## 1. Backend en Render (recomendado)

1. Subir el repositorio a GitHub.
2. Crear un nuevo Web Service en Render apuntando a la carpeta `backend`.
3. Configurar:
	- Build command: `npm install ; npm run build`
	- Start command: `npm run start`
	- Node version: 20+
4. Definir variables de entorno:
	- `NODE_ENV=production`
	- `PORT=3000`
	- `DATABASE_URL=<tu url de supabase>`
	- `JWT_SECRET=<secreto largo y unico>`
	- `JWT_EXPIRES_IN=1h`
	- `OPENAI_API_KEY=<tu key>`
	- `OPENAI_MODEL_CHAT=gpt-4o-mini`
	- `OPENAI_MODEL_ROUTINE=gpt-4o-mini`
	- `OPENAI_MODEL_NUTRITION=gpt-4o-mini`
	- `OPENAI_MODEL_TIP=gpt-4o-mini`
	- `CORS_ORIGIN=*` (staging)
5. Desplegar y validar `GET /health`.

## 2. Mobile apuntando a staging

1. Editar `mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://tu-backend-staging.onrender.com
```

2. Reiniciar Expo:

```bash
cd mobile
npm run start
```

3. Probar flujo completo desde telefono:
	- Login/Register
	- Perfil
	- Mediciones
	- Chat IA
	- Rutina IA

## 3. Checklist minimo de salida

1. `GET /health` responde `{ ok: true }` desde internet.
2. Login y chat funcionan en datos moviles (sin red local).
3. No hay errores 500 en logs de backend.
4. Limites de gasto de OpenAI activos.
5. CORS cerrado a origenes permitidos antes de produccion.

## 4. Endurecimiento para produccion

1. Reemplazar `CORS_ORIGIN=*` por lista explicita de origenes.
2. Agregar rate limiting por IP/usuario.
3. Configurar alertas (errores, latencia, cuota OpenAI).
4. Usar entorno separado: staging y production.
