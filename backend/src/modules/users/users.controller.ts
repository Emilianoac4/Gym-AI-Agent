import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { AuditAction, HealthProvider, MembershipTransactionType, PaymentMethod, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { createAuditLog } from "../../utils/audit";
import {
  CreateUserInput,
  RenewMembershipInput,
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
import { generateGymScopedUsername } from "../../utils/username";
import { env } from "../../config/env";
import { forceSendDailyMembershipSummary } from "../../services/membership-summary.service";

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

  const actorUserId = req.auth.userId;

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
      id: randomUUID(),
      userId: id,
      gender: req.body.gender,
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
      gender: req.body.gender,
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

// PATCH /users/:id/avatar — update profile picture (self or admin)
export const updateAvatarById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  if (!req.auth) throw new HttpError(401, "Unauthorized");

  const { id } = req.params;
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64 || typeof imageBase64 !== "string") {
    throw new HttpError(400, "imageBase64 is required");
  }

  // Strip data URI prefix if present
  const dataUriMatch = imageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  const rawBase64 = dataUriMatch ? dataUriMatch[2] : imageBase64;

  // Size guard: 250 KB base64 ≈ ~186 KB image. Anything bigger wasn't properly compressed client-side.
  if (rawBase64.length > 260_000) {
    throw new HttpError(400, "Image too large. Please compress before uploading (max ~190 KB).");
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, gymId: true, isActive: true },
  });
  if (!existingUser || !existingUser.isActive) throw new HttpError(404, "User not found");

  // Only the user themselves or an admin in the same gym can update
  const actor = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, role: true, gymId: true },
  });
  if (!actor) throw new HttpError(403, "Forbidden");
  if (actor.gymId !== existingUser.gymId) throw new HttpError(403, "Forbidden");
  if (actor.id !== existingUser.id && actor.role !== "admin") throw new HttpError(403, "Forbidden");

  const dataUri = `data:image/jpeg;base64,${rawBase64}`;

  const profile = await prisma.userProfile.upsert({
    where: { userId: id },
    create: { id: randomUUID(), userId: id, avatarUrl: dataUri },
    update: { avatarUrl: dataUri },
  });

  res.json({ message: "Avatar updated", avatarUrl: profile.avatarUrl });
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

  await createAuditLog({
    gymId: targetUser.gymId,
    actorUserId: req.auth.userId,
    action: AuditAction.user_deleted,
    resourceType: "user",
    resourceId: targetUser.id,
    changes: {
      email: targetUser.email,
      role: targetUser.role,
      fullName: targetUser.fullName,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] as string,
  });

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
  const requesterRole = req.auth.role as UserRole;

  const effectiveRoleFilter = requesterRole === UserRole.trainer
    ? { role: UserRole.member }
    : role
      ? { role: role as UserRole }
      : {};

  const users = await prisma.user.findMany({
    where: {
      gymId: requester.gymId,
      ...effectiveRoleFilter,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      isActive: true,
      membershipStartAt: true,
      membershipEndAt: true,
      profile: {
        select: { birthDate: true },
      },
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

  const actorUserId = req.auth.userId;

  const requester = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { gymId: true, isActive: true, role: true, gym: { select: { currency: true, name: true } } },
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

  const emailLower = req.body.email.toLowerCase().trim();
  // Check not already a member of this gym
  const existingMembership = await prisma.user.findFirst({
    where: { email: emailLower, gymId: requester.gymId },
  });
  if (existingMembership) {
    throw new HttpError(409, "El correo ya está en uso en este gimnasio");
  }

  const isMemberRole = req.body.role === "member";
  const membershipStartAt = isMemberRole ? new Date() : null;
  const membershipEndAt = isMemberRole
    ? (() => {
        const end = new Date();
        end.setMonth(end.getMonth() + (req.body.membershipMonths ?? 1));
        return end;
      })()
    : null;
  let verificationToken: string | null = null;

  const created = await prisma.$transaction(async (tx) => {
    const bcrypt = await import("bcryptjs");
    const tempPasswordHash = `TEMP$${await bcrypt.hash(req.body.password, 12)}`;
    const { token, tokenHash } = createTokenPair();
    verificationToken = token;
    const tokenExpiresAt = getFutureDateMinutes(env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES);
    const verificationSentAt = new Date();

    // Find or create GlobalUserAccount
    let globalAccount = await tx.globalUserAccount.findUnique({ where: { email: emailLower } });
    if (!globalAccount) {
      globalAccount = await tx.globalUserAccount.create({
        data: {
          email: emailLower,
          passwordHash: tempPasswordHash,
          fullName: req.body.fullName,
          emailVerifiedAt: null,
          emailVerificationLastSentAt: verificationSentAt,
          emailVerificationTokenHash: tokenHash,
          emailVerificationTokenExpiresAt: tokenExpiresAt,
        },
      });
    }

    const newUser = await tx.user.create({
      data: {
        gymId: requester.gymId,
        globalUserId: globalAccount.id,
        email: emailLower,
        fullName: req.body.fullName,
        username: await generateGymScopedUsername(tx, req.body.fullName, requester.gym?.name ?? "gym"),
        role: req.body.role as UserRole,
        membershipStartAt,
        membershipEndAt,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        membershipStartAt: true,
        membershipEndAt: true,
      },
    });

    if (isMemberRole && req.body.profile) {
      await tx.userProfile.create({
        data: {
          userId: newUser.id,
          gender: req.body.profile.gender,
          goal: req.body.profile.goal,
          availability: `${req.body.profile.availabilityDays} dias/semana`,
          experienceLvl: `Nivel ${req.body.profile.level}`,
        },
      });
    }

    if (
      isMemberRole &&
      membershipStartAt &&
      membershipEndAt &&
      req.body.paymentMethod &&
      req.body.paymentAmount
    ) {
      await tx.membershipTransaction.create({
        data: {
          gymId: requester.gymId,
          userId: newUser.id,
          actorUserId,
          type: MembershipTransactionType.activation,
          paymentMethod: req.body.paymentMethod as PaymentMethod,
          amount: req.body.paymentAmount,
          currency: requester.gym?.currency === "CRC" ? "CRC" : "USD",
          membershipMonths: req.body.membershipMonths ?? 1,
          membershipStartAt,
          membershipEndAt,
        },
      });
    }

    if (isMemberRole && req.body.initialMeasurement) {
      const {
        weightKg,
        bodyFatPct,
        muscleMass,
        chestCm,
        waistCm,
        hipCm,
        armCm,
      } = req.body.initialMeasurement;
      const hasMeasurementData =
        weightKg !== undefined ||
        bodyFatPct !== undefined ||
        muscleMass !== undefined ||
        chestCm !== undefined ||
        waistCm !== undefined ||
        hipCm !== undefined ||
        armCm !== undefined;

      if (hasMeasurementData) {
        await tx.measurement.create({
          data: {
            userId: newUser.id,
            weightKg,
            bodyFatPct,
            muscleMass,
            chestCm,
            waistCm,
            hipCm,
            armCm,
          },
        });
      }
    }

    return newUser;
  });

  await createAuditLog({
    gymId: requester.gymId,
    actorUserId: req.auth.userId,
    action: AuditAction.user_created,
    resourceType: "user",
    resourceId: created.id,
    changes: {
      email: created.email,
      role: created.role,
      fullName: created.fullName,
      membershipStartAt: created.membershipStartAt,
      membershipEndAt: created.membershipEndAt,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] as string,
  });

  console.log(
    `[AUDIT] action=users.create actor=${req.auth.userId} target=${created.id} role=${created.role}`,
  );

  let verificationWarning: string | undefined;
  try {
    if (verificationToken) await sendEmailVerification(created.email, verificationToken);
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
    ...(env.NODE_ENV !== "production" && verificationToken ? { devVerificationToken: verificationToken } : {}),
  });
};

export const renewMembershipByUserId = async (
  req: Request<{ id: string }, unknown, RenewMembershipInput>,
  res: Response,
): Promise<void> => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (!hasPermission(req.auth.role, "users.renewMembership")) {
    throw new HttpError(403, "Forbidden");
  }

  const requester = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { gymId: true, isActive: true, role: true, gym: { select: { currency: true } } },
  });

  if (!requester || !requester.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      gymId: true,
      role: true,
      isActive: true,
      membershipEndAt: true,
      fullName: true,
      email: true,
    },
  });

  if (!targetUser) {
    throw new HttpError(404, "User not found");
  }

  if (targetUser.gymId !== requester.gymId) {
    throw new HttpError(403, "Forbidden");
  }

  if (targetUser.role !== "member") {
    throw new HttpError(400, "Solo se pueden renovar membresias de usuarios miembro");
  }

  const membershipStartAt =
    targetUser.membershipEndAt && targetUser.membershipEndAt > new Date()
      ? targetUser.membershipEndAt
      : new Date();
  const membershipEndAt = new Date(membershipStartAt);
  membershipEndAt.setMonth(membershipEndAt.getMonth() + req.body.membershipMonths);

  const updated = await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      membershipStartAt,
      membershipEndAt,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      membershipStartAt: true,
      membershipEndAt: true,
    },
  });

  await prisma.membershipTransaction.create({
    data: {
      gymId: requester.gymId,
      userId: targetUser.id,
      actorUserId: req.auth.userId,
      type: MembershipTransactionType.renewal,
      paymentMethod: req.body.paymentMethod as PaymentMethod,
      amount: req.body.paymentAmount,
      currency: requester.gym?.currency === "CRC" ? "CRC" : "USD",
      membershipMonths: req.body.membershipMonths,
      membershipStartAt,
      membershipEndAt,
    },
  });

  await createAuditLog({
    gymId: requester.gymId,
    actorUserId: req.auth.userId,
    action: AuditAction.membership_renewed,
    resourceType: "membership",
    resourceId: targetUser.id,
    changes: {
      membershipMonths: req.body.membershipMonths,
      membershipStartAt,
      membershipEndAt,
      paymentMethod: req.body.paymentMethod,
      paymentAmount: req.body.paymentAmount,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] as string,
  });

  console.log(
    `[AUDIT] ${req.requestId ?? "n/a"} action=users.renewMembership actor=${req.auth.userId} target=${targetUser.id}`,
  );

  res.json({
    message: "Membresia renovada correctamente",
    user: updated,
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

export const triggerDailySummary = async (_req: Request, res: Response): Promise<void> => {
  const result = await forceSendDailyMembershipSummary();
  res.json({
    message: "Resumen diario enviado (modo test). Revisa el asunto: [TEST] Resumen diario...",
    ...result,
  });
};
