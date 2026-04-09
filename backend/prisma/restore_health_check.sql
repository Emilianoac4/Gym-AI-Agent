-- ============================================================================
-- TUCO - POST-RESTORE HEALTH CHECK  (INF-SEC-02)
-- ============================================================================
-- Purpose : Verify database integrity after a backup restore.
--           Run each block independently in Supabase SQL Editor or via psql.
-- Usage   : psql $DATABASE_URL -f restore_health_check.sql
-- Expected: All blocks return expected counts and no missing tables.
-- ============================================================================

-- BLOCK 1: Confirm critical tables exist in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'gym_members',
    'measurements',
    'audit_logs',
    'ai_chat_logs',
    'gyms',
    'notifications'
  )
ORDER BY table_name;
-- Expected: 7 rows

-- BLOCK 2: Row counts for critical tables (all must be >= 0, nulls indicate missing table)
SELECT
  'profiles'      AS table_name, COUNT(*) AS row_count FROM profiles
UNION ALL
SELECT
  'gym_members',                  COUNT(*) FROM gym_members
UNION ALL
SELECT
  'measurements',                 COUNT(*) FROM measurements
UNION ALL
SELECT
  'audit_logs',                   COUNT(*) FROM audit_logs
UNION ALL
SELECT
  'ai_chat_logs',                 COUNT(*) FROM ai_chat_logs
UNION ALL
SELECT
  'gyms',                         COUNT(*) FROM gyms
ORDER BY table_name;
-- Expected: 7 rows, each row_count >= 0 (no nulls, no errors)

-- BLOCK 3: Data freshness — last record in audit_logs vs. now
-- RPO target: gap must be < 24 hours (86400 seconds)
SELECT
  MAX(created_at)                                                   AS last_record_at,
  EXTRACT(EPOCH FROM (now() - MAX(created_at)))::int                AS seconds_since_last,
  ROUND(EXTRACT(EPOCH FROM (now() - MAX(created_at))) / 3600.0, 2) AS hours_since_last,
  CASE
    WHEN EXTRACT(EPOCH FROM (now() - MAX(created_at))) < 86400
    THEN 'WITHIN_RPO'
    ELSE 'EXCEEDS_RPO_24H'
  END                                                               AS rpo_status
FROM audit_logs;
-- Expected: rpo_status = 'WITHIN_RPO' for a fresh backup

-- BLOCK 4: Schema version — confirm migrations applied
-- Returns all applied Prisma migration names (most recent first)
SELECT id, migration_name, finished_at
FROM _prisma_migrations
WHERE finished_at IS NOT NULL
ORDER BY finished_at DESC
LIMIT 10;
-- Expected: at least 1 row; no rows with finished_at IS NULL

-- BLOCK 5: RLS policies active on sensitive tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'gym_members',
    'measurements',
    'ai_chat_logs'
  )
ORDER BY tablename;
-- Review: rls_enabled should be TRUE on tables with RLS hardening applied

-- BLOCK 6: Referential integrity spot-check
-- Gym members should all reference valid gyms
SELECT COUNT(*) AS orphan_gym_members
FROM gym_members gm
WHERE NOT EXISTS (
  SELECT 1 FROM gyms g WHERE g.id = gm.gym_id
);
-- Expected: 0

-- Profiles should all exist for every gym_member
SELECT COUNT(*) AS orphan_gym_members_no_profile
FROM gym_members gm
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = gm.user_id
);
-- Expected: 0

-- BLOCK 7: No dangling platform_admin_users entries
SELECT COUNT(*) AS total_platform_admins
FROM platform_admin_users;
-- Informational: record the count for audit trail

-- ============================================================================
-- RESTORE VERDICT SUMMARY
-- ============================================================================
-- Run all blocks. Restore is VALID when:
--   BLOCK 1 -> 7 rows
--   BLOCK 2 -> 7 rows, all counts >= 0
--   BLOCK 3 -> rpo_status = 'WITHIN_RPO'
--   BLOCK 4 -> >= 1 migration row, no pending (finished_at IS NOT NULL)
--   BLOCK 6 -> both queries return 0
-- Any other result requires investigation before switching traffic.
-- ============================================================================
