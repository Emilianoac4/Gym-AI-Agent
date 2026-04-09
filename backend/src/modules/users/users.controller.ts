import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { AuditAction, HealthProvider, MembershipTransactionType, PaymentMethod, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { createAuditLog } from "../../utils/audit";
import {
  generateUploadUrl,
  getAvatarUrl,
  deleteAvatar,
  buildAvatarPath,
} from "../../services/avatar-storage.service";
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
import { env } from "../../config/env";
import { forceSendDailyMembershipSummary } from "../../services/membership-summary.service";

export const listGymAdmins = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) throw new HttpError(401, "Unauthorized");

  const actor = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { gymId: true, isActive: true },
  });

  if (!actor || !actor.isActive) throw new HttpError(401, "Unauthorized");

  const admins = await prisma.user.findMany({
    where: { gymId: actor.gymId, role: UserRole.admin, isActive: true },
    select: {
      id: true,
      fullName: true,
      profile: { select: { avatarUrl: true } },
    },
    orderBy: { fullName: "asc" },
  });

  res.json({
    admins: admins.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      avatarUrl: a.profile?.avatarUrl ?? null,
    })),
  });
};

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
      membershipStartAt: user.membershipStartAt,
      membershipEndAt: user.membershipEndAt,
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
      preferredDays: req.body.preferredDays ?? Prisma.JsonNull,
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
      ...(req.body.preferredDays !== undefined
        ? { preferredDays: req.body.preferredDays.length > 0 ? req.body.preferredDays : Prisma.JsonNull }
        : {}),
    },
  });

  console.log(
    `[AUDIT] ${req.requestId ?? "n/a"} action=users.profile.update actor=${req.auth.userId} target=${id}`,
  );

  res.json({ message: "Profile updated", profile });
};

// PATCH /users/:id/avatar ΓÇö update profile picture (self or admin)
// POST /users/:id/avatar/upload-url — request a presigned PUT URL (BE-SEC-05)
export const requestAvatarUploadUrl = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  if (!req.auth) throw new HttpError(401, "Unauthorized");

  const { id } = req.params;
  const { mimeType } = req.body as { mimeType?: string };

  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!mimeType || !allowed.includes(mimeType)) {
    throw new HttpError(400, "mimeType is required. Allowed: image/jpeg, image/png, image/webp");
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, gymId: true, isActive: true },
  });
  if (!existingUser || !existingUser.isActive) throw new HttpError(404, "User not found");

  const actor = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, role: true, gymId: true },
  });
  if (!actor) throw new HttpError(403, "Forbidden");
  if (actor.gymId !== existingUser.gymId) throw new HttpError(403, "Forbidden");
  if (actor.id !== existingUser.id && actor.role !== "admin") throw new HttpError(403, "Forbidden");

  const result = await generateUploadUrl(existingUser.gymId!, id, mimeType);

  res.status(200).json({
    uploadUrl: result.uploadUrl,
    path: result.path,
    signedGetUrl: result.signedGetUrl,
    expiresIn: 300, // client has 5 min to complete the PUT
  });
};

// PATCH /users/:id/avatar — confirm upload and persist path (BE-SEC-05)
export const updateAvatarById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  if (!req.auth) throw new HttpError(401, "Unauthorized");

  const { id } = req.params;
  const { avatarPath } = req.body as { avatarPath?: string };

  if (!avatarPath || typeof avatarPath !== "string" || avatarPath.trim().length === 0) {
    throw new HttpError(400, "avatarPath is required");
  }

  // Validate path format: gymId/userId.ext — reject path traversal
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(avatarPath)) {
    throw new HttpError(400, "Invalid avatarPath format");
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, gymId: true, isActive: true },
  });
  if (!existingUser || !existingUser.isActive) throw new HttpError(404, "User not found");

  const actor = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, role: true, gymId: true },
  });
  if (!actor) throw new HttpError(403, "Forbidden");
  if (actor.gymId !== existingUser.gymId) throw new HttpError(403, "Forbidden");
  if (actor.id !== existingUser.id && actor.role !== "admin") throw new HttpError(403, "Forbidden");

  // Confirm the path belongs to this user's gym to prevent cross-tenant writes
  const expectedPrefix = buildAvatarPath(existingUser.gymId!, id, "image/jpeg").split("/")[0];
  if (!avatarPath.startsWith(`${expectedPrefix}/`)) {
    throw new HttpError(403, "avatarPath does not match user's gym");
  }

  // Remove previous avatar from storage if it was already a storage path (not a data URI)
  const existing = await prisma.userProfile.findUnique({
    where: { userId: id },
    select: { avatarUrl: true },
  });
  if (existing?.avatarUrl && !existing.avatarUrl.startsWith("data:")) {
    void deleteAvatar(existing.avatarUrl).catch((err) =>
      console.warn("[avatar] Failed to delete old avatar from storage", err),
    );
  }

  await prisma.userProfile.upsert({
    where: { userId: id },
    create: { id: randomUUID(), userId: id, avatarUrl: avatarPath },
    update: { avatarUrl: avatarPath },
  });

  const signedUrl = await getAvatarUrl(avatarPath);

  void createAuditLog({
    gymId: existingUser.gymId ?? undefined,
    actorUserId: req.auth.userId,
    action: AuditAction.platform_action,
    resourceType: "user_avatar",
    resourceId: id,
    metadata: { avatarPath },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] as string | undefined,
  });

  res.json({ message: "Avatar updated", avatarUrl: signedUrl });
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
      deletedAt: true,
    },
  });

  if (!targetUser) {
    throw new HttpError(404, "User not found");
  }

  await assertCanAccessTargetUser(req.auth, targetUser, "users.reactivate");

  if (targetUser.deletedAt !== null) {
    throw new HttpError(404, "User not found");
  }

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

  // Soft-delete: preserve user row so membership_transactions remain joinable.
  // membership_transactions has no FK constraint — hard delete would orphan financial records.
  await prisma.$transaction([
    prisma.aIChatLog.deleteMany({ where: { userId: targetUser.id } }),
    prisma.user.update({
      where: { id: targetUser.id },
      data: { isActive: false, deletedAt: new Date() },
    }),
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
    message: "User deleted",
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
      deletedAt: null,
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
  // Check not already an active member of this gym (ignore soft-deleted rows so they can be re-registered)
  const existingMembership = await prisma.user.findFirst({
    where: { email: emailLower, gymId: requester.gymId, deletedAt: null },
  });
  if (existingMembership) {
    throw new HttpError(409, "El correo ya est├í en uso en este gimnasio");
  }

  // Validate username uniqueness globally (ignore soft-deleted rows)
  const existingWithUsername = await prisma.user.findFirst({
    where: { username: req.body.username, deletedAt: null },
  });
  if (existingWithUsername) {
    throw new HttpError(409, "El nombre de usuario ya est├í en uso en la plataforma");
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
    } else {
      // Re-registration: reset credentials so the user must change their password on next login
      globalAccount = await tx.globalUserAccount.update({
        where: { email: emailLower },
        data: {
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
        username: req.body.username,
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
      const LEVEL_LABELS = ["Principiante", "Basico", "Intermedio", "Avanzado", "Elite"];
      const availDays = req.body.profile.availabilityDays;
      const availStr = availDays === 1 ? "1 dia por semana" : `${availDays} dias por semana`;
      const levelStr = LEVEL_LABELS[req.body.profile.level - 1] ?? `Nivel ${req.body.profile.level}`;

      await tx.userProfile.create({
        data: {
          userId: newUser.id,
          gender: req.body.profile.gender,
          goal: req.body.profile.goal,
          availability: availStr,
          experienceLvl: levelStr,
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
      deletedAt: true,
    },
  });

  if (!targetUser) {
    throw new HttpError(404, "User not found");
  }

  if (targetUser.gymId !== requester.gymId) {
    throw new HttpError(403, "Forbidden");
  }

  if (targetUser.deletedAt !== null) {
    throw new HttpError(404, "User not found");
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
      deletedAt: true,
    },
  });

  if (!targetUser || !targetUser.isActive) {
    throw new HttpError(404, "User not found");
  }

  if (targetUser.deletedAt !== null) {
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
      deletedAt: true,
    },
  });

  if (!targetUser || !targetUser.isActive) {
    throw new HttpError(404, "User not found");
  }

  if (targetUser.deletedAt !== null) {
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
      deletedAt: true,
    },
  });

  if (!targetUser || !targetUser.isActive) {
    throw new HttpError(404, "User not found");
  }

  if (targetUser.deletedAt !== null) {
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
