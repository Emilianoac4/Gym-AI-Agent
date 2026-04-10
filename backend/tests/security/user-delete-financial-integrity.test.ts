import { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { deleteUserById } from "../../src/modules/users/users.controller";

const findUniqueMock = jest.fn();
const updateMock = jest.fn();
const chatDeleteManyMock = jest.fn();
const membershipTxDeleteManyMock = jest.fn();
const transactionMock = jest.fn();

const createAuditLogMock = jest.fn();

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
    aIChatLog: {
      deleteMany: (...args: unknown[]) => chatDeleteManyMock(...args),
    },
    membershipTransaction: {
      deleteMany: (...args: unknown[]) => membershipTxDeleteManyMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

jest.mock("../../src/utils/audit", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLogMock(...args),
}));

describe("Block 1 - financial integrity on user delete", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
    chatDeleteManyMock.mockReset();
    membershipTxDeleteManyMock.mockReset();
    transactionMock.mockReset();
    createAuditLogMock.mockReset();

    chatDeleteManyMock.mockResolvedValue({ count: 3 });
    updateMock.mockResolvedValue({ id: "target-user" });
    transactionMock.mockImplementation(async (operations: Array<Promise<unknown>>) => Promise.all(operations));
    createAuditLogMock.mockResolvedValue(undefined);
  });

  it("soft deletes user without touching membership transactions", async () => {
    findUniqueMock.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "target-user") {
        return Promise.resolve({
          id: "target-user",
          role: UserRole.member,
          gymId: "gym-1",
          isActive: true,
          fullName: "Target User",
          email: "target@example.com",
        });
      }

      if (where.id === "admin-1") {
        return Promise.resolve({
          id: "admin-1",
          role: UserRole.admin,
          gymId: "gym-1",
          isActive: true,
        });
      }

      return Promise.resolve(null);
    });

    const req = {
      params: { id: "target-user" },
      auth: {
        userId: "admin-1",
        role: UserRole.admin,
      },
      ip: "127.0.0.1",
      headers: {
        "user-agent": "jest",
      },
      requestId: "req-test-1",
    } as unknown as Request<{ id: string }>;

    const res = {
      json: jest.fn(),
    } as unknown as Response;

    await deleteUserById(req, res);

    expect(chatDeleteManyMock).toHaveBeenCalledWith({ where: { userId: "target-user" } });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "target-user" },
        data: expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
        }),
      }),
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    const txArgs = transactionMock.mock.calls[0]?.[0] as unknown[];
    expect(Array.isArray(txArgs)).toBe(true);
    expect(txArgs).toHaveLength(2);

    expect(membershipTxDeleteManyMock).not.toHaveBeenCalled();

    expect(createAuditLogMock).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "User deleted",
        user: expect.objectContaining({
          id: "target-user",
        }),
      }),
    );
  });
});
