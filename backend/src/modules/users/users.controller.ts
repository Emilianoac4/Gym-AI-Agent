import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { UpdateProfileInput } from "./users.validation";

export const getUserProfileById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.role !== "admin" && req.auth.userId !== req.params.id) {
    throw new HttpError(403, "You can only access your own profile");
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { profile: true },
  });

  if (!user || !user.isActive) {
    throw new HttpError(404, "User not found");
  }

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

  if (req.auth.role !== "admin" && req.auth.userId !== req.params.id) {
    throw new HttpError(403, "You can only update your own profile");
  }

  const { id } = req.params;

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser || !existingUser.isActive) {
    throw new HttpError(404, "User not found");
  }

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

  res.json({ message: "Profile updated", profile });
};
