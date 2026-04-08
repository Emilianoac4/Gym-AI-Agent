-- ============================================================================
-- TUCO - SECURITY HARDENING VALIDATION
-- ============================================================================
-- Run after SECURITY_HARDENING_PHASE1.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Verify RLS + FORCE RLS status
-- Expected: rowsecurity = true, forcerowsecurity = true on all rows
-- ----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rowsecurity,
  c.relforcerowsecurity AS forcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'global_user_accounts',
    'users',
    'user_profiles',
    'measurements',
    'user_health_connections',
    'ai_chat_logs',
    'push_tokens',
    'emergency_tickets',
    'assistance_requests',
    'membership_transactions',
    'routine_session_logs',
    'routine_exercise_logs',
    'audit_logs',
    'user_permission_grants'
  )
ORDER BY c.relname;

-- ----------------------------------------------------------------------------
-- 2) Verify anon has no table privileges on critical tables
-- Expected: 0 rows
-- ----------------------------------------------------------------------------
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'anon'
  AND table_name IN (
    'global_user_accounts',
    'users',
    'user_profiles',
    'measurements',
    'user_health_connections',
    'ai_chat_logs',
    'push_tokens',
    'emergency_tickets',
    'assistance_requests',
    'membership_transactions',
    'routine_session_logs',
    'routine_exercise_logs',
    'audit_logs',
    'user_permission_grants'
  )
ORDER BY table_name, privilege_type;

-- ----------------------------------------------------------------------------
-- 3) Verify policy inventory still present (should not shrink unexpectedly)
-- Expected around 60 based on current deployment
-- ----------------------------------------------------------------------------
SELECT COUNT(*) AS total_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'global_user_accounts',
    'users',
    'user_profiles',
    'measurements',
    'user_health_connections',
    'ai_chat_logs',
    'push_tokens',
    'emergency_tickets',
    'assistance_requests',
    'membership_transactions',
    'routine_session_logs',
    'routine_exercise_logs',
    'audit_logs',
    'user_permission_grants'
  );

-- ----------------------------------------------------------------------------
-- 4) Integrity spot-check (same as core checklist quick sample)
-- Expected: 0
-- ----------------------------------------------------------------------------
SELECT 'measurements.user_id -> users.id' AS check_name, COUNT(*) AS orphan_count
FROM measurements m
LEFT JOIN users u ON u.id::text = m.user_id::text
WHERE u.id IS NULL;
