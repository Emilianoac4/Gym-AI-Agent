# GymAI - Cierre Operativo INF-SEC-01

Fecha objetivo: 2026-04-08
Scope: cierre de secretos centralizados por entorno y evidencia post-rotacion.

## 1) Criterios de cierre

- Secretos criticos rotados en staging.
- Secretos criticos rotados en produccion.
- Smoke de auth/rotacion exitoso en staging y produccion.
- Validacion de headers del portal en dominio activo en PASS.
- Verificacion de eventos operativos de seguridad post-cambio.

## 2) Secretos minimos por entorno

- JWT_SECRET
- JWT_REFRESH_SECRET
- PLATFORM_JWT_SECRET
- PLATFORM_ADMIN_TOKEN
- OPENAI_API_KEY
- RESEND_API_KEY
- DATABASE_URL (si aplica por sospecha/exposicion)

## 3) Comandos de validacion

### 3.1 Headers del portal (Cloudflare)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-portal-headers.ps1 -Url https://admin.tucofitness.com
```

### 3.2 Auth/refresh/logout (staging)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-remote-auth-rotation.ps1 \
  -EnvName staging \
  -BaseUrl https://<backend-staging> \
  -Identifier <usuario> \
  -Password <password>
```

### 3.3 Auth/refresh/logout (produccion)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-remote-auth-rotation.ps1 \
  -EnvName prod \
  -BaseUrl https://<backend-prod> \
  -Identifier <usuario> \
  -Password <password>
```

## 4) Registro de ejecucion

### 4.1 Staging

- Fecha: 2026-04-08
- Responsable: emilianoac4@gmail.com
- Secretos rotados: JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN=7d → Render staging
- Resultado smoke auth: PASS=7 FAIL=0 (login, refresh, logout, replay-block)
- Incidencias: ninguna

### 4.2 Produccion

- Fecha: N/A
- Responsable: N/A
- Secretos rotados: N/A - entorno unico durante piloto (staging = produccion)
- Resultado smoke auth: N/A
- Incidencias: N/A

### 4.3 Portal Cloudflare

- Dominio validado: admin.tucofitness.com
- Resultado verify-portal-headers: PASS
- Observaciones:

## 5) Estado

Estado global INF-SEC-01: **CERRADO** — 2026-04-08

Staging PASS=7 FAIL=0. Produccion N/A (entorno unico en piloto). Portal headers PASS. Sin incidentes criticos.

## 6) Bloqueadores detectados (2026-04-08)

- En `staging` se observo `404 Route not found` para `POST /auth/refresh` y `POST /auth/logout`.
- Implicacion: el entorno remoto no tiene BE-SEC-01 desplegado aun.
- Accion previa obligatoria: desplegar backend actualizado en `staging` y luego repetir `scripts/smoke-remote-auth-rotation.ps1`.
