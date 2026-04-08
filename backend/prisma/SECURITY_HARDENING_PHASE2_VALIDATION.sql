-- ============================================================================
-- TUCO - SECURITY HARDENING PHASE 2 VALIDATION
-- ============================================================================
-- Verify that Phase 2 mutation protection is in place.
-- ============================================================================

-- BLOCK 1: Verify immutable tables have blocking policies
-- Expected: 4 rows (membership_transactions + UPDATE/DELETE, audit_logs + UPDATE/DELETE)
SELECT 'BLOCK 1: Immutable table policies' AS check_name;
SELECT 
  tablename,
  policyname,
  cmd,
  CASE WHEN permissive = false THEN 'RESTRICTIVE (blocks)' ELSE 'PERMISSIVE' END AS policy_type
FROM pg_policies
WHERE tablename IN ('membership_transactions', 'audit_logs')
  AND policyname LIKE '%block%'
  AND schemaname = 'public'
ORDER BY tablename, cmd;

-- BLOCK 2: Verify users table has UPDATE policies
-- Expected: 2 rows (user updates own, admin updates gym users)
SELECT 'BLOCK 2: Users UPDATE policies' AS check_name;
SELECT
  tablename,
  policyname,
  CASE WHEN qual IS NOT NULL THEN 'has USING' ELSE 'no USING' END AS has_read_check,
  CASE WHEN with_check IS NOT NULL THEN 'has WITH CHECK' ELSE 'no WITH CHECK' END AS has_write_limit
FROM pg_policies
WHERE tablename = 'users'
  AND policyname LIKE '%updates%'
  AND cmd = 'UPDATE'
  AND schemaname = 'public'
ORDER BY policyname;

-- BLOCK 3: Verify assistance_requests UPDATE policies
-- Expected: 1 row (trainer update with WITH CHECK)
SELECT 'BLOCK 3: Assistance requests UPDATE policies' AS check_name;
SELECT
  tablename,
  policyname,
  qual IS NOT NULL AS has_using,
  with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE tablename = 'assistance_requests'
  AND policyname LIKE '%updates%'
  AND cmd = 'UPDATE'
  AND schemaname = 'public';

-- BLOCK 4: Count restrictive (blocking) policies
-- Expected: 4 (membership UPDATE, membership DELETE, audit UPDATE, audit DELETE, 
--            + user_health_connections UPDATE, user_permission_grants UPDATE, auth_users UPDATE)
SELECT 'BLOCK 4: Total restrictive policies (mutation protection)' AS check_name;
SELECT 
  COUNT(*) AS restrictive_policies_count,
  ARRAY_AGG(DISTINCT tablename ORDER BY tablename) AS protected_tables
FROM pg_policies
WHERE permissive = false
  AND schemaname = 'public';

-- BLOCK 5: Verify no policies are accidentally set to allow all (WHERE true in blocking policies)
-- Expected: 0 rows (should never be any)
SELECT 'BLOCK 5: Sanity check - no accidental "allow all" in restrictive policies' AS check_name;
SELECT
  tablename,
  policyname,
  qual AS dangerous_condition
FROM pg_policies
WHERE permissive = false
  AND qual = ''
  AND schemaname = 'public';

-- BLOCK 6: Unified Phase 2 readiness
SELECT 'BLOCK 6: Phase 2 readiness summary' AS check_name;
SELECT
  (SELECT COUNT(*) FROM pg_policies WHERE permissive = false AND schemaname = 'public') AS restrictive_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('membership_transactions', 'audit_logs') AND schemaname = 'public') AS immutable_table_policies,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE permissive = false AND tablename IN ('membership_transactions', 'audit_logs') AND schemaname = 'public') >= 4
      AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'users' AND cmd = 'UPDATE' AND schemaname = 'public') >= 2
    THEN 'READY_FOR_DEPLOY'
    ELSE 'NEEDS_REVIEW'
  END AS phase_2_status;

-- ============================================================================
-- END VALIDATION
-- ============================================================================
