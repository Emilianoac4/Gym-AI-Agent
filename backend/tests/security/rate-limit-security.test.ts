import express from "express";
import request from "supertest";
import { createRateLimiter } from "../../src/middleware/rate-limit.middleware";

jest.mock("../../src/middleware/security-audit.middleware", () => ({
  emitSecurityAuditEvent: jest.fn(),
}));

describe("BE-SEC-04 rate limiting", () => {
  it("returns 429 when the client exceeds configured request limit", async () => {
    const app = express();
    app.use(
      "/limited",
      createRateLimiter({
        scope: "test-security",
        windowMs: 60_000,
        maxRequests: 2,
      }),
    );
    app.get("/limited", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).get("/limited").expect(200);
    await request(app).get("/limited").expect(200);
    const response = await request(app).get("/limited").expect(429);

    expect(response.body.message).toBe("Too many requests");
    expect(response.body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.headers["x-ratelimit-limit"]).toBe("2");
    expect(response.headers["x-security-event"]).toBe("rate_limit_exceeded");
  });
});
