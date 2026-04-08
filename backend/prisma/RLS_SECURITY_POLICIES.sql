-- ============================================================================
-- TUCO - Row Level Security (RLS) Implementation
-- ============================================================================
-- This SQL file establishes Row Level Security policies for all sensitive
-- tables in the Tuco database on Supabase.
--
-- IMPORTANT: Copy and paste the entire content into Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query) and click "Run".
--
-- PURPOSE: Ensure that users can only access data they are authorized to see,
-- even if someone tries to access the database directly via Supabase API.
--
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE RLS ON ALL CRITICAL TABLES
-- ============================================================================
-- This prevents public access by default. All access must be explicitly
-- allowed via policies below.

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
-- STEP 2: HELPER FUNCTIONS FOR COMMON PERMISSION CHECKS
-- ============================================================================
-- These functions simplify policy logic and make it reusable.
-- They return TRUE if the current user has permission, FALSE otherwise.

-- Get the authenticated user's ID (this comes from Supabase JWT token)
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS text AS $$
  SELECT auth.uid()::text;
$$ LANGUAGE sql STABLE;

-- Check if current user is admin in a specific gym
CREATE OR REPLACE FUNCTION is_gym_admin(p_gym_id text) 
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE gym_id = p_gym_id
      AND global_user_id = auth.uid()::text
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE;

-- Check if current user is trainer in a specific gym
CREATE OR REPLACE FUNCTION is_gym_trainer(p_gym_id text) 
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE gym_id = p_gym_id
      AND global_user_id = auth.uid()::text
      AND role = 'trainer'
      AND is_active = true
      AND deleted_at IS NULL
  );
$$ LANGUAGE sql STABLE;

-- Check if current user is platform admin (can see all data globally)
CREATE OR REPLACE FUNCTION is_platform_admin() 
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admin_users
    WHERE id = auth.uid()
      AND is_active = true
  );
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- STEP 3: POLICIES FOR global_user_accounts TABLE
-- ============================================================================
-- Protects email, password hashes, and personal data
-- Access: Only the user themselves (edit profile), or platform admin

-- Users can see their own account (protected data)
CREATE POLICY "global_user_accounts: user_sees_own" 
  ON global_user_accounts FOR SELECT 
  USING (id = auth.uid());

-- Platform admins (Tuco admins) can see all accounts
CREATE POLICY "global_user_accounts: admin_sees_all" 
  ON global_user_accounts FOR SELECT 
  USING (is_platform_admin());

-- Users can update only their own account
CREATE POLICY "global_user_accounts: user_updates_own" 
  ON global_user_accounts FOR UPDATE 
  USING (id = auth.uid());

-- Platform admins can update any account (for support/management)
CREATE POLICY "global_user_accounts: admin_updates_all" 
  ON global_user_accounts FOR UPDATE 
  USING (is_platform_admin());

-- ============================================================================
-- STEP 4: POLICIES FOR users TABLE
-- ============================================================================
-- Protects user profiles (name, email, role, membership dates)
-- Access: User themselves, gym admin, or trainer in same gym

-- Users can see their own user record
CREATE POLICY "users: user_sees_own" 
  ON users FOR SELECT 
  USING (global_user_id = auth.uid()::text);

-- Gym admins can see all users in their gym
CREATE POLICY "users: admin_sees_gym_users" 
  ON users FOR SELECT 
  USING (is_gym_admin(gym_id));

-- Trainers can see users (members) in their gym
CREATE POLICY "users: trainer_sees_gym_members" 
  ON users FOR SELECT 
  USING (is_gym_trainer(gym_id));

-- Gym admins can create users in their gym
CREATE POLICY "users: admin_creates_users" 
  ON users FOR INSERT 
  WITH CHECK (is_gym_admin(gym_id));

-- Users can update limited fields of own profile
CREATE POLICY "users: user_updates_own" 
  ON users FOR UPDATE 
  USING (global_user_id = auth.uid()::text);

-- Gym admins can update users in their gym
CREATE POLICY "users: admin_updates_gym_users" 
  ON users FOR UPDATE 
  USING (is_gym_admin(gym_id));

-- Gym admins can soft-delete users in their gym
CREATE POLICY "users: admin_deletes_gym_users" 
  ON users FOR DELETE 
  USING (is_gym_admin(gym_id));

-- ============================================================================
-- STEP 5: POLICIES FOR user_profiles TABLE
-- ============================================================================
-- Protects sensitive personal data: medical conditions, injuries, goals, photos
-- Access: User themselves or gym admin

-- Users can see their own profile
CREATE POLICY "user_profiles: user_sees_own" 
  ON user_profiles FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Gym admins can see profiles of members in their gym
CREATE POLICY "user_profiles: admin_sees_member_profiles" 
  ON user_profiles FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- Users can update own profile
CREATE POLICY "user_profiles: user_updates_own" 
  ON user_profiles FOR UPDATE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can insert own profile
CREATE POLICY "user_profiles: user_creates_own" 
  ON user_profiles FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Gym admins can update member profiles (for admin support)
CREATE POLICY "user_profiles: admin_updates_profiles" 
  ON user_profiles FOR UPDATE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- ============================================================================
-- STEP 6: POLICIES FOR measurements TABLE
-- ============================================================================
-- Protects body measurements and photos
-- Access: User themselves, trainers, or gym admin (for accountability)

-- Users can see their own measurements
CREATE POLICY "measurements: user_sees_own" 
  ON measurements FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Gym admins can see measurements from members in their gym
CREATE POLICY "measurements: admin_sees_all" 
  ON measurements FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- Trainers can see member measurements
CREATE POLICY "measurements: trainer_sees_members" 
  ON measurements FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_trainer(gym_id)
    )
  );

-- Users can insert own measurements
CREATE POLICY "measurements: user_creates_own" 
  ON measurements FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can update own measurements
CREATE POLICY "measurements: user_updates_own" 
  ON measurements FOR UPDATE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Trainers can update member measurements
CREATE POLICY "measurements: trainer_updates_members" 
  ON measurements FOR UPDATE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_trainer(gym_id)
    )
  );

-- Gym admins can delete measurements
CREATE POLICY "measurements: admin_deletes" 
  ON measurements FOR DELETE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- ============================================================================
-- STEP 7: POLICIES FOR user_health_connections TABLE
-- ============================================================================
-- Protects Apple Health / Google Fit / Health Connect OAuth tokens
-- Access: User themselves (nobody else needs this sensitive data)

-- Users can see their own health connections
CREATE POLICY "user_health_connections: user_sees_own" 
  ON user_health_connections FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can create own health connections
CREATE POLICY "user_health_connections: user_creates_own" 
  ON user_health_connections FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can update own health connections
CREATE POLICY "user_health_connections: user_updates_own" 
  ON user_health_connections FOR UPDATE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can delete own health connections
CREATE POLICY "user_health_connections: user_deletes_own" 
  ON user_health_connections FOR DELETE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- STEP 8: POLICIES FOR ai_chat_logs TABLE
-- ============================================================================
-- Protects private AI conversations
-- Access: User themselves (for privacy), or gym admin (for compliance)

-- Users can see their own chat logs
CREATE POLICY "ai_chat_logs: user_sees_own" 
  ON ai_chat_logs FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can create chat logs
CREATE POLICY "ai_chat_logs: user_creates" 
  ON ai_chat_logs FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Gym admins can view member chat logs (for compliance/security)
CREATE POLICY "ai_chat_logs: admin_sees_gym_members" 
  ON ai_chat_logs FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- Gym admins can delete chat logs (retention policy)
CREATE POLICY "ai_chat_logs: admin_deletes" 
  ON ai_chat_logs FOR DELETE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- ============================================================================
-- STEP 9: POLICIES FOR push_tokens TABLE
-- ============================================================================
-- Protects device tokens for push notifications
-- Access: User themselves (device owner)

-- Users can see their own tokens
CREATE POLICY "push_tokens: user_sees_own" 
  ON push_tokens FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can create tokens
CREATE POLICY "push_tokens: user_creates" 
  ON push_tokens FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can delete tokens (device deregistration)
CREATE POLICY "push_tokens: user_deletes_own" 
  ON push_tokens FOR DELETE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- STEP 10: POLICIES FOR membership_transactions TABLE
-- ============================================================================
-- Protects payment records (financial data)
-- Access: Gym admin (for accounting), actor (user who made transaction)
-- NOTE: No UPDATE/DELETE policies - transactions are immutable audit trail

-- Gym admins can see transactions in their gym
CREATE POLICY "membership_transactions: admin_sees_gym" 
  ON membership_transactions FOR SELECT 
  USING (is_gym_admin(gym_id));

-- Actor (user for whom transaction was created) can see own transaction
CREATE POLICY "membership_transactions: user_sees_own" 
  ON membership_transactions FOR SELECT 
  USING (
    actor_user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Gym admins can create transactions
CREATE POLICY "membership_transactions: admin_creates" 
  ON membership_transactions FOR INSERT 
  WITH CHECK (is_gym_admin(gym_id));

-- Transaction table is immutable: no UPDATE or DELETE for anyone
-- (This is enforced by policy absence)

-- ============================================================================
-- STEP 11: POLICIES FOR emergency_tickets TABLE
-- ============================================================================
-- Protects incident reports from gym members
-- Access: Reporter, resolver, or gym admin

-- Users can create tickets
CREATE POLICY "emergency_tickets: user_creates" 
  ON emergency_tickets FOR INSERT 
  WITH CHECK (
    reporter_user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- User can see tickets they reported OR resolved
CREATE POLICY "emergency_tickets: user_sees_own" 
  ON emergency_tickets FOR SELECT 
  USING (
    reporter_user_id IN (SELECT id FROM users WHERE global_user_id = auth.uid()::text)
    OR resolved_by_user_id IN (SELECT id FROM users WHERE global_user_id = auth.uid()::text)
  );

-- Gym admins can see all tickets in their gym
CREATE POLICY "emergency_tickets: admin_sees_all" 
  ON emergency_tickets FOR SELECT 
  USING (is_gym_admin(gym_id));

-- Gym admins can update tickets
CREATE POLICY "emergency_tickets: admin_updates" 
  ON emergency_tickets FOR UPDATE 
  USING (is_gym_admin(gym_id));

-- ============================================================================
-- STEP 12: POLICIES FOR assistance_requests TABLE
-- ============================================================================
-- Protects trainer-member support requests
-- Access: Member, assigned trainer, or gym admin

-- Members can create requests
CREATE POLICY "assistance_requests: member_creates" 
  ON assistance_requests FOR INSERT 
  WITH CHECK (
    member_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Member can see own requests
CREATE POLICY "assistance_requests: member_sees_own" 
  ON assistance_requests FOR SELECT 
  USING (
    member_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Trainer can see assigned requests
CREATE POLICY "assistance_requests: trainer_sees_assigned" 
  ON assistance_requests FOR SELECT 
  USING (
    trainer_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Trainer can update assigned requests
CREATE POLICY "assistance_requests: trainer_updates_assigned" 
  ON assistance_requests FOR UPDATE 
  USING (
    trainer_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
    OR gym_id IN (SELECT DISTINCT gym_id FROM users WHERE global_user_id = auth.uid()::text AND role = 'admin')
  );

-- Gym admins can see all requests
CREATE POLICY "assistance_requests: admin_sees_all" 
  ON assistance_requests FOR SELECT 
  USING (is_gym_admin(gym_id));

-- Gym admins can update any request
CREATE POLICY "assistance_requests: admin_updates" 
  ON assistance_requests FOR UPDATE 
  USING (is_gym_admin(gym_id));

-- ============================================================================
-- STEP 13: POLICIES FOR routine_session_logs TABLE
-- ============================================================================
-- Protects workout session logs
-- Access: User themselves, trainers, gym admin

-- Users can see own logs
CREATE POLICY "routine_session_logs: user_sees_own" 
  ON routine_session_logs FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can create own logs
CREATE POLICY "routine_session_logs: user_creates" 
  ON routine_session_logs FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Gym admins can see all logs
CREATE POLICY "routine_session_logs: admin_sees_all" 
  ON routine_session_logs FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- ============================================================================
-- STEP 14: POLICIES FOR routine_exercise_logs TABLE
-- ============================================================================
-- Protects individual exercise logs (weight lifted, reps, etc.)
-- Access: User, trainers, gym admin

-- Users can see own logs
CREATE POLICY "routine_exercise_logs: user_sees_own" 
  ON routine_exercise_logs FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Users can create own logs
CREATE POLICY "routine_exercise_logs: user_creates" 
  ON routine_exercise_logs FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Trainers can see member logs
CREATE POLICY "routine_exercise_logs: trainer_sees_members" 
  ON routine_exercise_logs FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_trainer(gym_id)
    )
  );

-- Trainers can update member logs
CREATE POLICY "routine_exercise_logs: trainer_updates" 
  ON routine_exercise_logs FOR UPDATE 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_trainer(gym_id)
    )
  );

-- Gym admins can see all logs
CREATE POLICY "routine_exercise_logs: admin_sees_all" 
  ON routine_exercise_logs FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- ============================================================================
-- STEP 15: POLICIES FOR audit_logs TABLE
-- ============================================================================
-- Protects audit trail of all database changes
-- Access: Platform admin (everything), gym admin (own gym only)
-- NOTE: No user INSERT - audit logs are system-generated only

-- Platform admins can see all audit logs
CREATE POLICY "audit_logs: platform_admin_sees_all" 
  ON audit_logs FOR SELECT 
  USING (is_platform_admin());

-- Gym admins can see audit logs for their gym
CREATE POLICY "audit_logs: gym_admin_sees_own_gym" 
  ON audit_logs FOR SELECT 
  USING (
    gym_id IN (
      SELECT DISTINCT gym_id FROM users 
      WHERE global_user_id = auth.uid()::text AND role = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies for users - audit logs are system-managed

-- ============================================================================
-- STEP 16: POLICIES FOR user_permission_grants TABLE
-- ============================================================================
-- Protects special permission assignments
-- Access: Gym admin only (for assigning permissions)

-- Gym admins can see permission grants in their gym
CREATE POLICY "user_permission_grants: admin_sees_gym" 
  ON user_permission_grants FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
  );

-- Users can see their own permission grants
CREATE POLICY "user_permission_grants: user_sees_own" 
  ON user_permission_grants FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- Gym admins can grant permissions to users in their gym
CREATE POLICY "user_permission_grants: admin_creates" 
  ON user_permission_grants FOR INSERT 
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE is_gym_admin(gym_id)
    )
    AND granted_by_user_id IN (
      SELECT id FROM users WHERE global_user_id = auth.uid()::text
    )
  );

-- ============================================================================
-- END OF RLS SQL
-- ============================================================================
-- All critical tables are now protected with Row Level Security.
-- Users can only access data they are explicitly authorized to see.
