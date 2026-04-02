-- Adds fields for verification resend cooldown and user memberships.
-- Run once in each environment.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verification_last_sent_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS membership_start_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS membership_end_at TIMESTAMP(3);

-- Optional safety: if a member has no membership_end_at yet, default to 1 month from creation.
UPDATE public.users
SET membership_start_at = COALESCE(membership_start_at, created_at),
    membership_end_at = COALESCE(membership_end_at, created_at + INTERVAL '1 month')
WHERE role = 'member'::"UserRole"
  AND membership_end_at IS NULL;
