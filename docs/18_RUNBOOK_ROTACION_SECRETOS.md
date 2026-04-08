# GymAI - Runbook de Rotacion de Secretos

**Version**: 1.0  
**Fecha**: Abril 8, 2026  
**Objetivo**: ejecutar rotacion de secretos de forma segura y repetible para backend, mobile y portal central.

Proveedor de despliegue actual del portal: Cloudflare.

Fuente unica de verdad para configuracion web del portal:

- carpeta publica activa: `platform-portal/`
- headers de seguridad: `platform-portal/_headers`
- redirects SPA: `platform-portal/_redirects`
- `platform-portal/platform-portal/` se mantiene solo como referencia historica/no activa.

---

## 1) Alcance inicial (Sprint S0-A)

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `PLATFORM_JWT_SECRET`
- `PLATFORM_ADMIN_TOKEN`
- `OPENAI_API_KEY`
- `DATABASE_URL` (si existe sospecha de exposicion)
- `RESEND_API_KEY`

---

## 2) Politica minima obligatoria

1. Ningun secreto operativo debe vivir en archivos versionados.
2. Cada entorno usa secretos distintos (`dev`, `staging`, `prod`).
3. Toda rotacion debe registrarse con fecha, responsable y motivo.
4. Las claves de acceso deben tener al menos 32 bytes de entropia real.
5. Rotacion trimestral obligatoria o inmediata ante sospecha de exposicion.

---

## 3) Ventana de ejecucion recomendada

1. Preparacion (15-30 min)
2. Rotacion en staging y smoke tests (20-40 min)
3. Rotacion en produccion (10-20 min)
4. Verificacion post-rotacion (15 min)

---

## 4) Procedimiento paso a paso

## Paso A - Inventario y respaldo

1. Exportar lista de variables por entorno (sin imprimir valores en logs).
2. Confirmar quien tiene acceso de lectura/escritura a secretos.
3. Definir plan de rollback por cada secreto critico.

## Paso B - Generar nuevos secretos

Ejemplo PowerShell para secreto hex de 64 bytes:

```powershell
[Convert]::ToHexString((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Ejemplo alternativo con OpenSSL:

```bash
openssl rand -hex 64
```

## Paso C - Aplicar secretos en `staging`

1. Actualizar secretos en proveedor de hosting (Cloudflare para portal y proveedor backend correspondiente).
2. Reiniciar servicios que consumen esos secretos.
3. Ejecutar smoke tests:
   - login
   - refresh
   - logout
   - endpoints de plataforma
4. Confirmar que no hay incremento anormal de `401/500`.

## Paso D - Aplicar secretos en `produccion`

1. Repetir el mismo orden validado en staging.
2. Rotar primero `JWT_REFRESH_SECRET`, luego `JWT_SECRET` y `PLATFORM_JWT_SECRET`.
3. Rotar `OPENAI_API_KEY` y `RESEND_API_KEY`.
4. Si hay sospecha de filtracion, rotar `DATABASE_URL` y credenciales DB.

Validacion de headers/csp del portal en Cloudflare (post-despliegue):

```powershell
curl -I https://<tu-dominio-portal> | Select-String "content-security-policy|x-frame-options|x-content-type-options|strict-transport-security|referrer-policy"
```

Resultado de verificacion actual (2026-04-08, `admin.tucofitness.com`):

- presentes: `content-security-policy`, `x-frame-options`, `x-content-type-options`, `strict-transport-security`, `referrer-policy`, `permissions-policy`
- faltantes: ninguno
- conclusion: reglas sincronizadas correctamente en Cloudflare para `admin.tucofitness.com`.

Sincronizacion recomendada en Cloudflare (cuando `_headers` no refleja en vivo):

1. Ir a Cloudflare Dashboard -> `tucofitness.com` -> Rules -> Transform Rules -> HTTP Response Header Modification.
2. Crear una regla para host `admin.tucofitness.com` con path `/*`.
3. Aplicar operaciones `Set static` para:
   - `Content-Security-Policy` = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://gym-ai-agent-backend-staging.onrender.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`
   - `X-Frame-Options` = `DENY`
   - `X-Content-Type-Options` = `nosniff`
   - `Strict-Transport-Security` = `max-age=31536000; includeSubDomains; preload`
   - `Referrer-Policy` = `strict-origin-when-cross-origin`
   - `Permissions-Policy` = `geolocation=(), microphone=(), camera=(), payment=(), usb=()`
4. Guardar, desplegar cambios y revalidar con:

```powershell
pwsh .\scripts\verify-portal-headers.ps1 -Url "https://admin.tucofitness.com"
```

## Paso E - Revocar sesiones y validar

1. Invalidar sesiones antiguas si aplica estrategia de corte.
2. Verificar reportes en:
   - `backend/prisma/SECURITY_OPERATIONAL_AUDIT_REPORT.sql`
   - `backend/prisma/SECURITY_OPERATIONAL_EVENTS_7D.sql`
3. Confirmar señal operativa sin degradacion inesperada.

---

## 5) Checklist de salida

- [ ] Secretos rotados en `staging` y `prod`
- [ ] Smokes de auth y plataforma exitosos
- [ ] No hay secretos en archivos versionados
- [ ] Registro de rotacion actualizado
- [ ] Alertas de seguridad revisadas post-cambio

---

## 6) Registro de rotaciones

Plantilla minima por evento:

- Fecha:
- Entorno:
- Secreto(s) rotado(s):
- Responsable:
- Motivo:
- Resultado validacion:
- Incidencias:

---

## 7) Riesgos frecuentes y mitigacion

1. Error por secreto desfasado entre servicios:
   - Mitigar con despliegue coordinado y smoke inmediato.
2. Sesiones invalidadas masivamente:
   - Comunicar ventana y habilitar fallback operativo.
3. Exposicion accidental en logs:
   - Prohibir logging de variables y cuerpos sensibles.

---

## 8) Referencias internas

- Checklist principal: `docs/16_CHECKLIST_SEGURIDAD_ALTA.md`
- Backlog del piloto: `docs/17_BACKLOG_SEGURIDAD_PILOTO.md`
- Variables de ejemplo: `backend/.env.example`

---

## 9) Ejecucion registrada (Sprint S0-A)

Fecha: 2026-04-08

Resultado ejecutado en entorno local (`backend/.env`):

- `JWT_SECRET` rotado (longitud: 128, hex)
- `JWT_REFRESH_SECRET` agregado/rotado (longitud: 128, hex)
- `PLATFORM_JWT_SECRET` rotado (longitud: 128, hex)
- `PLATFORM_ADMIN_TOKEN` rotado (longitud: 128, hex)

Validacion tecnica:

- `npm run typecheck` en backend: **PASS**

Pendientes para cierre completo de INF-SEC-01 fuera de este workspace:

- Rotar secretos equivalentes en `staging` y `produccion` dentro del proveedor de hosting.
- Rotar `OPENAI_API_KEY` y `RESEND_API_KEY` en gestores de secretos remotos.
- Rotar credenciales de base de datos (`DATABASE_URL`) si se confirma exposicion operacional.