-- ============================================================================
-- TUCO - SECURITY HARDENING PHASE 2 REPORT
-- ============================================================================
-- Unified single-row report after Phase 2 deployment.
-- Returns: mutation protection status, blocking policies count, phase readiness.
-- ============================================================================

WITH mutation_protection AS (
  SELECT
    COUNT(*) FILTER (WHERE permissive = 'RESTRICTIVE' AND tablename IN ('membership_transactions', 'audit_logs')) AS immutable_blocking_policies,
    COUNT(*) FILTER (WHERE permissive = 'RESTRICTIVE') AS total_restrictive_policies,
    COUNT(*) FILTER (WHERE tablename = 'users' AND cmd = 'UPDATE') AS users_escalation_prevention_count,
    COUNT(*) FILTER (WHERE tablename = 'assistance_requests' AND cmd = 'UPDATE') AS requests_reassignment_prevention_count
  FROM pg_policies
  WHERE schemaname = 'public'
),
immutable_validation AS (
  SELECT
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'membership_transactions' AND cmd IN ('UPDATE', 'DELETE') AND schemaname = 'public') AS membership_tx_blocking_count,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'audit_logs' AND cmd IN ('UPDATE', 'DELETE') AND schemaname = 'public') AS audit_blocking_count
),
escalation_validation AS (
  SELECT
    COUNT(*) AS safe_update_policies_count
  FROM pg_policies
  WHERE tablename = 'users'
    AND cmd = 'UPDATE'
    AND with_check IS NOT NULL
    AND schemaname = 'public'
)
SELECT
  m.immutable_blocking_policies,
  m.total_restrictive_policies,
  m.users_escalation_prevention_count,
  m.requests_reassignment_prevention_count,
  i.membership_tx_blocking_count,
  i.audit_blocking_count,
  e.safe_update_policies_count,
  CASE
    WHEN m.immutable_blocking_policies >= 4
     AND m.users_escalation_prevention_count >= 2
     AND m.requests_reassignment_prevention_count >= 1
     AND i.membership_tx_blocking_count >= 2
     AND i.audit_blocking_count >= 2
    THEN 'PASS'
    ELSE 'REVIEW'
  END AS phase_2_status
FROM mutation_protection m
CROSS JOIN immutable_validation i
CROSS JOIN escalation_validation e;
