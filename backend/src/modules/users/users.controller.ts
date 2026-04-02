import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { UpdateProfileInput } from "./users.validation";
import { PermissionAction, hasPermission } from "../../config/permissions";

type ActiveUser = {
  id: string;
  role: string;
  gymId: string;
  isActive: boolean;
};

const getActiveUserById = async (id: string): Promise<ActiveUser | null> => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      gymId: true,
      isActive: true,
    },
  });
};

const assertCanAccessTargetUser = async (
  auth: NonNullable<Request["auth"]>,
  targetUser: ActiveUser,
  action: PermissionAction,
): Promise<void> => {
  if (auth.userId === targetUser.id && action !== "users.deactivate") {
    return;
  }

  if (!hasPermission(auth.role, action)) {
    throw new HttpError(403, "Forbidden");
  }

  const requester = await getActiveUserById(auth.userId);
  if (!requester || !requester.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  if (requester.gymId !== targetUser.gymId) {
    throw new HttpError(403, "Forbidden");
  }

  if (requester.role === "trainer") {
    if (targetUser.role !== "member") {
      throw new HttpError(403, "Trainers can only manage member accounts");
    }
  }

  if (action === "users.deactivate" && targetUser.role === "admin") {
    throw new HttpError(403, "Admin accounts cannot be deactivated from this endpoint");
  }
};

export const getUserProfileById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { profile: true },
  });

  if (!user || !user.isActive) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(
    req.auth,
    {
      id: user.id,
      role: user.role,
      gymId: user.gymId,
      isActive: user.isActive,
    },
    "users.profile.read",
  );

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      gymId: user.gymId,
      createdAt: user.createdAt,
    },
    profile: user.profile,
  });
};

export const updateUserProfileById = async (
  req: Request<{ id: string }, unknown, UpdateProfileInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  const { id } = req.params;

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      gymId: true,
      isActive: true,
    },
  });
  if (!existingUser || !existingUser.isActive) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(req.auth, existingUser, "users.profile.update");

  const profile = await prisma.userProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      birthDate: req.body.birthDate ? new Date(req.body.birthDate) : undefined,
      heightCm: req.body.heightCm,
      goal: req.body.goal,
      medicalConds: req.body.medicalConds,
      injuries: req.body.injuries,
      experienceLvl: req.body.experienceLvl,
      availability: req.body.availability,
      dietPrefs: req.body.dietPrefs,
    },
    update: {
      birthDate: req.body.birthDate ? new Date(req.body.birthDate) : undefined,
      heightCm: req.body.heightCm,
      goal: req.body.goal,
      medicalConds: req.body.medicalConds,
      injuries: req.body.injuries,
      experienceLvl: req.body.experienceLvl,
      availability: req.body.availability,
      dietPrefs: req.body.dietPrefs,
    },
  });

  console.log(
    `[AUDIT] ${req.requestId ?? "n/a"} action=users.profile.update actor=${req.auth.userId} target=${id}`,
  );

  res.json({ message: "Profile updated", profile });
};

export const deactivateUserById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.userId === req.params.id) {
    throw new HttpError(400, "You cannot deactivate your own account");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      role: true,
      gymId: true,
      isActive: true,
      fullName: true,
      email: true,
    },
  });

  if (!targetUser || !targetUser.isActive) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(req.auth, targetUser, "users.deactivate");

  await prisma.user.update({
    where: { id: targetUser.id },
    data: { isActive: false },
  });

  console.log(
    `[AUDIT] ${req.requestId ?? "n/a"} action=users.deactivate actor=${req.auth.userId} target=${targetUser.id}`,
  );

  res.json({
    message: "User deactivated",
    user: {
      id: targetUser.id,
      email: targetUser.email,
      fullName: targetUser.fullName,
      role: targetUser.role,
      isActive: false,
    },
  });
};
