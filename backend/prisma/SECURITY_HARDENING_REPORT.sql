-- ============================================================================
-- TUCO - SECURITY HARDENING SINGLE REPORT
-- ============================================================================
-- One-shot report to avoid partial outputs in SQL Editor.
-- Returns one row with key indicators.
-- ============================================================================

WITH target_tables AS (
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
  JOIN target_tables t ON t.table_name = c.relname
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
),
anon_grants AS (
  SELECT COUNT(*) AS anon_privilege_count
  FROM information_schema.role_table_grants g
  JOIN target_tables t ON t.table_name = g.table_name
  WHERE g.table_schema = 'public'
    AND g.grantee = 'anon'
),
policy_inventory AS (
  SELECT COUNT(*) AS total_policies
  FROM pg_policies p
  JOIN target_tables t ON t.table_name = p.tablename
  WHERE p.schemaname = 'public'
),
orphan_spotcheck AS (
  SELECT COUNT(*) AS orphan_count
  FROM measurements m
  LEFT JOIN users u ON u.id::text = m.user_id::text
  WHERE u.id IS NULL
),
active_softdelete_conflict AS (
  SELECT COUNT(*) AS active_with_deleted_at
  FROM users
  WHERE is_active = true
    AND deleted_at IS NOT NULL
)
SELECT
  r.total_tables,
  r.rls_enabled_count,
  r.force_rls_enabled_count,
  a.anon_privilege_count,
  p.total_policies,
  o.orphan_count,
  s.active_with_deleted_at,
  CASE
    WHEN r.rls_enabled_count = r.total_tables
     AND r.force_rls_enabled_count = r.total_tables
     AND a.anon_privilege_count = 0
     AND o.orphan_count = 0
     AND s.active_with_deleted_at = 0
    THEN 'PASS'
    ELSE 'REVIEW'
  END AS security_status
FROM rls_state r
CROSS JOIN anon_grants a
CROSS JOIN policy_inventory p
CROSS JOIN orphan_spotcheck o
CROSS JOIN active_softdelete_conflict s;
