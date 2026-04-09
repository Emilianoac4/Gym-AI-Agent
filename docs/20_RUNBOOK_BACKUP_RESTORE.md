# 20 - Runbook: Backup / Restore — INF-SEC-02

**Version**: 1.0  
**Fecha**: Abril 8, 2026  
**Estado**: Activo — simulacro completado

---

## 1. Objetivos RPO / RTO

| Métrica | Objetivo | Justificación |
|---|---|---|
| **RPO** (Recovery Point Objective) | ≤ 24 horas | Supabase tiene backups automáticos diarios (PITR disponible en planes Pro). Pérdida máxima aceptable: 1 día de datos transaccionales. |
| **RTO** (Recovery Time Objective) | ≤ 2 horas | Tiempo máximo para restaurar en base nueva, verificar integridad y redirigir el backend. |

> En staging (plan Free): los backups son lógicos (SQL dump) con rotación de 7 días. En producción se debe contratar plan Pro o superior para PITR real.

---

## 2. Arquitectura de backup

| Capa | Proveedor | Método | Frecuencia |
|---|---|---|---|
| Base de datos | Supabase (PostgreSQL 15) | Backup automático de Supabase + export manual `pg_dump` | Automático diario; export manual bajo demanda |
| Storage de archivos | Supabase Storage | No aplica en staging (imágenes como base64 en DB) | — |
| Secretos / Configuración | Render (env vars) | Exportación manual del panel de Render | Bajo demanda / ante rotación |
| Código fuente | GitHub (`main`) | Push a rama protegida | Continuo (commit a commit) |

---

## 3. Procedimiento de backup manual (pg_dump)

### Pre-requisitos
- `psql` y `pg_dump` instalados localmente (PostgreSQL 15+).
- Variable `DATABASE_URL` disponible (formato conexión: `postgresql://user:pass@host:5432/dbname`).

```powershell
# 1. Exportar dump completo (schema + datos)
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
pg_dump $env:DATABASE_URL `
  --format=custom `
  --file="backup_gymapi_$timestamp.dump" `
  --no-password

# 2. Verificar que el archivo tiene contenido
Get-Item "backup_gymapi_$timestamp.dump" | Select-Object Name, Length
```

---

## 4. Procedimiento de restore

### 4.1 Restore completo en base nueva

```powershell
# 1. Crear base de datos nueva en Supabase dashboard (o con psql)
#    Nombre sugerido: gymapi_restore_YYYYMMDD

# 2. Restaurar dump
pg_restore `
  --dbname="$env:DATABASE_URL_RESTORE" `
  --no-owner `
  --no-privileges `
  --verbose `
  "backup_gymapi_YYYYMMDD_HHmmss.dump"

# 3. Validar integridad (ejecutar restore_health_check.sql)
psql $env:DATABASE_URL_RESTORE -f backend/prisma/restore_health_check.sql
```

### 4.2 Restore vía Supabase Dashboard (PITR — plan Pro)

1. Ir a **Supabase Dashboard → Project Settings → Database → Backups**.
2. Seleccionar el punto de restauración (fecha/hora objetivo).
3. Clic en **Restore** → confirmar nombre de proyecto target.
4. Esperar notificación de Supabase (estimado: 15–60 min según tamaño).
5. Actualizar `DATABASE_URL` en Render con la nueva URL de conexión.
6. Ejecutar `POST /health` en staging para confirmar conectividad.
7. Ejecutar `backend/scripts/simulate-restore-check.ps1` para validación integral.

---

## 5. Simulacro de restore

El simulacro se ejecuta con el script `backend/scripts/simulate-restore-check.ps1` contra staging.
No requiere interrumpir el servicio: valida solo lectura e integridad.

```powershell
cd backend
.\scripts\simulate-restore-check.ps1 `
  -ApiBaseUrl "https://gym-ai-agent-backend-staging.onrender.com" `
  -DatabaseUrl $env:DATABASE_URL
```

**Salida esperada:**
```
[INF-SEC-02] === SIMULACRO BACKUP/RESTORE ===
[INF-SEC-02] T0: 2026-04-08T00:00:00Z
[INF-SEC-02] STEP 1 - Backend health: PASS (200 OK)
[INF-SEC-02] STEP 2 - DB connectivity: PASS (tablas encontradas: 15)
[INF-SEC-02] STEP 3 - Data freshness: PASS (último registro: hace 3 min)
[INF-SEC-02] STEP 4 - Schema integrity: PASS (todas las tablas críticas presentes)
[INF-SEC-02] STEP 5 - RTO estimate: 00:01:42 (dentro del objetivo de 02:00:00)
[INF-SEC-02] === RESULTADO: PASS ===
```

**Registro del simulacro:**
El script escribe el resultado en `backend/scripts/logs/restore_check_YYYYMMDD.log`.

---

## 6. Checklist post-restore

Ejecutar en orden después de cualquier restore real:

- [ ] `GET /health` responde `{ ok: true }` desde internet.
- [ ] Login funciona (verifica que JWT_SECRET corresponde al entorno restaurado).
- [ ] Ejecutar `backend/prisma/restore_health_check.sql` — todas las queries retornan resultados esperados.
- [ ] Verificar que `audit_logs` contiene registros recientes (si el backup era fresco).
- [ ] Verificar que tablas críticas (`profiles`, `gym_members`, `measurements`, `ai_chat_logs`) tienen row count > 0.
- [ ] Confirmar que no hay migraciones pendientes (`npx prisma migrate status`).
- [ ] Actualizar `DATABASE_URL` en Render si se cambió el endpoint de conexión.
- [ ] Notificar al equipo: restore completado, RTO efectivo = T_restore - T_inicio.

---

## 7. Responsables y frecuencia de simulacro

| Actividad | Frecuencia | Responsable |
|---|---|---|
| Backup automático Supabase | Diario (automático) | Supabase |
| Export manual pg_dump | Mensual | Dev/Ops |
| Simulacro de restore con script | Trimestral | Dev lead |
| Revisión de este runbook | Semestral | Dev lead |

---

## 8. Alertas relacionadas

Los picos de errores `500` pueden indicar corrupción de datos post-deploy.  
Ver `INF-SEC-04` (alertas operativas) para el mecanismo de detección automática.

Ver `backend/prisma/alerts_spike_detection.sql` para las queries de detección manual en Supabase SQL Editor.
