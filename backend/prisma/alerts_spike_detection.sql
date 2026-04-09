-- ============================================================================
-- TUCO - OPERATIONAL ALERTS: SPIKE DETECTION  (INF-SEC-04)
-- ============================================================================
-- Purpose : Detect abnormal spikes in 401/403/429/500 security events.
--           Run manually in Supabase SQL Editor or schedule via pg_cron.
-- Source  : audit_logs where resource_type = 'security_event'.
-- Thresholds mirror alert-thresholds.service.ts.
-- ============================================================================

-- ============================================================================
-- BLOCK 1: Current-window spike check (last 60 seconds per event type)
-- ============================================================================
-- Returns rows only when a threshold is exceeded RIGHT NOW.
-- Use this block for real-time alerting / pg_cron every minute.

WITH thresholds (event_type, max_count) AS (
  VALUES
    ('unauthorized_request',  20),
    ('forbidden_request',     15),
    ('rate_limit_exceeded',   30),
    ('unhandled_server_error', 5)
),
current_counts AS (
  SELECT
    COALESCE(metadata::jsonb ->> 'eventType', 'unknown') AS event_type,
    COUNT(*) AS event_count
  FROM audit_logs
  WHERE resource_type = 'security_event'
    AND created_at >= (now() - interval '60 seconds')
  GROUP BY 1
)
SELECT
  cc.event_type,
  cc.event_count                         AS current_count,
  t.max_count                            AS threshold,
  cc.event_count - t.max_count           AS excess,
  CASE
    WHEN cc.event_count > t.max_count THEN '*** SPIKE DETECTED ***'
    ELSE 'ok'
  END                                    AS status
FROM current_counts cc
JOIN thresholds t USING (event_type)
WHERE cc.event_count > t.max_count
ORDER BY excess DESC;
-- Expected in normal operation: 0 rows.
-- Any row indicates an active spike that should trigger a response.

-- ============================================================================
-- BLOCK 2: Hourly spike summary — last 24 hours
-- ============================================================================
-- Shows sustained patterns: distributed attacks, recurring issues.

WITH thresholds (event_type, hourly_max) AS (
  VALUES
    ('unauthorized_request',  200),   -- 20 / min * 60 min * 1.67x tolerance
    ('forbidden_request',     150),
    ('rate_limit_exceeded',   300),
    ('unhandled_server_error', 30)
),
hourly_counts AS (
  SELECT
    date_trunc('hour', created_at)                              AS hour_utc,
    COALESCE(metadata::jsonb ->> 'eventType', 'unknown')        AS event_type,
    COUNT(*)                                                    AS event_count,
    COUNT(DISTINCT COALESCE(metadata::jsonb ->> 'ipAddress', 'unknown')) AS distinct_ips
  FROM audit_logs
  WHERE resource_type = 'security_event'
    AND created_at >= (now() - interval '24 hours')
  GROUP BY 1, 2
)
SELECT
  hc.hour_utc,
  hc.event_type,
  hc.event_count,
  hc.distinct_ips,
  t.hourly_max                              AS threshold,
  CASE
    WHEN hc.event_count > t.hourly_max THEN '*** HIGH ***'
    WHEN hc.event_count > t.hourly_max * 0.75 THEN 'ELEVATED'
    ELSE 'normal'
  END                                       AS level
FROM hourly_counts hc
JOIN thresholds t USING (event_type)
ORDER BY hc.hour_utc DESC, hc.event_count DESC;

-- ============================================================================
-- BLOCK 3: Top attacking IPs (last 60 min, >= 10 events)
-- ============================================================================

SELECT
  COALESCE(metadata::jsonb ->> 'ipAddress', 'unknown')       AS ip_address,
  COUNT(*)                                                    AS total_events,
  COUNT(DISTINCT COALESCE(metadata::jsonb ->> 'eventType', 'unknown')) AS distinct_event_types,
  array_agg(DISTINCT COALESCE(metadata::jsonb ->> 'eventType', 'unknown'))
    AS event_types
FROM audit_logs
WHERE resource_type = 'security_event'
  AND created_at >= (now() - interval '60 minutes')
GROUP BY 1
HAVING COUNT(*) >= 10
ORDER BY total_events DESC
LIMIT 20;
-- Expected in normal operation: 0 rows.
-- Rows indicate IPs to consider blocking at the network/Cloudflare level.

-- ============================================================================
-- BLOCK 4: 5xx error rate (unhandled_server_error) — last 30 minutes
-- ============================================================================
-- Useful post-deploy to catch regressions early.

SELECT
  date_trunc('minute', created_at) AS minute_utc,
  COUNT(*)                          AS error_500_count,
  CASE
    WHEN COUNT(*) >= 5 THEN '*** CRITICAL ***'
    WHEN COUNT(*) >= 2 THEN 'ELEVATED'
    ELSE 'normal'
  END                               AS level
FROM audit_logs
WHERE resource_type = 'security_event'
  AND COALESCE(metadata::jsonb ->> 'eventType', 'unknown') = 'unhandled_server_error'
  AND created_at >= (now() - interval '30 minutes')
GROUP BY 1
ORDER BY 1 DESC;

-- ============================================================================
-- BLOCK 5: pg_cron snippet (Supabase Pro / pg_cron extension)
-- ============================================================================
-- Uncomment and run ONCE in Supabase SQL Editor to schedule automatic checks.
-- Requires pg_cron enabled in Project Settings → Extensions.

/*
SELECT cron.schedule(
  'spike-alert-60s',          -- job name (unique)
  '* * * * *',                -- every minute
  $$
    INSERT INTO audit_logs (
      action, resource_type, resource_id, metadata, created_at
    )
    SELECT
      'platform_action',
      'security_alert',
      gen_random_uuid()::text,
      jsonb_build_object(
        'eventType', cc.event_type,
        'count',     cc.event_count,
        'threshold', t.max_count,
        'severity',  'critical',
        'message',   'Spike detected by pg_cron: ' || cc.event_type
      )::text,
      now()
    FROM (
      SELECT
        COALESCE(metadata::jsonb ->> 'eventType', 'unknown') AS event_type,
        COUNT(*) AS event_count
      FROM audit_logs
      WHERE resource_type = 'security_event'
        AND created_at >= (now() - interval '60 seconds')
      GROUP BY 1
    ) cc
    JOIN (
      VALUES
        ('unauthorized_request',  20),
        ('forbidden_request',     15),
        ('rate_limit_exceeded',   30),
        ('unhandled_server_error', 5)
    ) AS t(event_type, max_count) USING (event_type)
    WHERE cc.event_count > t.max_count;
  $$
);
*/
