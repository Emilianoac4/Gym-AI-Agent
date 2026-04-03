import { GymSubscriptionStatus, SubscriptionPlanTier, UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import {
  CreateCompanyAdminInput,
  EnforceGymSubscriptionInput,
  PlatformAdminUserInput,
  PlatformLoginInput,
  UpdateGymSubscriptionInput,
} from "./platform.validation";
import { signPlatformAuthToken } from "../../utils/platform-jwt";

const DEFAULT_PLAN: SubscriptionPlanTier = SubscriptionPlanTier.premium;
const DEFAULT_LIMIT = 50;

const toUtcIso = (value: Date) => value.toISOString();

const getNow = () => new Date();

const getOrCreateSubscription = async (gymId: string) => {
  const existing = await prisma.gymSubscription.findUnique({ where: { gymId } });
  if (existing) {
    return existing;
  }

  const now = getNow();
  const defaultEnd = new Date(now);
  defaultEnd.setUTCDate(defaultEnd.getUTCDate() + 30);

  return prisma.gymSubscription.create({
    data: {
      gymId,
      planTier: DEFAULT_PLAN,
      userLimit: DEFAULT_LIMIT,
      status: GymSubscriptionStatus.active,
      startsAt: now,
      endsAt: defaultEnd,
      updatedBy: "bootstrap",
    },
  });
};

const getGymMemberSnapshot = async (gymId: string) => {
  const members = await prisma.user.findMany({
    where: { gymId, role: UserRole.member },
    select: { id: true, fullName: true, email: true, isActive: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }],
  });

  const activeMembers = members.filter((member) => member.isActive);
  return { members, activeMembers };
};

const resolveGraceWindow = (from: Date) => {
  const graceStartsAt = new Date(from);
  const graceEndsAt = new Date(from);
  graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + env.PLATFORM_SUBSCRIPTION_GRACE_DAYS);
  return { graceStartsAt, graceEndsAt };
};

const requirePlatformSession = (req: Request) => {
  if (!req.platformAuth) {
    throw new HttpError(401, "Platform session required");
  }

  return req.platformAuth;
};

const normalizeUsernames = (fullName: string, usernames?: string[]) => {
  const seed = [fullName, ...(usernames ?? [])]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return Array.from(new Set(seed));
};

export const loginPlatform = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as PlatformLoginInput;

  const user = await prisma.platformAdminUser.findUnique({
    where: { email: body.email.toLowerCase() },
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  const bcrypt = await import("bcryptjs");
  const isValid = await bcrypt.compare(body.password, user.passwordHash);
  if (!isValid) {
    throw new HttpError(401, "Credenciales invalidas");
  }

  const token = signPlatformAuthToken({
    platformUserId: user.id,
    email: user.email,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
  });
};

export const getPlatformSession = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const user = await prisma.platformAdminUser.findUnique({
    where: { id: session.platformUserId },
    select: { id: true, email: true, fullName: true, usernames: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Platform session user is not active");
  }

  res.json({ user });
};

export const bootstrapPlatformAdmin = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as PlatformAdminUserInput;

  const existingCount = await prisma.platformAdminUser.count();
  if (existingCount > 0) {
    throw new HttpError(409, "Platform bootstrap already completed");
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(body.password, 12);

  const created = await prisma.platformAdminUser.create({
    data: {
      email: body.email.toLowerCase(),
      passwordHash,
      fullName: body.fullName,
      usernames: normalizeUsernames(body.fullName, body.usernames),
      isActive: true,
      createdById: null,
    },
    select: { id: true, email: true, fullName: true, usernames: true, createdAt: true },
  });

  res.status(201).json({
    message: "Usuario de plataforma creado",
    user: {
      ...created,
      createdAt: created.createdAt.toISOString(),
    },
  });
};

export const createPlatformAdminUser = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as PlatformAdminUserInput;
  const session = requirePlatformSession(req);

  const existing = await prisma.platformAdminUser.findUnique({ where: { email: body.email.toLowerCase() } });
  if (existing) {
    throw new HttpError(409, "Ya existe un usuario de plataforma con ese correo");
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(body.password, 12);

  const created = await prisma.platformAdminUser.create({
    data: {
      email: body.email.toLowerCase(),
      passwordHash,
      fullName: body.fullName,
      usernames: normalizeUsernames(body.fullName, body.usernames),
      isActive: true,
      createdById: session.platformUserId,
    },
    select: { id: true, email: true, fullName: true, usernames: true, createdAt: true },
  });

  res.status(201).json({
    message: "Usuario de plataforma creado",
    user: {
      ...created,
      createdAt: created.createdAt.toISOString(),
    },
  });
};

export const listPlatformAdminUsers = async (req: Request, res: Response): Promise<void> => {
  requirePlatformSession(req);

  const users = await prisma.platformAdminUser.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      usernames: true,
      isActive: true,
      createdAt: true,
      createdById: true,
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({
    users: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
  });
};

export const getPlatformDashboard = async (_req: Request, res: Response): Promise<void> => {
  const [gyms, subscriptions] = await Promise.all([
    prisma.gym.findMany({
      select: {
        id: true,
        name: true,
        ownerName: true,
        currency: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.gymSubscription.findMany({
      select: {
        gymId: true,
        planTier: true,
        userLimit: true,
        status: true,
        startsAt: true,
        endsAt: true,
        graceEndsAt: true,
      },
    }),
  ]);

  const subscriptionsMap = new Map(subscriptions.map((item) => [item.gymId, item]));

  const companyCards = await Promise.all(
    gyms.map(async (gym) => {
      const [users, sub] = await Promise.all([
        prisma.user.groupBy({
          by: ["role", "isActive"],
          where: { gymId: gym.id },
          _count: { _all: true },
        }),
        getOrCreateSubscription(gym.id),
      ]);

      const roleCount = { admins: 0, trainers: 0, members: 0, activeMembers: 0 };
      users.forEach((entry) => {
        if (entry.role === UserRole.admin) roleCount.admins += entry._count._all;
        if (entry.role === UserRole.trainer) roleCount.trainers += entry._count._all;
        if (entry.role === UserRole.member) {
          roleCount.members += entry._count._all;
          if (entry.isActive) {
            roleCount.activeMembers += entry._count._all;
          }
        }
      });

      const now = getNow();
      const daysRemaining = Math.max(0, Math.ceil((sub.endsAt.getTime() - now.getTime()) / 86400000));

      return {
        gymId: gym.id,
        gymName: gym.name,
        ownerName: gym.ownerName,
        currency: gym.currency === "CRC" ? "CRC" : "USD",
        planTier: sub.planTier,
        userLimit: sub.userLimit,
        subscriptionStatus: sub.status,
        activeUntil: toUtcIso(sub.endsAt),
        graceEndsAt: sub.graceEndsAt ? toUtcIso(sub.graceEndsAt) : null,
        daysRemaining,
        counts: roleCount,
        isOverflowing: roleCount.activeMembers > sub.userLimit,
      };
    }),
  );

  const expiringSoon = companyCards.filter((item) => item.daysRemaining <= 10);
  const overflowing = companyCards.filter((item) => item.isOverflowing);

  res.json({
    generatedAt: new Date().toISOString(),
    summary: {
      companies: companyCards.length,
      expiringSoon: expiringSoon.length,
      overflowing: overflowing.length,
    },
    companies: companyCards,
  });
};

export const getCompanyHierarchy = async (req: Request, res: Response): Promise<void> => {
  const { gymId } = req.params as { gymId: string };

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, name: true, ownerName: true, currency: true, createdAt: true },
  });

  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }

  const [subscription, users] = await Promise.all([
    getOrCreateSubscription(gym.id),
    prisma.user.findMany({
      where: { gymId: gym.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const { activeMembers } = await getGymMemberSnapshot(gym.id);

  res.json({
    company: {
      gymId: gym.id,
      gymName: gym.name,
      ownerName: gym.ownerName,
      currency: gym.currency === "CRC" ? "CRC" : "USD",
      createdAt: toUtcIso(gym.createdAt),
    },
    subscription: {
      planTier: subscription.planTier,
      userLimit: subscription.userLimit,
      status: subscription.status,
      startsAt: toUtcIso(subscription.startsAt),
      endsAt: toUtcIso(subscription.endsAt),
      graceStartsAt: subscription.graceStartedAt ? toUtcIso(subscription.graceStartedAt) : null,
      graceEndsAt: subscription.graceEndsAt ? toUtcIso(subscription.graceEndsAt) : null,
      isOverflowing: activeMembers.length > subscription.userLimit,
      activeMemberCount: activeMembers.length,
    },
    hierarchy: {
      admins: users.filter((user) => user.role === UserRole.admin),
      trainers: users.filter((user) => user.role === UserRole.trainer),
      members: users.filter((user) => user.role === UserRole.member),
    },
  });
};

export const updateCompanySubscription = async (req: Request, res: Response): Promise<void> => {
  const { gymId } = req.params as { gymId: string };
  const { planTier, userLimit, endsAt, startsAt, notes, reason } = req.body as UpdateGymSubscriptionInput;

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true } });
  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }

  const existing = await getOrCreateSubscription(gymId);
  const now = getNow();
  const nextEndsAt = new Date(endsAt);
  const nextStartsAt = startsAt ? new Date(startsAt) : existing.startsAt;

  if (Number.isNaN(nextEndsAt.getTime()) || Number.isNaN(nextStartsAt.getTime())) {
    throw new HttpError(400, "Fechas invalidas para actualizar suscripcion");
  }

  if (nextEndsAt <= nextStartsAt) {
    throw new HttpError(400, "La fecha fin debe ser mayor a la fecha inicio");
  }

  const { activeMembers } = await getGymMemberSnapshot(gymId);
  const isOverflowing = activeMembers.length > userLimit;

  const grace = isOverflowing ? resolveGraceWindow(now) : { graceStartsAt: null, graceEndsAt: null };

  const nextStatus = isOverflowing ? GymSubscriptionStatus.grace : GymSubscriptionStatus.active;

  const updated = await prisma.gymSubscription.update({
    where: { gymId },
    data: {
      planTier: planTier as SubscriptionPlanTier,
      userLimit,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      status: nextStatus,
      graceStartedAt: grace.graceStartsAt,
      graceEndsAt: grace.graceEndsAt,
      notes: notes ?? null,
      updatedBy: "platform",
    },
  });

  await prisma.gymSubscriptionAudit.create({
    data: {
      gymId,
      action: "subscription.updated",
      previousPlanTier: existing.planTier,
      newPlanTier: updated.planTier,
      previousUserLimit: existing.userLimit,
      newUserLimit: updated.userLimit,
      previousEndsAt: existing.endsAt,
      newEndsAt: updated.endsAt,
      reason: reason ?? null,
      createdBy: "platform",
    },
  });

  res.json({
    message: "Suscripcion actualizada",
    subscription: {
      planTier: updated.planTier,
      userLimit: updated.userLimit,
      status: updated.status,
      startsAt: toUtcIso(updated.startsAt),
      endsAt: toUtcIso(updated.endsAt),
      graceStartsAt: updated.graceStartedAt ? toUtcIso(updated.graceStartedAt) : null,
      graceEndsAt: updated.graceEndsAt ? toUtcIso(updated.graceEndsAt) : null,
      activeMembers: activeMembers.length,
      isOverflowing,
    },
  });
};

export const enforceCompanyUserLimit = async (req: Request, res: Response): Promise<void> => {
  const { gymId } = req.params as { gymId: string };
  const { reason } = req.body as EnforceGymSubscriptionInput;

  const [subscription, allMembers] = await Promise.all([
    prisma.gymSubscription.findUnique({ where: { gymId } }),
    prisma.user.findMany({
      where: { gymId, role: UserRole.member, isActive: true },
      select: { id: true, fullName: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  if (!subscription) {
    throw new HttpError(404, "No existe suscripcion para esta empresa");
  }

  const overflowCount = Math.max(0, allMembers.length - subscription.userLimit);
  if (overflowCount === 0) {
    if (subscription.status !== GymSubscriptionStatus.active) {
      await prisma.gymSubscription.update({
        where: { gymId },
        data: {
          status: GymSubscriptionStatus.active,
          graceStartedAt: null,
          graceEndsAt: null,
          updatedBy: "platform",
        },
      });
    }

    res.json({ message: "Sin sobrecupo. No se desactivaron usuarios.", deactivatedUsers: [] });
    return;
  }

  const overflowUsers = allMembers.slice(subscription.userLimit);

  const shouldSuspend =
    subscription.status === GymSubscriptionStatus.grace &&
    subscription.graceEndsAt !== null &&
    subscription.graceEndsAt.getTime() < Date.now();

  if (!shouldSuspend) {
    const grace = resolveGraceWindow(getNow());
    await prisma.gymSubscription.update({
      where: { gymId },
      data: {
        status: GymSubscriptionStatus.grace,
        graceStartedAt: grace.graceStartsAt,
        graceEndsAt: grace.graceEndsAt,
        updatedBy: "platform",
      },
    });

    res.json({
      message: "Sobrecupo detectado. Se activo periodo de gracia.",
      graceEndsAt: grace.graceEndsAt.toISOString(),
      overflowCount,
      affectedUsers: overflowUsers.map((user) => ({ id: user.id, fullName: user.fullName })),
    });
    return;
  }

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: overflowUsers.map((user) => user.id) } },
      data: { isActive: false },
    }),
    prisma.gymSubscription.update({
      where: { gymId },
      data: { status: GymSubscriptionStatus.suspended, updatedBy: "platform" },
    }),
    prisma.gymSubscriptionAudit.create({
      data: {
        gymId,
        action: "subscription.limit_enforced",
        previousPlanTier: subscription.planTier,
        newPlanTier: subscription.planTier,
        previousUserLimit: subscription.userLimit,
        newUserLimit: subscription.userLimit,
        previousEndsAt: subscription.endsAt,
        newEndsAt: subscription.endsAt,
        reason: reason ?? "Grace period expired",
        createdBy: "platform",
      },
    }),
  ]);

  res.json({
    message: "Limite aplicado. Usuarios excedentes fueron desactivados.",
    deactivatedUsers: overflowUsers.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      createdAt: user.createdAt.toISOString(),
    })),
  });
};

export const createCompanyAdmin = async (req: Request, res: Response): Promise<void> => {
  const { gymId } = req.params as { gymId: string };
  const body = req.body as CreateCompanyAdminInput;

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true } });
  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email: body.email } });
  if (existingByEmail) {
    throw new HttpError(409, "Ya existe un usuario con ese correo");
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(body.password, 12);

  const created = await prisma.user.create({
    data: {
      gymId,
      email: body.email,
      passwordHash,
      emailVerifiedAt: new Date(),
      fullName: body.fullName,
      role: UserRole.admin,
      isActive: true,
    },
    select: {
      id: true,
      gymId: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
    },
  });

  await prisma.gymSubscriptionAudit.create({
    data: {
      gymId,
      action: "admin.created",
      reason: "Created from platform governance",
      createdBy: "platform",
    },
  });

  res.status(201).json({
    message: "Administrador creado correctamente",
    admin: {
      ...created,
      createdAt: created.createdAt.toISOString(),
    },
  });
};
