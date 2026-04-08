-- ============================================================================
-- TUCO - RLS POST-DEPLOY VALIDATION CHECKLIST
-- ============================================================================
-- Run in Supabase SQL Editor after applying RLS_UNIVERSAL.sql
-- Goal: detect inconsistencies vs expected schema/behavior.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Confirm RLS is enabled in all critical tables
-- Expected: 14 rows, all with rowsecurity = true
-- ----------------------------------------------------------------------------
SELECT
  tablename,
  rowsecurity,
  hasrules
FROM pg_tables
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
  )
ORDER BY tablename;

-- ----------------------------------------------------------------------------
-- 2) Confirm policy count per table
-- Expected total: 60
-- ----------------------------------------------------------------------------
SELECT
  tablename,
  COUNT(*) AS policy_count
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
  )
GROUP BY tablename
ORDER BY tablename;

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
-- 3) Verify no accidentally permissive policy expressions
-- Review results manually. Ideally empty or intentional only.
-- ----------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
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
  )
  AND (
    COALESCE(qual, '') ILIKE '%true%'
    OR COALESCE(with_check, '') ILIKE '%true%'
  )
ORDER BY tablename, policyname;

-- ----------------------------------------------------------------------------
-- 4) Column type sanity check for ID fields
-- Compare with expected model in your current DB
-- ----------------------------------------------------------------------------
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'global_user_accounts',
    'users',
    'platform_admin_users',
    'user_profiles',
    'measurements',
    'user_health_connections',
    'push_tokens',
    'emergency_tickets',
    'assistance_requests',
    'membership_transactions',
    'routine_session_logs',
    'routine_exercise_logs',
    'audit_logs',
    'user_permission_grants'
  )
  AND (
    column_name = 'id'
    OR column_name LIKE '%_id'
    OR column_name = 'global_user_id'
  )
ORDER BY table_name, ordinal_position;

-- ----------------------------------------------------------------------------
-- 5) Data integrity checks (orphaned references)
-- Expected: all zero counts
-- ----------------------------------------------------------------------------
SELECT 'user_profiles.user_id -> users.id' AS check_name, COUNT(*) AS orphan_count
FROM user_profiles up
LEFT JOIN users u ON u.id::text = up.user_id::text
WHERE u.id IS NULL
UNION ALL
SELECT 'measurements.user_id -> users.id', COUNT(*)
FROM measurements m
LEFT JOIN users u ON u.id::text = m.user_id::text
WHERE u.id IS NULL
UNION ALL
SELECT 'user_health_connections.user_id -> users.id', COUNT(*)
FROM user_health_connections h
LEFT JOIN users u ON u.id::text = h.user_id::text
WHERE u.id IS NULL
UNION ALL
SELECT 'push_tokens.user_id -> users.id', COUNT(*)
FROM push_tokens p
LEFT JOIN users u ON u.id::text = p.user_id::text
WHERE u.id IS NULL
UNION ALL
SELECT 'emergency_tickets.reporter_user_id -> users.id', COUNT(*)
FROM emergency_tickets e
LEFT JOIN users u ON u.id::text = e.reporter_user_id::text
WHERE u.id IS NULL
UNION ALL
SELECT 'emergency_tickets.resolved_by_user_id -> users.id', COUNT(*)
FROM emergency_tickets e
LEFT JOIN users u ON u.id::text = e.resolved_by_user_id::text
WHERE e.resolved_by_user_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'assistance_requests.member_id -> users.id', COUNT(*)
FROM assistance_requests a
LEFT JOIN users u ON u.id::text = a.member_id::text
WHERE u.id IS NULL
UNION ALL
SELECT 'assistance_requests.trainer_id -> users.id', COUNT(*)
FROM assistance_requests a
LEFT JOIN users u ON u.id::text = a.trainer_id::text
WHERE a.trainer_id IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'membership_transactions.actor_user_id -> users.id', COUNT(*)
FROM membership_transactions t
LEFT JOIN users u ON u.id::text = t.actor_user_id::text
WHERE u.id IS NULL
UNION ALL
SELECT 'user_permission_grants.user_id -> users.id', COUNT(*)
FROM user_permission_grants g
LEFT JOIN users u ON u.id::text = g.user_id::text
WHERE u.id IS NULL
UNION ALL
SELECT 'user_permission_grants.granted_by_user_id -> users.id', COUNT(*)
FROM user_permission_grants g
LEFT JOIN users u ON u.id::text = g.granted_by_user_id::text
WHERE u.id IS NULL;

-- ----------------------------------------------------------------------------
-- 6) Soft-delete consistency for active users
-- Review if active users have deleted_at populated
-- ----------------------------------------------------------------------------
SELECT COUNT(*) AS active_with_deleted_at
FROM users
WHERE is_active = true
  AND deleted_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 7) Snapshot row counts (for manual compare with previous backup/export)
-- Save these values for audit trail.
-- ----------------------------------------------------------------------------
SELECT 'global_user_accounts' AS table_name, COUNT(*) AS row_count FROM global_user_accounts
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL SELECT 'measurements', COUNT(*) FROM measurements
UNION ALL SELECT 'user_health_connections', COUNT(*) FROM user_health_connections
UNION ALL SELECT 'ai_chat_logs', COUNT(*) FROM ai_chat_logs
UNION ALL SELECT 'push_tokens', COUNT(*) FROM push_tokens
UNION ALL SELECT 'emergency_tickets', COUNT(*) FROM emergency_tickets
UNION ALL SELECT 'assistance_requests', COUNT(*) FROM assistance_requests
UNION ALL SELECT 'membership_transactions', COUNT(*) FROM membership_transactions
UNION ALL SELECT 'routine_session_logs', COUNT(*) FROM routine_session_logs
UNION ALL SELECT 'routine_exercise_logs', COUNT(*) FROM routine_exercise_logs
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL SELECT 'user_permission_grants', COUNT(*) FROM user_permission_grants
ORDER BY table_name;

-- ----------------------------------------------------------------------------
-- 8) Drift check against Prisma (run locally in backend folder)
-- npx prisma migrate status
-- npx prisma validate
-- Optional: npx prisma db pull --print
-- ----------------------------------------------------------------------------
