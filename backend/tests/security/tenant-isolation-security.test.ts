import { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { HttpError } from "../../src/utils/http-error";

const findUniqueMock = jest.fn();

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { getUserProfileById } from "../../src/modules/users/users.controller";

describe("BE-SEC-04 tenant isolation", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("blocks cross-tenant profile reads with 403", async () => {
    findUniqueMock
      .mockResolvedValueOnce({
        id: "target-user",
        role: UserRole.member,
        gymId: "gym-B",
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: "actor-admin",
        role: UserRole.admin,
        gymId: "gym-A",
        isActive: true,
      });

    const req = {
      params: { id: "target-user" },
      auth: {
        userId: "actor-admin",
        role: UserRole.admin,
      },
    } as unknown as Request<{ id: string }>;

    const res = {
      json: jest.fn(),
    } as unknown as Response;

    await expect(getUserProfileById(req, res)).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden",
    });

    expect(res.json).not.toHaveBeenCalled();
  });
});
