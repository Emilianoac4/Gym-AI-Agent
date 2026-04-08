import express from "express";
import request from "supertest";
import { UserRole } from "@prisma/client";
import { authenticate, authorize } from "../../src/middleware/auth.middleware";
import { errorHandler } from "../../src/middleware/error.middleware";
import { signAuthToken } from "../../src/utils/jwt";

jest.mock("../../src/middleware/security-audit.middleware", () => ({
  emitSecurityAuditEvent: jest.fn(),
}));

function createTestApp() {
  const app = express();

  app.get("/protected", authenticate, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/admin", authenticate, authorize(UserRole.admin), (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(errorHandler);
  return app;
}

describe("BE-SEC-04 auth security", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = createTestApp();

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/Missing or invalid Authorization header/i);
  });

  it("returns 401 when access token is invalid", async () => {
    const app = createTestApp();

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer not-a-real-token");

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/Invalid or expired token/i);
  });

  it("returns 403 when role does not have access", async () => {
    const app = createTestApp();
    const memberToken = signAuthToken({ userId: "member-1", role: UserRole.member });

    const response = await request(app)
      .get("/admin")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Forbidden");
  });

  it("allows authorized role with valid token", async () => {
    const app = createTestApp();
    const adminToken = signAuthToken({ userId: "admin-1", role: UserRole.admin });

    const response = await request(app)
      .get("/admin")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
