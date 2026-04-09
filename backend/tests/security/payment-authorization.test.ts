import express from "express";
import request from "supertest";
import { PaymentMethod, UserRole } from "@prisma/client";
import { errorHandler } from "../../src/middleware/error.middleware";
import { signAuthToken } from "../../src/utils/jwt";
import paymentRoutes from "../../src/modules/payments/payment.routes";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    membershipTransaction: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(jest.fn())),
  },
}));

jest.mock("../../src/utils/audit", () => ({
  createAuditLog: jest.fn(),
}));

jest.mock("../../src/modules/memberships/membership.service", () => ({
  activateMembership: jest.fn(),
  renewMembership: jest.fn(),
  getUserMembershipStatus: jest.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/payments", paymentRoutes);
  app.use(errorHandler);
  return app;
}

describe("BE-SEC-07 Payment Endpoint Authorization", () => {
  const trainerToken = signAuthToken({
    userId: "trainer-1",
    role: UserRole.trainer,
  });

  const memberToken = signAuthToken({
    userId: "member-1",
    role: UserRole.member,
  });

  const adminToken = signAuthToken({
    userId: "admin-1",
    role: UserRole.admin,
  });

  it("returns 401 when Authorization header is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/payments").send({
      userId: "user-1",
      membershipMonths: 1,
      paymentMethod: PaymentMethod.card,
      amount: 50,
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when member tries to record payment (insufficient permission)", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        userId: "user-1",
        membershipMonths: 1,
        paymentMethod: PaymentMethod.card,
        amount: 50,
      });

    expect(response.status).toBe(403);
  });

  it("allows trainer to record payment (has permissions.record permission)", async () => {
    const app = createTestApp();

    // Mock the service to return success
    const mockMembership = require("../../src/modules/memberships/membership.service");
    mockMembership.activateMembership.mockResolvedValue({
      user: { id: "user-1", membershipStatus: "ACTIVE" },
      transaction: {
        id: "trans-1",
        type: "activation",
        paymentMethod: PaymentMethod.card,
        amount: 50,
      },
      status: "ACTIVE",
    });

    const prisma = require("../../src/config/prisma").prisma;
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      gymId: "gym-1",
      membershipEndAt: null,
    });

    const response = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${trainerToken}`)
      .send({
        userId: "user-1",
        membershipMonths: 1,
        paymentMethod: PaymentMethod.card,
        amount: 50,
        currency: "USD",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("allows admin to record payment", async () => {
    const app = createTestApp();

    const mockMembership = require("../../src/modules/memberships/membership.service");
    mockMembership.activateMembership.mockResolvedValue({
      user: { id: "user-1", membershipStatus: "ACTIVE" },
      transaction: {
        id: "trans-1",
        type: "activation",
        paymentMethod: PaymentMethod.card,
        amount: 50,
      },
      status: "ACTIVE",
    });

    const prisma = require("../../src/config/prisma").prisma;
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      gymId: "gym-1",
      membershipEndAt: null,
    });

    const response = await request(app)
      .set("Authorization", `Bearer ${adminToken}`)
      .post("/payments")
      .send({
        userId: "user-1",
        membershipMonths: 1,
        paymentMethod: PaymentMethod.card,
        amount: 50,
        currency: "USD",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("returns 404 when target user does not exist", async () => {
    const app = createTestApp();

    const prisma = require("../../src/config/prisma").prisma;
    prisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${trainerToken}`)
      .send({
        userId: "nonexistent-user",
        membershipMonths: 1,
        paymentMethod: PaymentMethod.card,
        amount: 50,
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("User not found");
  });

  it("returns 403 when target user belongs to different gym (tenant isolation)", async () => {
    const app = createTestApp();

    const prisma = require("../../src/config/prisma").prisma;
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      gymId: "gym-2", // Different gym
      membershipEndAt: null,
    });

    const response = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${trainerToken}`)
      .send({
        userId: "user-1",
        membershipMonths: 1,
        paymentMethod: PaymentMethod.card,
        amount: 50,
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("User does not belong to this gym");
  });

  it("validates required payment fields", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${trainerToken}`)
      .send({
        userId: "user-1",
        // Missing membershipMonths, paymentMethod, amount
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid input");
  });

  it("rejects invalid payment method", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${trainerToken}`)
      .send({
        userId: "user-1",
        membershipMonths: 1,
        paymentMethod: "invalid_method",
        amount: 50,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid input");
  });

  it("accepts SINPE as valid payment method", async () => {
    const app = createTestApp();

    const mockMembership = require("../../src/modules/memberships/membership.service");
    mockMembership.activateMembership.mockResolvedValue({
      user: { id: "user-1", membershipStatus: "ACTIVE" },
      transaction: {
        id: "trans-1",
        type: "activation",
        paymentMethod: PaymentMethod.sinpe,
        amount: 50,
      },
      status: "ACTIVE",
    });

    const prisma = require("../../src/config/prisma").prisma;
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      gymId: "gym-1",
      membershipEndAt: null,
    });

    const response = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${trainerToken}`)
      .send({
        userId: "user-1",
        membershipMonths: 1,
        paymentMethod: "sinpe",
        amount: 50,
        currency: "CRC",
      });

    expect(response.status).toBe(201);
    expect(response.body.transaction.paymentMethod).toBe("sinpe");
  });

  it("creates audit log on successful payment", async () => {
    const app = createTestApp();

    const mockMembership = require("../../src/modules/memberships/membership.service");
    mockMembership.activateMembership.mockResolvedValue({
      user: { id: "user-1", membershipStatus: "ACTIVE" },
      transaction: {
        id: "trans-1",
        type: "activation",
        paymentMethod: PaymentMethod.card,
        amount: 50,
      },
      status: "ACTIVE",
    });

    const prisma = require("../../src/config/prisma").prisma;
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      gymId: "gym-1",
      membershipEndAt: null,
    });

    const audit = require("../../src/utils/audit");

    await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${trainerToken}`)
      .send({
        userId: "user-1",
        membershipMonths: 1,
        paymentMethod: PaymentMethod.card,
        amount: 50,
      });

    expect(audit.createAuditLog).toHaveBeenCalled();
    const auditCall = audit.createAuditLog.mock.calls[0][0];
    expect(auditCall.action).toBe("payment_recorded");
    expect(auditCall.actorUserId).toBe("trainer-1");
  });
});
