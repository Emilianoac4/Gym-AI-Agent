-- ============================================================================
-- TUCO - SECURITY HARDENING PHASE 1 (SAFE / IDEMPOTENT)
-- ============================================================================
-- Scope:
-- 1) Force RLS on critical tables.
-- 2) Revoke anon direct table privileges on sensitive tables.
--
-- Notes:
-- - This script is designed to be rerunnable.
-- - It does not revoke authenticated role privileges (to avoid breaking app flow).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A) FORCE RLS ON CRITICAL TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS global_user_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS measurements FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_health_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_chat_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emergency_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assistance_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS membership_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS routine_session_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS routine_exercise_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_permission_grants FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- B) REVOKE DIRECT ACCESS FROM anon ON SENSITIVE TABLES
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE global_user_accounts FROM anon;
REVOKE ALL ON TABLE users FROM anon;
REVOKE ALL ON TABLE user_profiles FROM anon;
REVOKE ALL ON TABLE measurements FROM anon;
REVOKE ALL ON TABLE user_health_connections FROM anon;
REVOKE ALL ON TABLE ai_chat_logs FROM anon;
REVOKE ALL ON TABLE push_tokens FROM anon;
REVOKE ALL ON TABLE emergency_tickets FROM anon;
REVOKE ALL ON TABLE assistance_requests FROM anon;
REVOKE ALL ON TABLE membership_transactions FROM anon;
REVOKE ALL ON TABLE routine_session_logs FROM anon;
REVOKE ALL ON TABLE routine_exercise_logs FROM anon;
REVOKE ALL ON TABLE audit_logs FROM anon;
REVOKE ALL ON TABLE user_permission_grants FROM anon;

-- ============================================================================
-- END PHASE 1
-- ============================================================================
