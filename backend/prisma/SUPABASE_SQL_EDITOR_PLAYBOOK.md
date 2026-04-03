# Playbook completo para ordenar los `Privates` del SQL Editor en Supabase

## Objetivo

Este playbook te guia de principio a fin para:

1. inventariar los 26 scripts guardados en el SQL Editor de Supabase;
2. decidir cuales conservar, cuales marcar como legacy, cuales archivar y cuales mover a mantenimiento;
3. evitar ejecutar scripts obsoletos o duplicados;
4. dejar una organizacion clara para futuro;
5. validar que la base actual sigue alineada con el backend.

Este proceso no asume que vas a ejecutar cambios estructurales hoy. Primero ordenamos y validamos. Despues, si hace falta, ejecutamos correcciones puntuales.

## Archivos de apoyo del repo

Usa estos dos documentos como referencia mientras haces el proceso:

- [backend/prisma/SQL_MIGRATION_AUDIT.md](backend/prisma/SQL_MIGRATION_AUDIT.md)
- [backend/prisma/SUPABASE_SQL_EDITOR_CLEANUP.md](backend/prisma/SUPABASE_SQL_EDITOR_CLEANUP.md)

## Resultado esperado

Al final deberias tener tus scripts remotos clasificados en 4 grupos:

- `ACTIVE_`: scripts vigentes que explican la evolucion funcional del esquema.
- `LEGACY_`: parches historicos que solo sirven para bases antiguas.
- `ARCHIVE_`: duplicados u obsoletos que no deben volver a usarse.
- `MAINT_`: mantenimiento o limpieza, no migraciones.

## Regla principal antes de empezar

No ejecutes ningun script solo porque exista en el SQL Editor.

En este proceso primero vamos a:

1. respaldar;
2. inventariar;
3. clasificar;
4. renombrar u ordenar;
5. validar;
6. decidir si falta algun parche nuevo.

## Fase 1: Preparacion y respaldo

### Paso 1. Crear una captura de lo que tienes hoy

En Supabase:

1. Entra al proyecto correcto.
2. Abre `SQL Editor`.
3. Ubica la lista completa de `Privates`.
4. Haz una captura de pantalla o exporta manualmente los nombres a una nota temporal.

Tu objetivo aqui es tener una lista exacta de los 26 nombres actuales antes de mover nada.

### Paso 2. Confirmar ambiente

Antes de tocar nada, confirma si estas mirando:

- desarrollo;
- staging;
- produccion.

Si no estas 100 por ciento seguro del ambiente, detente. Este tipo de limpieza debe hacerse sabiendo exactamente en que proyecto estas.

### Paso 3. Respaldar contenido importante

Por cada script que exista solo en Supabase o cuyo nombre no coincida con el repo:

1. abre el script;
2. copia su contenido;
3. guárdalo en una nota temporal o archivo local.

Objetivo:

- no perder ningun SQL que exista remoto pero no este versionado localmente.

## Fase 2: Inventario exacto

### Paso 4. Comparar la lista remota contra el repo

Abre la carpeta local [backend/prisma](backend/prisma).

Tu lista base del repo es esta:

- `init_supabase.sql`
- `ensure_ai_chat_logs.sql`
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
- `add_ai_chat_log.sql`
- `add_ai_chat_logs_only.sql`
- `add_email_auth_fields.sql`
- `add_membership_and_verification_cooldown.sql`
- `reset_validation_data.sql`

Ahora compara uno por uno con los 26 `Privates` de Supabase.

Marca cada uno asi:

- `coincide exacto con repo`;
- `parecido pero con otro nombre`;
- `solo existe en Supabase`.

### Paso 5. Detectar scripts solo remotos

Si encuentras scripts que existen solo en Supabase:

1. no los borres;
2. copialos a una lista aparte;
3. revisa si son migraciones reales, pruebas, consultas sueltas o reparaciones manuales.

Si quieres, luego me pegas esa lista y te ayudo a clasificarla tambien.

## Fase 3: Clasificacion

### Paso 6. Usa esta decision por defecto

Clasifica cada archivo con esta tabla:

#### `ACTIVE_`

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

#### `LEGACY_`

- `ensure_ai_chat_logs.sql`
- `sync_membership_transaction_currency_with_gym.sql`

#### `ARCHIVE_`

- `add_ai_chat_log.sql`
- `add_ai_chat_logs_only.sql`
- `add_email_auth_fields.sql`
- `add_membership_and_verification_cooldown.sql`

#### `MAINT_`

- `reset_validation_data.sql`

## Fase 4: Organizacion dentro de Supabase

### Paso 7. Elegir estrategia de orden

Como el SQL Editor no siempre se usa como un sistema formal de migraciones, te recomiendo organizar por prefijo de nombre.

Usa esta convención:

- `ACTIVE_01_init_supabase`
- `ACTIVE_02_add_trainer_role`
- `ACTIVE_03_add_profile_gender`
- `ACTIVE_04_add_global_user_accounts`
- `ACTIVE_05_add_membership_transactions`
- `ACTIVE_06_add_currency_and_tickets`
- `ACTIVE_07_add_health_connections`
- `ACTIVE_08_add_availability_schedule`
- `ACTIVE_09_add_notifications_permission_grant`
- `ACTIVE_10_add_trainer_presence_and_reports`
- `ACTIVE_11_add_notifications`
- `ACTIVE_12_add_platform_governance`
- `ACTIVE_13_add_platform_admin_users`
- `ACTIVE_14_add_soft_delete_gyms`
- `LEGACY_01_ensure_ai_chat_logs`
- `LEGACY_02_sync_membership_transaction_currency_with_gym`
- `ARCHIVE_add_ai_chat_log`
- `ARCHIVE_add_ai_chat_logs_only`
- `ARCHIVE_add_email_auth_fields`
- `ARCHIVE_add_membership_and_verification_cooldown`
- `MAINT_reset_validation_data`

No necesitas que el nombre quede identico al archivo local. Lo importante es que el grupo sea obvio y que el orden cuente la historia correcta.

### Paso 8. Renombrar o duplicar con nuevo nombre

En muchos casos en Supabase sera mas seguro:

1. abrir el script viejo;
2. crear uno nuevo con el nombre limpio;
3. pegar el contenido;
4. guardar;
5. dejar el viejo marcado para borrado o archivo manual.

Haz esto cuando la UI no permita renombrar comodamente o cuando quieras evitar perder historial visual.

### Paso 9. Archivar los obsoletos

Para los `ARCHIVE_` no hace falta borrarlos inmediatamente si te da mas seguridad conservarlos unas semanas.

Opciones validas:

1. renombrarlos con prefijo `ARCHIVE_`;
2. mover su contenido a un documento local y eliminarlos del SQL Editor;
3. mantenerlos temporalmente con nota clara al inicio indicando que no deben ejecutarse.

Si quieres minimizar riesgo operativo, yo prefiero que queden visibles solo si estan claramente marcados como `ARCHIVE_`.

## Fase 5: Validacion real de la base actual

Aqui no validamos nombres de scripts; validamos que la base tenga lo que el backend espera.

### Paso 10. Ejecutar consulta de chequeo estructural

En el SQL Editor, ejecuta esta consulta de solo lectura:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'gyms',
    'global_user_accounts',
    'users',
    'user_profiles',
    'measurements',
    'ai_chat_logs',
    'membership_transactions',
    'membership_daily_summary_dispatches',
    'gym_schedule_templates',
    'gym_schedule_exceptions',
    'user_permission_grants',
    'trainer_presence_sessions',
    'membership_report_exports',
    'push_tokens',
    'general_notifications',
    'message_threads',
    'direct_messages',
    'emergency_tickets',
    'user_health_connections',
    'gym_subscriptions',
    'gym_subscription_audits',
    'platform_admin_users'
  )
ORDER BY table_name;
```

Debes ver todas esas tablas si la base ya esta cercana al esquema actual.

### Paso 11. Validar columnas criticas

Ejecuta esta consulta:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'users' AND column_name IN ('global_user_id', 'username', 'membership_start_at', 'membership_end_at'))
    OR (table_name = 'gyms' AND column_name IN ('currency', 'country', 'state', 'district', 'deleted_at', 'recover_until', 'deleted_by_platform_user_id', 'deletion_pending_at', 'deletion_challenge_hash', 'deletion_challenge_expires_at', 'deletion_requested_by_platform_user_id'))
    OR (table_name = 'platform_admin_users' AND column_name IN ('usernames'))
    OR (table_name = 'global_user_accounts' AND column_name IN ('email_verified_at', 'email_verification_last_sent_at', 'email_verification_token_hash', 'email_verification_token_expires_at', 'password_reset_token_hash', 'password_reset_token_expires_at'))
  )
ORDER BY table_name, column_name;
```

Esto te dira si faltan columnas clave del esquema actual.

### Paso 12. Validar enums criticos

Ejecuta:

```sql
SELECT t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
  'UserRole',
  'AIChatLogType',
  'MembershipTransactionType',
  'PaymentMethod',
  'DayOfWeek',
  'PermissionGrantAction',
  'HealthProvider',
  'SubscriptionPlanTier',
  'GymSubscriptionStatus'
)
ORDER BY t.typname, e.enumsortorder;
```

Confirma especialmente esto:

- `UserRole` incluye `trainer`.
- `PermissionGrantAction` incluye `availability_write` y `notifications_send`.

### Paso 13. Validar columnas obsoletas que no deberian seguir en `users`

Ejecuta:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN (
    'password_hash',
    'email_verified_at',
    'email_verification_last_sent_at',
    'email_verification_token_hash',
    'email_verification_token_expires_at',
    'password_reset_token_hash',
    'password_reset_token_expires_at'
  )
ORDER BY column_name;
```

Interpretacion:

- si no devuelve filas, mejor, porque coincide con el modelo actual basado en `global_user_accounts`;
- si devuelve filas, tu base arrastra restos de un esquema viejo o algun script historico fue ejecutado en un punto intermedio.

## Fase 6: Decision despues de validar

### Escenario A. Todo lo importante existe y no hay restos obsoletos

Accion:

- solo limpia y organiza los scripts del SQL Editor;
- no ejecutes nada nuevo.

### Escenario B. Faltan tablas o enums enteros

Accion:

- identifica que script activo los introducia;
- verifica primero si ya fue ejecutado parcialmente;
- si el script es seguro e idempotente, puede ejecutarse en desarrollo o staging antes de produccion.

### Escenario C. Faltan `membership_start_at` o `membership_end_at`

Accion:

- no ejecutes directamente `add_membership_and_verification_cooldown.sql` en una base actual que ya usa `global_user_accounts`;
- ese archivo mezcla una parte util con una columna obsoleta en `users`.

En ese caso hay que crear un parche nuevo y limpio.

### Escenario D. Siguen existiendo columnas viejas de auth en `users`

Accion:

- no borres columnas en caliente sin revisar si algun flujo todavia las lee;
- primero validamos en backend que todo consuma `global_user_accounts`;
- despues se hace un parche controlado para limpiar drift.

## Fase 7: Orden recomendado de lectura historica

Si quieres que los `ACTIVE_` cuenten la historia del esquema, usa este orden:

1. `init_supabase.sql`
2. `add_trainer_role.sql`
3. `add_profile_gender.sql`
4. `add_global_user_accounts.sql`
5. `add_membership_transactions.sql`
6. `add_currency_and_tickets.sql`
7. `add_health_connections.sql`
8. `add_availability_schedule.sql`
9. `add_notifications_permission_grant.sql`
10. `add_trainer_presence_and_reports.sql`
11. `add_notifications.sql`
12. `add_platform_governance.sql`
13. `add_platform_admin_users.sql`
14. `add_soft_delete_gyms.sql`

Los `LEGACY_` quedan fuera de la secuencia principal.

## Fase 8: Que no debes hacer

1. No ejecutar `add_ai_chat_log.sql` en ningun entorno actual.
2. No ejecutar `add_ai_chat_logs_only.sql` si ya existe `ai_chat_logs` o si ya tienes `ensure_ai_chat_logs.sql` como parche legacy.
3. No ejecutar `add_email_auth_fields.sql` en una base que ya se movio a `global_user_accounts`.
4. No ejecutar `add_membership_and_verification_cooldown.sql` sin antes separarlo en un parche limpio.
5. No usar `reset_validation_data.sql` como si fuera migracion.

## Fase 9: Checklist final

Cuando termines, deberias poder responder `si` a esto:

- tengo una lista clara de los 26 `Privates`;
- se cuales son `ACTIVE_`, `LEGACY_`, `ARCHIVE_` y `MAINT_`;
- ningun script obsoleto quedo ambiguo;
- valide tablas, enums y columnas importantes;
- no ejecute scripts viejos por error;
- se si necesito o no un parche nuevo.

## Siguiente paso recomendado despues de la limpieza

Despues de ordenar los `Privates`, lo correcto a nivel de ingenieria es esto:

1. crear un `baseline_current_schema.sql` para bases nuevas;
2. crear un parche pequeno y limpio para `membership_start_at` y `membership_end_at`;
3. archivar definitivamente los scripts obsoletos.

Si quieres seguir por el camino mas correcto y menos frágil, ese es el siguiente trabajo que conviene hacer en el repo.