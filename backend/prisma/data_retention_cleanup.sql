-- ============================================================================
-- TUCO - DATA RETENTION / EXPIRATION CLEANUP (BE-SEC-06)
-- ============================================================================
-- Purpose : Apply technical retention for sensitive data categories.
-- Scope   : audit logs, AI prompts/responses, health metadata, old measurements.
-- Usage   : Run block-by-block in Supabase SQL Editor (recommended in staging first).
-- Notes   :
--   - Tune retention windows via interval literals before running in production.
--   - This SQL is the manual fallback. Automatic cleanup is in backend job
--     src/services/data-retention.service.ts.
-- ============================================================================

-- BLOCK 1: Retention windows (edit as needed)
-- audit_logs:            180 days
-- ai_chat_logs:           90 days
-- measurements:          365 days
-- user_health_metadata:  180 days (metadata field cleared, row kept)

-- BLOCK 2: Preview counts (dry-run)
SELECT
  (SELECT COUNT(*) FROM audit_logs WHERE created_at < (now() - interval '180 days')) AS audit_logs_to_delete,
  (SELECT COUNT(*) FROM ai_chat_logs WHERE created_at < (now() - interval '90 days')) AS ai_chat_logs_to_delete,
  (SELECT COUNT(*) FROM measurements WHERE created_at < (now() - interval '365 days')) AS measurements_to_delete,
  (
    SELECT COUNT(*)
    FROM user_health_connections
    WHERE updated_at < (now() - interval '180 days')
      AND metadata IS NOT NULL
  ) AS health_metadata_to_clear;

-- BLOCK 3: Delete audit logs beyond retention
DELETE FROM audit_logs
WHERE created_at < (now() - interval '180 days');

-- BLOCK 4: Delete AI prompts/responses beyond retention
DELETE FROM ai_chat_logs
WHERE created_at < (now() - interval '90 days');

-- BLOCK 5: Clear stale health metadata (preserve relationship row)
UPDATE user_health_connections
SET metadata = NULL
WHERE updated_at < (now() - interval '180 days')
  AND metadata IS NOT NULL;

-- BLOCK 6: Remove very old measurement rows (health-sensitive data)
DELETE FROM measurements
WHERE created_at < (now() - interval '365 days');

-- BLOCK 7: Verification summary
SELECT
  (SELECT COUNT(*) FROM audit_logs WHERE created_at < (now() - interval '180 days')) AS audit_logs_remaining_over_retention,
  (SELECT COUNT(*) FROM ai_chat_logs WHERE created_at < (now() - interval '90 days')) AS ai_chat_logs_remaining_over_retention,
  (SELECT COUNT(*) FROM measurements WHERE created_at < (now() - interval '365 days')) AS measurements_remaining_over_retention,
  (
    SELECT COUNT(*)
    FROM user_health_connections
    WHERE updated_at < (now() - interval '180 days')
      AND metadata IS NOT NULL
  ) AS health_metadata_remaining_over_retention;

-- Expected after successful run: all values = 0
