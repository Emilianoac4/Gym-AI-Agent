import { Request, Response } from "express";
import { HealthProvider, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  CreateUserInput,
  SetHealthConnectionStateInput,
  UpdateProfileInput,
  UpsertHealthConnectionInput,
} from "./users.validation";
import { PermissionAction, hasPermission } from "../../config/permissions";
import {
  createTokenPair,
  getFutureDateMinutes,
  sendEmailVerification,
} from "../../utils/email-auth";
import { env } from "../../config/env";

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

export const reactivateUserById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.userId === req.params.id) {
    throw new HttpError(400, "You cannot reactivate your own account from this endpoint");
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

  if (!targetUser) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(req.auth, targetUser, "users.reactivate");

  if (targetUser.role === "admin") {
    throw new HttpError(403, "Admin accounts cannot be reactivated from this endpoint");
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: { isActive: true },
  });

  console.log(
    `[AUDIT] ${req.requestId ?? "n/a"} action=users.reactivate actor=${req.auth.userId} target=${targetUser.id}`,
  );

  res.json({
    message: "User reactivated",
    user: {
      id: targetUser.id,
      email: targetUser.email,
      fullName: targetUser.fullName,
      role: targetUser.role,
      isActive: true,
    },
  });
};

export const deleteUserById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.userId === req.params.id) {
    throw new HttpError(400, "You cannot delete your own account");
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

  if (!targetUser) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(req.auth, targetUser, "users.delete");

  if (targetUser.role === "admin") {
    throw new HttpError(403, "Admin accounts cannot be deleted from this endpoint");
  }

  await prisma.$transaction([
    prisma.aIChatLog.deleteMany({ where: { userId: targetUser.id } }),
    prisma.user.delete({ where: { id: targetUser.id } }),
  ]);

  console.log(
    `[AUDIT] ${req.requestId ?? "n/a"} action=users.delete actor=${req.auth.userId} target=${targetUser.id}`,
  );

  res.json({
    message: "User deleted permanently",
    user: {
      id: targetUser.id,
      email: targetUser.email,
      fullName: targetUser.fullName,
      role: targetUser.role,
    },
  });
};

export const listUsers = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (!hasPermission(req.auth.role, "users.list")) {
    throw new HttpError(403, "Forbidden");
  }

  const requester = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { gymId: true, isActive: true },
  });

  if (!requester || !requester.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  const role = (req.query.role as string) ?? undefined;

  const users = await prisma.user.findMany({
    where: {
      gymId: requester.gymId,
      ...(role ? { role: role as UserRole } : {}),
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ users });
};

export const createUser = async (
  req: Request<Record<string, never>, unknown, CreateUserInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (!hasPermission(req.auth.role, "users.create")) {
    throw new HttpError(403, "Forbidden");
  }

  const requester = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { gymId: true, isActive: true, role: true },
  });

  if (!requester || !requester.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  // Trainers can only create members, not other trainers or admins
  if ((requester.role as string) === "trainer" && req.body.role !== "member") {
    throw new HttpError(403, "Trainers can only create member accounts");
  }

  // Prevent creating admin accounts through this endpoint
  if ((req.body.role as string) === "admin") {
    throw new HttpError(403, "Admin accounts cannot be created through this endpoint");
  }

  const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (existing) {
    throw new HttpError(409, "El correo ya está en uso");
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = `TEMP$${await bcrypt.hash(req.body.password, 12)}`;
  const { token, tokenHash } = createTokenPair();
  const tokenExpiresAt = getFutureDateMinutes(env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES);

  const created = await prisma.user.create({
    data: {
      gymId: requester.gymId,
      email: req.body.email,
      passwordHash,
      emailVerifiedAt: null,
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: tokenExpiresAt,
      fullName: req.body.fullName,
      role: req.body.role as UserRole,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
    },
  });

  console.log(
    `[AUDIT] action=users.create actor=${req.auth.userId} target=${created.id} role=${created.role}`,
  );

  let verificationWarning: string | undefined;
  try {
    await sendEmailVerification(created.email, token);
  } catch (error) {
    verificationWarning =
      error instanceof Error
        ? `No se pudo enviar correo de verificacion: ${error.message}`
        : "No se pudo enviar correo de verificacion";
  }

  res.status(201).json({
    message: verificationWarning
      ? "Usuario creado correctamente. El correo de verificacion no pudo enviarse en este momento."
      : "Usuario creado correctamente. Se envio enlace de verificacion al correo.",
    user: created,
    ...(verificationWarning ? { warning: verificationWarning } : {}),
    ...(env.NODE_ENV !== "production" ? { devVerificationToken: token } : {}),
  });
};

export const listHealthConnectionsByUserId = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      role: true,
      gymId: true,
      isActive: true,
    },
  });

  if (!targetUser || !targetUser.isActive) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(req.auth, targetUser, "users.profile.read");

  const connections = await prisma.userHealthConnection.findMany({
    where: { userId: targetUser.id },
    orderBy: { linkedAt: "desc" },
  });

  res.json({ connections });
};

export const upsertHealthConnectionByUserId = async (
  req: Request<{ id: string }, unknown, UpsertHealthConnectionInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      role: true,
      gymId: true,
      isActive: true,
    },
  });

  if (!targetUser || !targetUser.isActive) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(req.auth, targetUser, "users.profile.update");

  const connection = await prisma.userHealthConnection.upsert({
    where: {
      userId_provider: {
        userId: targetUser.id,
        provider: req.body.provider as HealthProvider,
      },
    },
    create: {
      userId: targetUser.id,
      provider: req.body.provider as HealthProvider,
      externalEmail: req.body.externalEmail,
      externalSubject: req.body.externalSubject,
      metadata: req.body.metadata,
      isActive: true,
    },
    update: {
      externalEmail: req.body.externalEmail,
      externalSubject: req.body.externalSubject,
      metadata: req.body.metadata,
      isActive: true,
    },
  });

  res.json({
    message: "Conexion de salud actualizada",
    connection,
  });
};

export const setHealthConnectionStateByUserId = async (
  req: Request<{ id: string; provider: string }, unknown, SetHealthConnectionStateInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      role: true,
      gymId: true,
      isActive: true,
    },
  });

  if (!targetUser || !targetUser.isActive) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(req.auth, targetUser, "users.profile.update");

  const provider = req.params.provider as HealthProvider;
  if (!["apple_health", "google_fit", "health_connect"].includes(provider)) {
    throw new HttpError(400, "Proveedor de salud invalido");
  }

  const existing = await prisma.userHealthConnection.findUnique({
    where: {
      userId_provider: {
        userId: targetUser.id,
        provider,
      },
    },
  });

  if (!existing) {
    throw new HttpError(404, "No existe una conexion para ese proveedor");
  }

  const connection = await prisma.userHealthConnection.update({
    where: {
      userId_provider: {
        userId: targetUser.id,
        provider,
      },
    },
    data: {
      isActive: req.body.isActive,
    },
  });

  res.json({
    message: req.body.isActive ? "Conexion reactivada" : "Conexion desactivada",
    connection,
  });
};
