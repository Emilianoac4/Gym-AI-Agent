/**
 * INF-SEC-04 — Alert Thresholds Service
 *
 * Detects spikes in security events within a sliding time window and fires
 * console alerts (+ optional webhook) when counts exceed defined thresholds.
 *
 * Called by security-audit.middleware.ts after every security event.
 * Uses an in-memory sliding window — same pattern as rate-limit.middleware.ts.
 */

type AlertLevel = "critical" | "warning";

type AlertThreshold = {
  eventType: string;
  windowMs: number;
  maxCount: number;
  level: AlertLevel;
};

type WindowBucket = {
  count: number;
  windowStart: number;
  alerted: boolean;
};

// ---------------------------------------------------------------------------
// Thresholds — tune per environment via env vars if needed in the future
// ---------------------------------------------------------------------------
const THRESHOLDS: AlertThreshold[] = [
  // 20 unauthorized (401) events in 60s → likely brute-force / token farming
  { eventType: "unauthorized_request", windowMs: 60_000, maxCount: 20, level: "warning" },
  // 15 forbidden (403) events in 60s → likely privilege escalation attempts
  { eventType: "forbidden_request", windowMs: 60_000, maxCount: 15, level: "warning" },
  // 30 rate-limit hits in 60s → DDoS or aggressive scraping
  { eventType: "rate_limit_exceeded", windowMs: 60_000, maxCount: 30, level: "warning" },
  // 5 unhandled 500s in 60s → critical regression or stability issue
  { eventType: "unhandled_server_error", windowMs: 60_000, maxCount: 5, level: "critical" },
];

const thresholdMap = new Map<string, AlertThreshold>(
  THRESHOLDS.map((t) => [t.eventType, t]),
);

const counters = new Map<string, WindowBucket>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record one occurrence of a security event.
 * Fires an alert if the count crosses maxCount within the configured window.
 *
 * @param eventType  The eventType string from SecurityEventInput.
 * @param now        Current timestamp in ms. Overridable for testing.
 */
export function recordSecurityEvent(eventType: string, now = Date.now()): void {
  const threshold = thresholdMap.get(eventType);
  if (!threshold) return;

  const current = counters.get(eventType);

  if (!current || now - current.windowStart >= threshold.windowMs) {
    // Start a fresh window
    counters.set(eventType, { count: 1, windowStart: now, alerted: false });
    return;
  }

  current.count += 1;

  // Fire the alert exactly once per window when threshold is crossed
  if (!current.alerted && current.count > threshold.maxCount) {
    current.alerted = true;
    fireAlert(threshold, current.count);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function fireAlert(threshold: AlertThreshold, count: number): void {
  const message =
    `[ALERT] ${threshold.level.toUpperCase()} spike: event=${threshold.eventType}` +
    ` count=${count} window=${threshold.windowMs / 1000}s threshold=${threshold.maxCount}`;

  const payload = {
    eventType: threshold.eventType,
    count,
    windowMs: threshold.windowMs,
    threshold: threshold.maxCount,
  };

  if (threshold.level === "critical") {
    console.error(message, payload);
  } else {
    console.warn(message, payload);
  }

  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    void postWebhook(webhookUrl, { ...payload, level: threshold.level });
  }
}

async function postWebhook(
  url: string,
  payload: { eventType: string; count: number; level: AlertLevel; windowMs: number; threshold: number },
): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[Tuco Alert] ${payload.level.toUpperCase()} — ${payload.eventType} spike (${payload.count} events/${payload.windowMs / 1000}s)`,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
  } catch (err) {
    console.error("[ALERT] Webhook delivery failed", { url, err });
  }
}

// ---------------------------------------------------------------------------
// Test utilities (only for use in test suites)
// ---------------------------------------------------------------------------

/** @internal Reset internal counters. Only call from test code. */
export function _resetAlertCounters(): void {
  counters.clear();
}
