/**
 * INF-SEC-04 — Alert Thresholds Service Tests
 *
 * Verifies that the alert service fires exactly when security event counts
 * cross defined thresholds, fires only once per window, and resets on a
 * new window.
 */

import {
  recordSecurityEvent,
  _resetAlertCounters,
} from "../../src/services/alert-thresholds.service";

describe("alert-thresholds.service", () => {
  beforeEach(() => {
    _resetAlertCounters();
  });

  // -------------------------------------------------------------------------
  // 1. No alert below threshold
  // -------------------------------------------------------------------------
  it("does not alert when event count is at or below threshold", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // unauthorized_request threshold = 20; call exactly 20 times
    for (let i = 0; i < 20; i++) {
      recordSecurityEvent("unauthorized_request");
    }

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 2. Warning alert fires at threshold + 1
  // -------------------------------------------------------------------------
  it("fires a warning alert when unauthorized_request count exceeds threshold", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // threshold = 20 → alert fires on 21st call
    for (let i = 0; i <= 20; i++) {
      recordSecurityEvent("unauthorized_request");
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("[ALERT]");
    expect(warnSpy.mock.calls[0][0]).toContain("unauthorized_request");

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 3. Warning alert for forbidden_request
  // -------------------------------------------------------------------------
  it("fires a warning alert when forbidden_request count exceeds threshold", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // threshold = 15 → alert fires on 16th call
    for (let i = 0; i <= 15; i++) {
      recordSecurityEvent("forbidden_request");
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("forbidden_request");

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 4. Critical alert for unhandled_server_error
  // -------------------------------------------------------------------------
  it("fires a critical (console.error) alert for unhandled_server_error spike", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // threshold = 5 → alert fires on 6th call
    for (let i = 0; i <= 5; i++) {
      recordSecurityEvent("unhandled_server_error");
    }

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("[ALERT]");
    expect(errorSpy.mock.calls[0][0]).toContain("unhandled_server_error");

    errorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 5. Alert fires only once per window regardless of subsequent calls
  // -------------------------------------------------------------------------
  it("fires alert only once per time window even with many extra events", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // threshold = 30 for rate_limit_exceeded; send 60 events (2× threshold)
    for (let i = 0; i < 60; i++) {
      recordSecurityEvent("rate_limit_exceeded");
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 6. A new time window resets the counter
  // -------------------------------------------------------------------------
  it("resets the counter when a new time window starts", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const pastTime = Date.now() - 120_000; // 2 min ago — past the 60s window

    // Fill the window in the past (just below threshold)
    for (let i = 0; i < 20; i++) {
      recordSecurityEvent("unauthorized_request", pastTime);
    }

    // One event in a fresh window should NOT trigger an alert
    recordSecurityEvent("unauthorized_request", Date.now());

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 7. Unknown event types are silently ignored
  // -------------------------------------------------------------------------
  it("ignores event types that have no configured threshold", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    for (let i = 0; i < 200; i++) {
      recordSecurityEvent("some_unknown_event_type");
    }

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 8. Alert payload contains expected structured metadata
  // -------------------------------------------------------------------------
  it("includes eventType and count in the alert payload object", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    for (let i = 0; i <= 20; i++) {
      recordSecurityEvent("unauthorized_request");
    }

    const payloadArg = warnSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payloadArg).toMatchObject({ eventType: "unauthorized_request" });
    expect(typeof payloadArg["count"]).toBe("number");
    expect(payloadArg["count"] as number).toBeGreaterThan(20);

    warnSpy.mockRestore();
  });
});
