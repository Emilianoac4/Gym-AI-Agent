# Auditoria de scripts SQL en Supabase

## Resumen ejecutivo

El directorio `backend/prisma` mezcla 4 tipos de scripts:

1. `bootstrap` historico de fases tempranas.
2. migraciones incrementales reales.
3. parches de compatibilidad o duplicados.
4. utilitarios de datos que no deben tratarse como migraciones.

La conclusion principal es esta:

- No existe hoy un camino limpio y unico para crear una base nueva con el esquema actual ejecutando los archivos uno por uno.
- Hay scripts duplicados u obsoletos que conviene sacar del flujo operativo.
- Hay al menos un hueco funcional: `membership_start_at` y `membership_end_at` siguen existiendo en el esquema actual, pero el unico script que los agrega tambien reintroduce una columna obsoleta en `users`.

## Clasificacion por archivo

### Base historica

- `init_supabase.sql`
  - Crea la base inicial de Fase 1: `gyms`, `users`, `user_profiles`, `measurements`.
  - Parte de un modelo viejo: `UserRole` solo tiene `admin` y `member`.
  - No crea `global_user_accounts`, membresias, gobernanza, notificaciones, salud, disponibilidad ni soft-delete.

### Incrementales vigentes

- `add_trainer_role.sql`
  - Agrega `trainer` al enum `UserRole`.

- `add_profile_gender.sql`
  - Agrega `gender` a `user_profiles`.

- `add_global_user_accounts.sql`
  - Introduce `global_user_accounts`.
  - Migra autenticacion fuera de `users`.
  - Agrega `global_user_id`, `username`, `country`, `state`, `district`.
  - Elimina columnas de auth viejas de `users`.

- `add_membership_transactions.sql`
  - Crea `membership_transactions` y `membership_daily_summary_dispatches`.

- `add_currency_and_tickets.sql`
  - Agrega `currency` a `gyms`.
  - Crea `emergency_tickets`.

- `add_health_connections.sql`
  - Crea enum `HealthProvider`.
  - Crea `user_health_connections`.

- `add_availability_schedule.sql`
  - Crea enum `DayOfWeek`.
  - Crea enum `PermissionGrantAction` con `availability_write`.
  - Crea `gym_schedule_templates`, `gym_schedule_exceptions`, `user_permission_grants`.

- `add_notifications_permission_grant.sql`
  - Extiende `PermissionGrantAction` con `notifications_send`.

- `add_trainer_presence_and_reports.sql`
  - Crea `trainer_presence_sessions` y `membership_report_exports`.

- `add_notifications.sql`
  - Crea `push_tokens`, `general_notifications`, `message_threads`, `direct_messages`.

- `add_platform_governance.sql`
  - Crea enums `SubscriptionPlanTier` y `GymSubscriptionStatus`.
  - Crea `gym_subscriptions`, `gym_subscription_audits`, `platform_admin_users`.
  - Le falta el campo `usernames` que si existe en el esquema Prisma actual.

- `add_platform_admin_users.sql`
  - Completa `platform_admin_users` agregando `usernames`.
  - En una base nueva, hoy se necesita despues de `add_platform_governance.sql` si quieres quedar alineado con `schema.prisma`.

- `add_soft_delete_gyms.sql`
  - Agrega flujo de soft-delete a `gyms`.

- `add_soft_delete_users.sql`
  - Agrega flujo de soft-delete a `users` (`deleted_at` + indice).
  - Estado: ya aplicado en Supabase.

- `sync_membership_transaction_currency_with_gym.sql`
  - Parche de datos historicos.
  - Solo aplica si ya existian transacciones antes de introducir `gyms.currency`.

### Duplicados u obsoletos

- `add_ai_chat_log.sql`
  - Obsoleto y peligroso.
  - Re-crea una base casi completa usando un esquema viejo.
  - Vuelve a definir `UserRole` sin `trainer` y asume auth dentro de `users`.
  - No debe formar parte del flujo actual.

- `add_ai_chat_logs_only.sql`
  - Duplica la creacion de `AIChatLogType` y `ai_chat_logs`.
  - No es idempotente.

- `ensure_ai_chat_logs.sql`
  - Es la version mas segura del parche de AI logs.
  - Solo deberia usarse para corregir una base legacy que todavia no tenga `ai_chat_logs`.
  - No hace falta en una base nueva si se crea un bootstrap consolidado.

- `add_email_auth_fields.sql`
  - Historico.
  - Agrega columnas de auth a `users`, pero esas columnas ya no pertenecen a `users` en el esquema actual.
  - No debe ejecutarse en una base nueva actual.

- `add_membership_and_verification_cooldown.sql`
  - Mixto e historico.
  - Tiene una parte vigente: `membership_start_at` y `membership_end_at`.
  - Tiene una parte obsoleta: re-agrega `email_verification_last_sent_at` en `users`.
  - Ejecutarlo tal cual en una base nueva deja drift contra `schema.prisma`.

### Utilitarios, no migraciones

- `reset_validation_data.sql`
  - Limpia datos.
  - No cambia estructura.
  - Nunca debe entrar al orden de migracion.

## Validacion contra el esquema actual

El `schema.prisma` actual espera, entre otras cosas:

- `global_user_accounts` para credenciales.
- `users.global_user_id` y `users.username`.
- `users.membership_start_at` y `users.membership_end_at`.
- `platform_admin_users.usernames`.
- soft-delete en `gyms`.

Problemas detectados:

1. No hay un script limpio, dedicado y vigente para agregar solo `membership_start_at` y `membership_end_at` en `users` sin reintroducir campos obsoletos.
2. `add_platform_governance.sql` por si solo no deja `platform_admin_users` alineado con Prisma; requiere `add_platform_admin_users.sql` despues.
3. Existen 3 variantes para AI chat logs, cuando deberia existir solo una estrategia.

## Orden recomendado de referencia

### Si la base es legacy y vienes evolucionando desde Fase 1

Este es el orden mas coherente para entender la historia del esquema:

1. `init_supabase.sql`
2. `ensure_ai_chat_logs.sql`
3. `add_trainer_role.sql`
4. `add_profile_gender.sql`
5. `add_global_user_accounts.sql`
6. `add_membership_transactions.sql`
7. `add_currency_and_tickets.sql`
8. `sync_membership_transaction_currency_with_gym.sql` solo si ya habia datos historicos
9. `add_health_connections.sql`
10. `add_availability_schedule.sql`
11. `add_notifications_permission_grant.sql`
12. `add_trainer_presence_and_reports.sql`
13. `add_notifications.sql`
14. `add_platform_governance.sql`
15. `add_platform_admin_users.sql`
16. `add_soft_delete_gyms.sql`
17. `add_soft_delete_users.sql`

Nota importante:

- `add_email_auth_fields.sql` y `add_membership_and_verification_cooldown.sql` quedan fuera de este orden recomendado para una base actual, porque pertenecen a una etapa intermedia anterior a `global_user_accounts` y hoy generan drift parcial.

### Si la base es nueva y quieres quedar igual que el esquema actual

No recomiendo seguir ejecutando todos estos archivos manuales uno por uno.

Lo correcto es crear un nuevo `baseline_current_schema.sql` o migraciones Prisma formales, porque hoy el set existente no representa de manera limpia el estado final.

## Lista minima de archivos a conservar operativamente

### Mantener como referencia activa

- `init_supabase.sql`
- `add_trainer_role.sql`
- `add_profile_gender.sql`
- `add_global_user_accounts.sql`
- `add_membership_transactions.sql`
- `add_currency_and_tickets.sql`
- `sync_membership_transaction_currency_with_gym.sql`
- `add_health_connections.sql`
- `add_availability_schedule.sql`
- `add_notifications_permission_grant.sql`
- `add_trainer_presence_and_reports.sql`
- `add_notifications.sql`
- `add_platform_governance.sql`
- `add_platform_admin_users.sql`
- `add_soft_delete_gyms.sql`
- `add_soft_delete_users.sql`
- `ensure_ai_chat_logs.sql`

### Sacar del flujo operativo y archivar

- `add_ai_chat_log.sql`
- `add_ai_chat_logs_only.sql`
- `add_email_auth_fields.sql`
- `add_membership_and_verification_cooldown.sql`
- `reset_validation_data.sql`

## Proxima limpieza recomendada

1. Crear un bootstrap unico para base nueva alineado al `schema.prisma` actual.
2. Crear un parche pequeno y aislado para `membership_start_at` y `membership_end_at`.
3. Consolidar AI logs en un solo archivo y archivar los otros dos.
4. Consolidar `platform_admin_users` dentro de `add_platform_governance.sql` o reemplazar ambos por una migracion nueva.
5. Dejar `reset_validation_data.sql` en una carpeta `scripts/maintenance` o similar para no confundirlo con migraciones.