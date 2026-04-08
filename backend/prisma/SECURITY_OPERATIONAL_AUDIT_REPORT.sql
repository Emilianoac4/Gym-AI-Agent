-- ============================================================================
-- TUCO - SECURITY OPERATIONAL AUDIT REPORT
-- ============================================================================
-- Purpose: quick operational view of security posture + recent security events.
-- Returns one row for dashboards / SQL Editor quick checks.
-- ============================================================================

WITH key_tables AS (
  SELECT unnest(ARRAY[
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
  ]) AS table_name
),
rls_state AS (
  SELECT
    COUNT(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled_count,
    COUNT(*) FILTER (WHERE c.relforcerowsecurity) AS force_rls_enabled_count,
    COUNT(*) AS total_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN key_tables t ON t.table_name = c.relname
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
),
anon_grants AS (
  SELECT COUNT(*) AS anon_privilege_count
  FROM information_schema.role_table_grants g
  JOIN key_tables t ON t.table_name = g.table_name
  WHERE g.table_schema = 'public'
    AND g.grantee = 'anon'
),
policy_inventory AS (
  SELECT
    COUNT(*) AS total_policies,
    COUNT(*) FILTER (WHERE permissive = 'RESTRICTIVE') AS restrictive_policies
  FROM pg_policies
  WHERE schemaname = 'public'
),
security_events_24h AS (
  SELECT COUNT(*) AS security_events_last_24h
  FROM audit_logs
  WHERE resource_type = 'security_event'
    AND created_at >= (now() - interval '24 hours')
),
rate_limit_24h AS (
  SELECT COUNT(*) AS rate_limit_events_last_24h
  FROM audit_logs
  WHERE resource_type = 'security_event'
    AND metadata::text ILIKE '%rate_limit_exceeded%'
    AND created_at >= (now() - interval '24 hours')
)
SELECT
  r.total_tables,
  r.rls_enabled_count,
  r.force_rls_enabled_count,
  a.anon_privilege_count,
  p.total_policies,
  p.restrictive_policies,
  s.security_events_last_24h,
  l.rate_limit_events_last_24h,
  CASE
    WHEN r.rls_enabled_count = r.total_tables
     AND r.force_rls_enabled_count = r.total_tables
     AND a.anon_privilege_count = 0
     AND p.restrictive_policies >= 6
    THEN 'PASS'
    ELSE 'REVIEW'
  END AS security_operational_status
FROM rls_state r
CROSS JOIN anon_grants a
CROSS JOIN policy_inventory p
CROSS JOIN security_events_24h s
CROSS JOIN rate_limit_24h l;
