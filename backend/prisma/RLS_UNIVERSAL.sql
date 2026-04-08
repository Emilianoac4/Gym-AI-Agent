-- ============================================================================
-- TUCO - RLS UNIVERSAL (TYPE-AGNOSTIC)
-- ============================================================================
-- Goal: Avoid uuid/text mismatches regardless of current DB column types.
-- Strategy:
-- 1) Drop existing policies for target tables.
-- 2) Recreate helper functions with text-safe comparisons.
-- 3) In policies, cast BOTH sides to text where IDs are compared.
-- ============================================================================

-- ============================================================================
-- STEP 0: DROP EXISTING POLICIES (safe reruns)
-- ============================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
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
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 1: ENABLE RLS
-- ============================================================================
ALTER TABLE global_user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_health_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_grants ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: HELPER FUNCTIONS (TEXT-SAFE)
-- ============================================================================
DROP FUNCTION IF EXISTS is_gym_admin(text);
DROP FUNCTION IF EXISTS is_gym_admin(uuid);
DROP FUNCTION IF EXISTS is_gym_trainer(text);
DROP FUNCTION IF EXISTS is_gym_trainer(uuid);
DROP FUNCTION IF EXISTS is_platform_admin();

CREATE FUNCTION is_gym_admin(p_gym_id text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE gym_id::text = p_gym_id::text
      AND global_user_id::text = auth.uid()::text
      AND role::text = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE;

CREATE FUNCTION is_gym_admin(p_gym_id uuid)
RETURNS boolean AS $$
  SELECT is_gym_admin(p_gym_id::text);
$$ LANGUAGE sql STABLE;

CREATE FUNCTION is_gym_trainer(p_gym_id text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE gym_id::text = p_gym_id::text
      AND global_user_id::text = auth.uid()::text
      AND role::text = 'trainer'
      AND is_active = true
      AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE;

CREATE FUNCTION is_gym_trainer(p_gym_id uuid)
RETURNS boolean AS $$
  SELECT is_gym_trainer(p_gym_id::text);
$$ LANGUAGE sql STABLE;

CREATE FUNCTION is_platform_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_admin_users
    WHERE id::text = auth.uid()::text
      AND is_active = true
  );
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- STEP 3: global_user_accounts
-- ============================================================================
CREATE POLICY global_user_accounts_user_sees_own
  ON global_user_accounts FOR SELECT
  USING (id::text = auth.uid()::text);

CREATE POLICY global_user_accounts_admin_sees_all
  ON global_user_accounts FOR SELECT
  USING (is_platform_admin());

CREATE POLICY global_user_accounts_user_updates_own
  ON global_user_accounts FOR UPDATE
  USING (id::text = auth.uid()::text);

CREATE POLICY global_user_accounts_admin_updates_all
  ON global_user_accounts FOR UPDATE
  USING (is_platform_admin());

-- ============================================================================
-- STEP 4: users
-- ============================================================================
CREATE POLICY users_user_sees_own
  ON users FOR SELECT
  USING (global_user_id::text = auth.uid()::text);

CREATE POLICY users_admin_sees_gym_users
  ON users FOR SELECT
  USING (is_gym_admin(gym_id::text));

CREATE POLICY users_trainer_sees_gym_members
  ON users FOR SELECT
  USING (is_gym_trainer(gym_id::text));

CREATE POLICY users_admin_creates_users
  ON users FOR INSERT
  WITH CHECK (is_gym_admin(gym_id::text));

CREATE POLICY users_user_updates_own
  ON users FOR UPDATE
  USING (global_user_id::text = auth.uid()::text);

CREATE POLICY users_admin_updates_gym_users
  ON users FOR UPDATE
  USING (is_gym_admin(gym_id::text));

CREATE POLICY users_admin_deletes_gym_users
  ON users FOR DELETE
  USING (is_gym_admin(gym_id::text));

-- ============================================================================
-- STEP 5: user_profiles
-- ============================================================================
CREATE POLICY user_profiles_user_sees_own
  ON user_profiles FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY user_profiles_admin_sees_member_profiles
  ON user_profiles FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

CREATE POLICY user_profiles_user_updates_own
  ON user_profiles FOR UPDATE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY user_profiles_user_creates_own
  ON user_profiles FOR INSERT
  WITH CHECK (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY user_profiles_admin_updates_profiles
  ON user_profiles FOR UPDATE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

-- ============================================================================
-- STEP 6: measurements
-- ============================================================================
CREATE POLICY measurements_user_sees_own
  ON measurements FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY measurements_admin_sees_all
  ON measurements FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

CREATE POLICY measurements_trainer_sees_members
  ON measurements FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_trainer(gym_id::text)
    )
  );

CREATE POLICY measurements_user_creates_own
  ON measurements FOR INSERT
  WITH CHECK (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY measurements_user_updates_own
  ON measurements FOR UPDATE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY measurements_trainer_updates_members
  ON measurements FOR UPDATE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_trainer(gym_id::text)
    )
  );

CREATE POLICY measurements_admin_deletes
  ON measurements FOR DELETE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

-- ============================================================================
-- STEP 7: user_health_connections
-- ============================================================================
CREATE POLICY user_health_connections_user_sees_own
  ON user_health_connections FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY user_health_connections_user_creates_own
  ON user_health_connections FOR INSERT
  WITH CHECK (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY user_health_connections_user_updates_own
  ON user_health_connections FOR UPDATE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY user_health_connections_user_deletes_own
  ON user_health_connections FOR DELETE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

-- ============================================================================
-- STEP 8: ai_chat_logs
-- ============================================================================
CREATE POLICY ai_chat_logs_user_sees_own
  ON ai_chat_logs FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY ai_chat_logs_user_creates
  ON ai_chat_logs FOR INSERT
  WITH CHECK (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY ai_chat_logs_admin_sees_gym_members
  ON ai_chat_logs FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

CREATE POLICY ai_chat_logs_admin_deletes
  ON ai_chat_logs FOR DELETE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

-- ============================================================================
-- STEP 9: push_tokens
-- ============================================================================
CREATE POLICY push_tokens_user_sees_own
  ON push_tokens FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY push_tokens_user_creates
  ON push_tokens FOR INSERT
  WITH CHECK (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY push_tokens_user_deletes_own
  ON push_tokens FOR DELETE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

-- ============================================================================
-- STEP 10: membership_transactions
-- ============================================================================
CREATE POLICY membership_transactions_admin_sees_gym
  ON membership_transactions FOR SELECT
  USING (is_gym_admin(gym_id::text));

CREATE POLICY membership_transactions_user_sees_own
  ON membership_transactions FOR SELECT
  USING (
    actor_user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY membership_transactions_admin_creates
  ON membership_transactions FOR INSERT
  WITH CHECK (is_gym_admin(gym_id::text));

-- ============================================================================
-- STEP 11: emergency_tickets
-- ============================================================================
CREATE POLICY emergency_tickets_user_creates
  ON emergency_tickets FOR INSERT
  WITH CHECK (
    reporter_user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY emergency_tickets_user_sees_own
  ON emergency_tickets FOR SELECT
  USING (
    reporter_user_id::text IN (SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text)
    OR resolved_by_user_id::text IN (SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text)
  );

CREATE POLICY emergency_tickets_admin_sees_all
  ON emergency_tickets FOR SELECT
  USING (is_gym_admin(gym_id::text));

CREATE POLICY emergency_tickets_admin_updates
  ON emergency_tickets FOR UPDATE
  USING (is_gym_admin(gym_id::text));

-- ============================================================================
-- STEP 12: assistance_requests
-- ============================================================================
CREATE POLICY assistance_requests_member_creates
  ON assistance_requests FOR INSERT
  WITH CHECK (
    member_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY assistance_requests_member_sees_own
  ON assistance_requests FOR SELECT
  USING (
    member_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY assistance_requests_trainer_sees_assigned
  ON assistance_requests FOR SELECT
  USING (
    trainer_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY assistance_requests_trainer_updates_assigned
  ON assistance_requests FOR UPDATE
  USING (
    trainer_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
    OR gym_id::text IN (
      SELECT DISTINCT gym_id::text FROM users WHERE global_user_id::text = auth.uid()::text AND role::text = 'admin'
    )
  );

CREATE POLICY assistance_requests_admin_sees_all
  ON assistance_requests FOR SELECT
  USING (is_gym_admin(gym_id::text));

CREATE POLICY assistance_requests_admin_updates
  ON assistance_requests FOR UPDATE
  USING (is_gym_admin(gym_id::text));

-- ============================================================================
-- STEP 13: routine_session_logs
-- ============================================================================
CREATE POLICY routine_session_logs_user_sees_own
  ON routine_session_logs FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY routine_session_logs_user_creates
  ON routine_session_logs FOR INSERT
  WITH CHECK (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY routine_session_logs_admin_sees_all
  ON routine_session_logs FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

-- ============================================================================
-- STEP 14: routine_exercise_logs
-- ============================================================================
CREATE POLICY routine_exercise_logs_user_sees_own
  ON routine_exercise_logs FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY routine_exercise_logs_user_creates
  ON routine_exercise_logs FOR INSERT
  WITH CHECK (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY routine_exercise_logs_trainer_sees_members
  ON routine_exercise_logs FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_trainer(gym_id::text)
    )
  );

CREATE POLICY routine_exercise_logs_trainer_updates
  ON routine_exercise_logs FOR UPDATE
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_trainer(gym_id::text)
    )
  );

CREATE POLICY routine_exercise_logs_admin_sees_all
  ON routine_exercise_logs FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

-- ============================================================================
-- STEP 15: audit_logs
-- ============================================================================
CREATE POLICY audit_logs_platform_admin_sees_all
  ON audit_logs FOR SELECT
  USING (is_platform_admin());

CREATE POLICY audit_logs_gym_admin_sees_own_gym
  ON audit_logs FOR SELECT
  USING (
    gym_id::text IN (
      SELECT DISTINCT gym_id::text
      FROM users
      WHERE global_user_id::text = auth.uid()::text
        AND role::text = 'admin'
    )
  );

-- ============================================================================
-- STEP 16: user_permission_grants
-- ============================================================================
CREATE POLICY user_permission_grants_admin_sees_gym
  ON user_permission_grants FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
  );

CREATE POLICY user_permission_grants_user_sees_own
  ON user_permission_grants FOR SELECT
  USING (
    user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

CREATE POLICY user_permission_grants_admin_creates
  ON user_permission_grants FOR INSERT
  WITH CHECK (
    user_id::text IN (
      SELECT id::text FROM users WHERE is_gym_admin(gym_id::text)
    )
    AND granted_by_user_id::text IN (
      SELECT id::text FROM users WHERE global_user_id::text = auth.uid()::text
    )
  );

-- ============================================================================
-- END
-- ============================================================================
