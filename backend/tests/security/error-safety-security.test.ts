import express from "express";
import request from "supertest";
import { errorHandler } from "../../src/middleware/error.middleware";

jest.mock("../../src/middleware/security-audit.middleware", () => ({
  emitSecurityAuditEvent: jest.fn(),
}));

describe("BE-SEC-04 secure error responses", () => {
  it("does not leak stack traces in production 500 responses", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const app = express();
    app.get("/boom", () => {
      throw new Error("sensitive internals");
    });
    app.use(errorHandler);

    const response = await request(app).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error");
    expect(response.body.detail).toBeUndefined();
    expect(response.body.stack).toBeUndefined();

    process.env.NODE_ENV = previousNodeEnv;
  });
});
