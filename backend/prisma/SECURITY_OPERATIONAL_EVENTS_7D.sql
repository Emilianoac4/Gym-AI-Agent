-- ============================================================================
-- TUCO - SECURITY OPERATIONAL EVENTS (7 DAYS)
-- ============================================================================
-- Purpose: monitor runtime security events in the last 7 days.
-- Usage: run each block independently in Supabase SQL Editor.
-- Source: audit_logs where resource_type = 'security_event'.
-- ============================================================================

-- BLOCK 1: Daily volume by event type and severity
SELECT
  date_trunc('day', created_at) AS day_utc,
  COALESCE(metadata::jsonb ->> 'eventType', 'unknown') AS event_type,
  COALESCE(metadata::jsonb ->> 'severity', 'unknown') AS severity,
  COUNT(*) AS total_events
FROM audit_logs
WHERE resource_type = 'security_event'
  AND created_at >= (now() - interval '7 days')
GROUP BY 1, 2, 3
ORDER BY day_utc DESC, total_events DESC;

-- BLOCK 2: Top routes with security events (7d)
SELECT
  COALESCE(metadata::jsonb ->> 'path', 'unknown') AS path,
  COALESCE(metadata::jsonb ->> 'method', 'unknown') AS method,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE COALESCE(metadata::jsonb ->> 'severity', 'unknown') = 'critical') AS critical_events,
  COUNT(*) FILTER (WHERE COALESCE(metadata::jsonb ->> 'eventType', 'unknown') = 'rate_limit_exceeded') AS rate_limit_events
FROM audit_logs
WHERE resource_type = 'security_event'
  AND created_at >= (now() - interval '7 days')
GROUP BY 1, 2
ORDER BY total_events DESC
LIMIT 25;

-- BLOCK 3: Authentication-related alerts (401/403 patterns)
SELECT
  date_trunc('hour', created_at) AS hour_utc,
  COALESCE(metadata::jsonb ->> 'eventType', 'unknown') AS event_type,
  COUNT(*) AS total_events,
  COUNT(DISTINCT COALESCE(metadata::jsonb ->> 'ipAddress', 'unknown')) AS distinct_ips,
  COUNT(DISTINCT COALESCE(metadata::jsonb ->> 'actorUserId', 'anonymous')) AS distinct_actors
FROM audit_logs
WHERE resource_type = 'security_event'
  AND created_at >= (now() - interval '7 days')
  AND COALESCE(metadata::jsonb ->> 'eventType', 'unknown') IN (
    'unauthorized_request',
    'forbidden_request',
    'rate_limit_exceeded'
  )
GROUP BY 1, 2
ORDER BY hour_utc DESC, total_events DESC;

-- BLOCK 4: Critical errors detail (7d)
SELECT
  created_at,
  COALESCE(metadata::jsonb ->> 'eventType', 'unknown') AS event_type,
  COALESCE(metadata::jsonb ->> 'path', 'unknown') AS path,
  COALESCE(metadata::jsonb ->> 'method', 'unknown') AS method,
  COALESCE(metadata::jsonb ->> 'requestId', id::text) AS request_id,
  COALESCE(metadata::jsonb ->> 'message', 'n/a') AS message
FROM audit_logs
WHERE resource_type = 'security_event'
  AND created_at >= (now() - interval '7 days')
  AND COALESCE(metadata::jsonb ->> 'severity', 'unknown') = 'critical'
ORDER BY created_at DESC
LIMIT 100;

-- BLOCK 5: Single-row executive summary (7d)
WITH events AS (
  SELECT
    COALESCE(metadata::jsonb ->> 'eventType', 'unknown') AS event_type,
    COALESCE(metadata::jsonb ->> 'severity', 'unknown') AS severity
  FROM audit_logs
  WHERE resource_type = 'security_event'
    AND created_at >= (now() - interval '7 days')
)
SELECT
  COUNT(*) AS total_security_events_7d,
  COUNT(*) FILTER (WHERE event_type = 'rate_limit_exceeded') AS rate_limit_events_7d,
  COUNT(*) FILTER (WHERE event_type = 'unauthorized_request') AS unauthorized_events_7d,
  COUNT(*) FILTER (WHERE event_type = 'forbidden_request') AS forbidden_events_7d,
  COUNT(*) FILTER (WHERE event_type = 'unhandled_server_error') AS unhandled_errors_7d,
  COUNT(*) FILTER (WHERE severity = 'critical') AS critical_events_7d,
  CASE
    WHEN COUNT(*) FILTER (WHERE severity = 'critical') = 0 THEN 'STABLE'
    WHEN COUNT(*) FILTER (WHERE severity = 'critical') <= 3 THEN 'ATTENTION'
    ELSE 'INVESTIGATE'
  END AS operational_signal
FROM events;

-- ============================================================================
-- END
-- ============================================================================
