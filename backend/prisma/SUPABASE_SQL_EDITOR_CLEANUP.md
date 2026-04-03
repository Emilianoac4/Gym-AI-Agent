# Supabase SQL Editor Cleanup

## Objetivo

Esta guia sirve para depurar los scripts guardados como `Private` en el SQL Editor de Supabase y separar:

- que si conviene conservar;
- que solo sirve para bases legacy;
- que conviene archivar;
- que no es migracion, sino mantenimiento.

Importante:

- Esta clasificacion se basa en los archivos versionados del repo en `backend/prisma`.
- No tengo visibilidad directa de los 26 `Privates` remotos en tu proyecto de Supabase.
- Si en Supabase hay nombres distintos, compara por contenido y no solo por titulo.

## Regla operativa simple

- `ACTIVO`: conservar como migracion historica o incremental valida.
- `LEGACY`: conservar solo si ya existe una base vieja que fue creciendo por etapas.
- `ARCHIVAR`: sacar del flujo normal; no usar para nuevas ejecuciones.
- `MANTENIMIENTO`: no es migracion estructural.

## Matriz por archivo

| Archivo | Estado | Usar en base nueva | Usar en base legacy | Motivo |
|---|---|---:|---:|---|
| `init_supabase.sql` | ACTIVO | No ideal | Si | Base historica inicial de Fase 1. |
| `ensure_ai_chat_logs.sql` | LEGACY | No | Si | Parche idempotente para `ai_chat_logs` en bases viejas. |
| `add_trainer_role.sql` | ACTIVO | Si | Si | Agrega `trainer` al enum `UserRole`. |
| `add_profile_gender.sql` | ACTIVO | Si | Si | Agrega `gender` a `user_profiles`. |
| `add_global_user_accounts.sql` | ACTIVO | Si | Si | Migra autenticacion a `global_user_accounts`. |
| `add_membership_transactions.sql` | ACTIVO | Si | Si | Crea tablas de transacciones y resumen diario. |
| `add_currency_and_tickets.sql` | ACTIVO | Si | Si | Agrega `currency` a `gyms` y crea `emergency_tickets`. |
| `sync_membership_transaction_currency_with_gym.sql` | LEGACY | No | Si, si habia datos | Solo corrige datos historicos. |
| `add_health_connections.sql` | ACTIVO | Si | Si | Crea enum y tabla de conexiones de salud. |
| `add_availability_schedule.sql` | ACTIVO | Si | Si | Crea disponibilidad y `user_permission_grants`. |
| `add_notifications_permission_grant.sql` | ACTIVO | Si | Si | Extiende `PermissionGrantAction` con `notifications_send`. |
| `add_trainer_presence_and_reports.sql` | ACTIVO | Si | Si | Crea presencia de entrenadores y exportes. |
| `add_notifications.sql` | ACTIVO | Si | Si | Crea notificaciones, threads y mensajes. |
| `add_platform_governance.sql` | ACTIVO | Si | Si | Crea suscripciones y admin de plataforma, pero incompleto respecto a Prisma actual. |
| `add_platform_admin_users.sql` | ACTIVO | Si, despues del anterior | Si | Completa `platform_admin_users.usernames`. |
| `add_soft_delete_gyms.sql` | ACTIVO | Si | Si | Agrega soft-delete y ventana de recuperacion en `gyms`. |
| `add_ai_chat_log.sql` | ARCHIVAR | No | No | Script viejo que recrea una base obsoleta. |
| `add_ai_chat_logs_only.sql` | ARCHIVAR | No | No | Duplicado no idempotente de AI logs. |
| `add_email_auth_fields.sql` | ARCHIVAR | No | No | Reintroduce auth en `users`, incompatible con el esquema actual. |
| `add_membership_and_verification_cooldown.sql` | ARCHIVAR | No | No | Mezcla campos vigentes con columna obsoleta en `users`. |
| `reset_validation_data.sql` | MANTENIMIENTO | No | No | Limpieza de datos, no migracion. |

## Lista practica para limpiar los `Privates`

### Conservar como activos

- `init_supabase.sql`
- `add_trainer_role.sql`
- `add_profile_gender.sql`
- `add_global_user_accounts.sql`
- `add_membership_transactions.sql`
- `add_currency_and_tickets.sql`
- `add_health_connections.sql`
- `add_availability_schedule.sql`
- `add_notifications_permission_grant.sql`
- `add_trainer_presence_and_reports.sql`
- `add_notifications.sql`
- `add_platform_governance.sql`
- `add_platform_admin_users.sql`
- `add_soft_delete_gyms.sql`

### Conservar pero marcados como legacy

- `ensure_ai_chat_logs.sql`
- `sync_membership_transaction_currency_with_gym.sql`

### Archivar fuera del flujo operativo

- `add_ai_chat_log.sql`
- `add_ai_chat_logs_only.sql`
- `add_email_auth_fields.sql`
- `add_membership_and_verification_cooldown.sql`

### Mover a mantenimiento

- `reset_validation_data.sql`

## Que haria yo en Supabase hoy

Si en SQL Editor tienes 26 `Privates`, los dejaria asi:

1. Carpeta o prefijo `ACTIVE_` para los scripts vigentes.
2. Carpeta o prefijo `LEGACY_` para parches historicos.
3. Carpeta o prefijo `ARCHIVE_` para duplicados y obsoletos.
4. Carpeta o prefijo `MAINT_` para scripts de limpieza o soporte.

Ejemplo de nombres:

- `ACTIVE_01_init_supabase.sql`
- `ACTIVE_02_add_trainer_role.sql`
- `ACTIVE_03_add_profile_gender.sql`
- `ACTIVE_04_add_global_user_accounts.sql`
- `LEGACY_01_ensure_ai_chat_logs.sql`
- `ARCHIVE_add_ai_chat_log.sql`
- `MAINT_reset_validation_data.sql`

## Advertencias importantes

1. No ejecutes `add_ai_chat_log.sql` en ningun entorno actual.
2. No ejecutes `add_email_auth_fields.sql` ni `add_membership_and_verification_cooldown.sql` sobre una base que ya usa `global_user_accounts`.
3. `add_platform_governance.sql` no basta por si solo para alinear `platform_admin_users` con el esquema Prisma actual; necesita `add_platform_admin_users.sql` despues.
4. `add_soft_delete_gyms.sql` si sigue siendo vigente y debe quedarse como activo.

## Huecos que todavia conviene corregir en el repo

Hay dos ajustes pendientes para dejar esto realmente ordenado:

1. Crear un `baseline_current_schema.sql` para bases nuevas.
2. Crear un script pequeno solo para `membership_start_at` y `membership_end_at`, sin reintroducir `email_verification_last_sent_at` en `users`.

Hasta que eso exista, la recomendacion es tratar estos SQL como historia del esquema, no como una cadena perfecta de bootstrap moderno.