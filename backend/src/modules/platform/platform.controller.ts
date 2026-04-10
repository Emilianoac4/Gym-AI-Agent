import { GymSubscriptionStatus, SubscriptionPlanTier, UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../utils/http-error";
import {
  CreateCompanyInput,
  CreateCompanyAdminInput,
  DeleteCompanyConfirmInput,
  DeleteCompanyRequestInput,
  EnforceGymSubscriptionInput,
  PlatformAlertsQueryInput,
  PlatformAdminUserInput,
  PlatformDashboardQueryInput,
  PlatformLoginInput,
  RecoverCompanyInput,
  UpdateGymSubscriptionInput,
  UpdateSubscriptionStatusInput,
} from "./platform.validation";
import { signPlatformAuthToken } from "../../utils/platform-jwt";
import { generateGymScopedUsername } from "../../utils/username";

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

const getComparablePasswordHash = (value: string) =>
  value.startsWith("TEMP$") ? value.slice("TEMP$".length) : value;

const hashDeletionChallenge = (value: string) => createHash("sha256").update(value).digest("hex");

const generateDeletionChallengeToken = () => randomBytes(24).toString("hex");

const verifyPlatformPassword = async (platformUserId: string, password: string) => {
  const platformUser = await prisma.platformAdminUser.findUnique({
    where: { id: platformUserId },
    select: { id: true, isActive: true, passwordHash: true },
  });

  if (!platformUser || !platformUser.isActive) {
    throw new HttpError(401, "Usuario de plataforma no valido");
  }

  const bcrypt = await import("bcryptjs");
  const isValidPassword = await bcrypt.compare(password, platformUser.passwordHash);
  if (!isValidPassword) {
    throw new HttpError(401, "Credenciales invalidas");
  }
};

const isAiTokenUsageTableMissing = (error: unknown): boolean => {
  const candidate = error as { code?: string; message?: string };

  if (candidate?.code === "P2021" || candidate?.code === "P2010") {
    return true;
  }

  const message = candidate?.message || "";
  return (
    message.includes('table `public.ai_token_usage_logs` does not exist') ||
    message.includes('relation "ai_token_usage_logs" does not exist')
  );
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

export const getPlatformDashboard = async (req: Request, res: Response): Promise<void> => {
  const includeDeleted = req.query.includeDeleted === "true" || req.query.includeDeleted === "1";
  const query = req.query as unknown as PlatformDashboardQueryInput;
  const tokenDays = Number(query.tokenDays ?? 30);
  const tokenFromDate = new Date(Date.now() - tokenDays * 24 * 60 * 60 * 1000);

  const [gyms, subscriptions] = await Promise.all([
    prisma.gym.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      select: {
        id: true,
        name: true,
        ownerName: true,
        currency: true,
        deletedAt: true,
        recoverUntil: true,
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

  type GymTokenUsageRow = {
    gym_id: string;
    total_tokens: number | string;
    prompt_tokens: number | string;
    completion_tokens: number | string;
    estimated_cost_usd: number | string | null;
  };

  type UserTokenUsageRow = {
    gym_id: string;
    user_id: string;
    user_name: string;
    total_tokens: number | string;
    estimated_cost_usd: number | string | null;
  };

  type ModuleTokenUsageRow = {
    module: string;
    total_tokens: number | string;
    estimated_cost_usd: number | string | null;
  };

  type OperationTokenUsageRow = {
    operation: string;
    total_tokens: number | string;
    estimated_cost_usd: number | string | null;
  };

  type LastTokenEventRow = {
    last_created_at: Date | string | null;
  };

  let gymTokenUsageRows: GymTokenUsageRow[] = [];
  let userTokenUsageRows: UserTokenUsageRow[] = [];
  let moduleTokenUsageRows: ModuleTokenUsageRow[] = [];
  let operationTokenUsageRows: OperationTokenUsageRow[] = [];
  let lastTokenEventAt: string | null = null;
  let tokenTableMissingDetected = false;
  const tokenAggregationFailures: string[] = [];

  try {
    gymTokenUsageRows = await prisma.$queryRaw<GymTokenUsageRow[]>`
      SELECT
        l."gym_id",
        SUM(l."total_tokens")::bigint AS "total_tokens",
        SUM(l."prompt_tokens")::bigint AS "prompt_tokens",
        SUM(l."completion_tokens")::bigint AS "completion_tokens",
        COALESCE(SUM(l."estimated_cost_usd"), 0)::numeric AS "estimated_cost_usd"
      FROM "ai_token_usage_logs" l
      WHERE l."created_at" >= ${tokenFromDate}
      GROUP BY l."gym_id"
    `;
  } catch (error) {
    if (isAiTokenUsageTableMissing(error)) {
      tokenTableMissingDetected = true;
      console.warn("AI token usage table is not available yet. Continuing without token metrics.");
    } else {
      tokenAggregationFailures.push("gym_aggregation");
      console.error("Failed to aggregate AI token usage by gym", error);
    }
  }

  if (!tokenTableMissingDetected) {
    try {
      userTokenUsageRows = await prisma.$queryRaw<UserTokenUsageRow[]>`
        SELECT
          l."gym_id",
          l."user_id",
          COALESCE(u."full_name", 'Usuario') AS "user_name",
          SUM(l."total_tokens")::bigint AS "total_tokens",
          COALESCE(SUM(l."estimated_cost_usd"), 0)::numeric AS "estimated_cost_usd"
        FROM "ai_token_usage_logs" l
        LEFT JOIN "users" u ON u."id" = l."user_id"::text
        WHERE l."created_at" >= ${tokenFromDate}
        GROUP BY l."gym_id", l."user_id", u."full_name"
      `;
    } catch (error) {
      if (isAiTokenUsageTableMissing(error)) {
        tokenTableMissingDetected = true;
        console.warn("AI token usage table is not available yet. Continuing without token metrics.");
      } else {
        tokenAggregationFailures.push("user_aggregation");
        console.error("Failed to aggregate AI token usage by user", error);
      }
    }
  }

  if (!tokenTableMissingDetected) {
    try {
      moduleTokenUsageRows = await prisma.$queryRaw<ModuleTokenUsageRow[]>`
        SELECT
          l."module",
          SUM(l."total_tokens")::bigint AS "total_tokens",
          COALESCE(SUM(l."estimated_cost_usd"), 0)::numeric AS "estimated_cost_usd"
        FROM "ai_token_usage_logs" l
        WHERE l."created_at" >= ${tokenFromDate}
        GROUP BY l."module"
        ORDER BY SUM(l."total_tokens") DESC
      `;
    } catch (error) {
      if (isAiTokenUsageTableMissing(error)) {
        tokenTableMissingDetected = true;
        console.warn("AI token usage table is not available yet. Continuing without token metrics.");
      } else {
        tokenAggregationFailures.push("module_aggregation");
        console.error("Failed to aggregate AI token usage by module", error);
      }
    }
  }

  if (!tokenTableMissingDetected) {
    try {
      operationTokenUsageRows = await prisma.$queryRaw<OperationTokenUsageRow[]>`
        SELECT
          l."operation",
          SUM(l."total_tokens")::bigint AS "total_tokens",
          COALESCE(SUM(l."estimated_cost_usd"), 0)::numeric AS "estimated_cost_usd"
        FROM "ai_token_usage_logs" l
        WHERE l."created_at" >= ${tokenFromDate}
        GROUP BY l."operation"
        ORDER BY SUM(l."total_tokens") DESC
        LIMIT 10
      `;
    } catch (error) {
      if (isAiTokenUsageTableMissing(error)) {
        tokenTableMissingDetected = true;
        console.warn("AI token usage table is not available yet. Continuing without token metrics.");
      } else {
        tokenAggregationFailures.push("operation_aggregation");
        console.error("Failed to aggregate AI token usage by operation", error);
      }
    }
  }

  if (!tokenTableMissingDetected) {
    try {
      const lastTokenEventRows = await prisma.$queryRaw<LastTokenEventRow[]>`
        SELECT MAX(l."created_at") AS "last_created_at"
        FROM "ai_token_usage_logs" l
        WHERE l."created_at" >= ${tokenFromDate}
      `;

      const lastCreatedAt = lastTokenEventRows?.[0]?.last_created_at;
      if (lastCreatedAt) {
        lastTokenEventAt = new Date(lastCreatedAt).toISOString();
      }
    } catch (error) {
      if (isAiTokenUsageTableMissing(error)) {
        tokenTableMissingDetected = true;
        console.warn("AI token usage table is not available yet. Continuing without token metrics.");
      } else {
        tokenAggregationFailures.push("last_event_lookup");
        console.error("Failed to fetch AI token last event timestamp", error);
      }
    }
  }

  if (tokenTableMissingDetected) {
    gymTokenUsageRows = [];
    userTokenUsageRows = [];
    moduleTokenUsageRows = [];
    operationTokenUsageRows = [];
    lastTokenEventAt = null;
  }

  const moduleBreakdown = moduleTokenUsageRows.map((row) => ({
    module: row.module,
    totalTokens: Number(row.total_tokens || 0),
    estimatedCostUsd: Number(row.estimated_cost_usd || 0),
  }));

  const topOperations = operationTokenUsageRows.map((row) => ({
    operation: row.operation,
    totalTokens: Number(row.total_tokens || 0),
    estimatedCostUsd: Number(row.estimated_cost_usd || 0),
  }));

  const gymTokenUsageMap = new Map(
    gymTokenUsageRows.map((row) => [
      row.gym_id,
      {
        totalTokens: Number(row.total_tokens || 0),
        promptTokens: Number(row.prompt_tokens || 0),
        completionTokens: Number(row.completion_tokens || 0),
        estimatedCostUsd: Number(row.estimated_cost_usd || 0),
      },
    ])
  );

  const topUsersByGym = new Map<string, Array<{ userId: string; fullName: string; totalTokens: number; estimatedCostUsd: number }>>();
  userTokenUsageRows.forEach((row) => {
    const bucket = topUsersByGym.get(row.gym_id) || [];
    bucket.push({
      userId: row.user_id,
      fullName: row.user_name,
      totalTokens: Number(row.total_tokens || 0),
      estimatedCostUsd: Number(row.estimated_cost_usd || 0),
    });
    topUsersByGym.set(row.gym_id, bucket);
  });

  for (const [gymId, users] of topUsersByGym.entries()) {
    users.sort((a, b) => b.totalTokens - a.totalTokens);
    topUsersByGym.set(gymId, users.slice(0, 5));
  }

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
        isDeleted: Boolean(gym.deletedAt),
        deletedAt: gym.deletedAt ? toUtcIso(gym.deletedAt) : null,
        recoverUntil: gym.recoverUntil ? toUtcIso(gym.recoverUntil) : null,
        planTier: sub.planTier,
        userLimit: sub.userLimit,
        subscriptionStatus: sub.status,
        activeUntil: toUtcIso(sub.endsAt),
        graceEndsAt: sub.graceEndsAt ? toUtcIso(sub.graceEndsAt) : null,
        daysRemaining,
        counts: roleCount,
        isOverflowing: roleCount.activeMembers > sub.userLimit,
        aiTokenUsage: {
          daysWindow: tokenDays,
          totalTokens: gymTokenUsageMap.get(gym.id)?.totalTokens || 0,
          promptTokens: gymTokenUsageMap.get(gym.id)?.promptTokens || 0,
          completionTokens: gymTokenUsageMap.get(gym.id)?.completionTokens || 0,
          estimatedCostUsd: gymTokenUsageMap.get(gym.id)?.estimatedCostUsd || 0,
          topUsers: topUsersByGym.get(gym.id) || [],
        },
      };
    }),
  );

  const expiringSoon = companyCards.filter((item) => item.daysRemaining <= 10);
  const overflowing = companyCards.filter((item) => item.isOverflowing && !item.isDeleted);
  const deleted = companyCards.filter((item) => item.isDeleted);
  const active = companyCards.filter((item) => !item.isDeleted);

  res.json({
    generatedAt: new Date().toISOString(),
    tokenDays,
    summary: {
      companies: active.length,
      deleted: deleted.length,
      expiringSoon: expiringSoon.length,
      overflowing: overflowing.length,
    },
    aiUsageSummary: {
      moduleBreakdown,
      topOperations,
      lastEventAt: lastTokenEventAt,
      diagnostics: {
        tokenTableMissing: tokenTableMissingDetected,
        failedSegments: tokenAggregationFailures,
      },
    },
    companies: companyCards,
  });
};

export const getPlatformAlerts = async (req: Request, res: Response): Promise<void> => {
  requirePlatformSession(req);
  const query = req.query as unknown as PlatformAlertsQueryInput;
  const daysAhead = Number(query.daysAhead ?? 10);

  const now = new Date();
  const limitDate = new Date(now);
  limitDate.setUTCDate(limitDate.getUTCDate() + daysAhead);

  const [subscriptions, gyms] = await Promise.all([
    prisma.gymSubscription.findMany({
      where: {
        OR: [
          { status: GymSubscriptionStatus.grace },
          { status: GymSubscriptionStatus.suspended },
          { status: GymSubscriptionStatus.cancelled },
          { endsAt: { lte: limitDate } },
        ],
      },
      select: {
        gymId: true,
        planTier: true,
        userLimit: true,
        status: true,
        endsAt: true,
        graceEndsAt: true,
      },
      orderBy: { endsAt: "asc" },
    }),
    prisma.gym.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, ownerName: true },
    }),
  ]);

  const gymMap = new Map(gyms.map((gym) => [gym.id, gym]));

  const pendingQueriesRaw = await prisma.directMessage.findMany({
    where: { readAt: null },
    select: {
      senderUserId: true,
      thread: {
        select: {
          gymId: true,
          adminUserId: true,
        },
      },
    },
  });

  const pendingQueriesByGym = new Map<string, number>();
  pendingQueriesRaw.forEach((item) => {
    if (!item.thread || item.senderUserId === item.thread.adminUserId) {
      return;
    }
    const current = pendingQueriesByGym.get(item.thread.gymId) ?? 0;
    pendingQueriesByGym.set(item.thread.gymId, current + 1);
  });

  const alerts = subscriptions
    .filter((sub) => gymMap.has(sub.gymId))
    .map((sub) => {
    const gym = gymMap.get(sub.gymId);
    const daysRemaining = Math.max(0, Math.ceil((sub.endsAt.getTime() - Date.now()) / 86400000));
    const pendingQueries = pendingQueriesByGym.get(sub.gymId) ?? 0;

      return {
      gymId: sub.gymId,
      gymName: gym?.name ?? "Gimnasio",
      ownerName: gym?.ownerName ?? "",
      planTier: sub.planTier,
      status: sub.status,
      userLimit: sub.userLimit,
      endsAt: sub.endsAt.toISOString(),
      graceEndsAt: sub.graceEndsAt?.toISOString() ?? null,
      daysRemaining,
      pendingUserQueries: pendingQueries,
      isExpiringSoon: daysRemaining <= daysAhead,
      isInGrace: sub.status === GymSubscriptionStatus.grace,
      isSuspended: sub.status === GymSubscriptionStatus.suspended,
      };
    });

  res.json({
    generatedAt: new Date().toISOString(),
    daysAhead,
    alerts,
  });
};

export const createCompany = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const body = req.body as CreateCompanyInput;

  const adminEmailLower = body.adminEmail.toLowerCase();
  const existingGlobalAccount = await prisma.globalUserAccount.findUnique({
    where: { email: adminEmailLower },
  });

  const bcrypt = await import("bcryptjs");

  if (existingGlobalAccount) {
    const isPasswordValid = await bcrypt.compare(
      body.adminPassword,
      getComparablePasswordHash(existingGlobalAccount.passwordHash),
    );
    if (!isPasswordValid) {
      throw new HttpError(
        409,
        "Este correo ya existe y usa una contrasena global diferente. Debes usar la misma contrasena global para afiliarlo a otro gimnasio.",
      );
    }
  }

  const now = new Date();
  const startsAt = body.startsAt ? new Date(body.startsAt) : now;
  const endsAt = body.endsAt ? new Date(body.endsAt) : (() => {
    const date = new Date(startsAt);
    date.setUTCDate(date.getUTCDate() + 30);
    return date;
  })();

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new HttpError(400, "Fechas invalidas para la suscripcion inicial");
  }

  const result = await prisma.$transaction(async (tx) => {
    const gym = await tx.gym.create({
      data: {
        name: body.gymName,
        ownerName: body.ownerName,
        address: body.address ?? null,
        phone: body.phone ?? null,
        currency: body.currency,
        country: body.country ?? null,
        state: body.state ?? null,
        district: body.district ?? null,
      },
      select: { id: true, name: true, ownerName: true, currency: true, createdAt: true },
    });

    const adminGlobalAccount = existingGlobalAccount
      ? await tx.globalUserAccount.update({
          where: { id: existingGlobalAccount.id },
          data: {
            fullName: body.adminFullName,
            emailVerifiedAt: existingGlobalAccount.emailVerifiedAt ?? new Date(),
            isActive: true,
          },
          select: { id: true, email: true, fullName: true, createdAt: true },
        })
      : await tx.globalUserAccount.create({
          data: {
            email: adminEmailLower,
            passwordHash: await bcrypt.hash(body.adminPassword, 12),
            fullName: body.adminFullName,
            emailVerifiedAt: new Date(),
            isActive: true,
          },
          select: { id: true, email: true, fullName: true, createdAt: true },
        });

    const admin = await tx.user.create({
      data: {
        gymId: gym.id,
        globalUserId: adminGlobalAccount.id,
        email: adminEmailLower,
        username: await generateGymScopedUsername(tx, body.adminFullName, body.gymName),
        fullName: body.adminFullName,
        role: UserRole.admin,
        isActive: true,
      },
      select: { id: true, email: true, username: true, fullName: true, role: true, createdAt: true },
    });

    const subscription = await tx.gymSubscription.create({
      data: {
        gymId: gym.id,
        planTier: body.planTier as SubscriptionPlanTier,
        userLimit: body.userLimit,
        status: GymSubscriptionStatus.active,
        startsAt,
        endsAt,
        notes: body.notes ?? null,
        updatedBy: session.platformUserId,
      },
    });

    await tx.gymSubscriptionAudit.create({
      data: {
        gymId: gym.id,
        action: "company.created",
        newPlanTier: subscription.planTier,
        newUserLimit: subscription.userLimit,
        newEndsAt: subscription.endsAt,
        reason: body.notes ?? "Company onboarding",
        createdBy: session.platformUserId,
      },
    });

    return { gym, admin, subscription };
  });

  res.status(201).json({
    message: "Empresa creada correctamente",
    company: {
      gymId: result.gym.id,
      gymName: result.gym.name,
      ownerName: result.gym.ownerName,
      currency: result.gym.currency,
      createdAt: result.gym.createdAt.toISOString(),
    },
    admin: {
      ...result.admin,
      createdAt: result.admin.createdAt.toISOString(),
    },
    subscription: {
      planTier: result.subscription.planTier,
      userLimit: result.subscription.userLimit,
      status: result.subscription.status,
      startsAt: result.subscription.startsAt.toISOString(),
      endsAt: result.subscription.endsAt.toISOString(),
    },
  });
};

export const updateCompanySubscriptionStatus = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const { gymId } = req.params as { gymId: string };
  const body = req.body as UpdateSubscriptionStatusInput;

  const subscription = await prisma.gymSubscription.findUnique({ where: { gymId } });
  if (!subscription) {
    throw new HttpError(404, "No existe suscripcion para esta empresa");
  }

  const status = body.status as GymSubscriptionStatus;
  const nextData: {
    status: GymSubscriptionStatus;
    graceStartedAt?: Date | null;
    graceEndsAt?: Date | null;
    updatedBy: string;
  } = {
    status,
    updatedBy: session.platformUserId,
  };

  if (status === GymSubscriptionStatus.active) {
    nextData.graceStartedAt = null;
    nextData.graceEndsAt = null;
  }

  const updated = await prisma.gymSubscription.update({
    where: { gymId },
    data: nextData,
  });

  await prisma.gymSubscriptionAudit.create({
    data: {
      gymId,
      action: "subscription.status.updated",
      previousPlanTier: subscription.planTier,
      newPlanTier: updated.planTier,
      previousUserLimit: subscription.userLimit,
      newUserLimit: updated.userLimit,
      previousEndsAt: subscription.endsAt,
      newEndsAt: updated.endsAt,
      reason: body.reason ?? null,
      createdBy: session.platformUserId,
    },
  });

  if (status === GymSubscriptionStatus.suspended || status === GymSubscriptionStatus.cancelled) {
    await prisma.user.updateMany({
      where: { gymId, role: UserRole.member },
      data: { isActive: false },
    });
  }

  res.json({
    message: "Estado de suscripcion actualizado",
    subscription: {
      gymId,
      status: updated.status,
      planTier: updated.planTier,
      userLimit: updated.userLimit,
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt.toISOString(),
      graceEndsAt: updated.graceEndsAt?.toISOString() ?? null,
    },
  });
};

export const getCompanyHierarchy = async (req: Request, res: Response): Promise<void> => {
  const { gymId } = req.params as { gymId: string };

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      id: true,
      name: true,
      ownerName: true,
      currency: true,
      deletedAt: true,
      recoverUntil: true,
      lockedAt: true,
      createdAt: true,
    },
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
      isDeleted: Boolean(gym.deletedAt),
      deletedAt: gym.deletedAt ? toUtcIso(gym.deletedAt) : null,
      recoverUntil: gym.recoverUntil ? toUtcIso(gym.recoverUntil) : null,
      lockedAt: gym.lockedAt ? toUtcIso(gym.lockedAt) : null,
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

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }
  if (gym.deletedAt) {
    throw new HttpError(409, "No puedes crear administradores en una empresa eliminada");
  }

  const emailLower = body.email.toLowerCase().trim();
  const existingMembership = await prisma.user.findFirst({
    where: { gymId, email: emailLower },
    select: { id: true },
  });
  if (existingMembership) {
    throw new HttpError(409, "Ese correo ya tiene cuenta en este gimnasio");
  }

  const bcrypt = await import("bcryptjs");

  const created = await prisma.$transaction(async (tx) => {
    const existingGlobalAccount = await tx.globalUserAccount.findUnique({
      where: { email: emailLower },
    });

    let globalAccountId: string;
    if (existingGlobalAccount) {
      const isPasswordValid = await bcrypt.compare(
        body.password,
        getComparablePasswordHash(existingGlobalAccount.passwordHash),
      );
      if (!isPasswordValid) {
        throw new HttpError(
          409,
          "Este correo ya existe y usa una contrasena global diferente. Debes usar la misma contrasena global para afiliarlo a otro gimnasio.",
        );
      }

      const refreshed = await tx.globalUserAccount.update({
        where: { id: existingGlobalAccount.id },
        data: {
          fullName: body.fullName,
          emailVerifiedAt: existingGlobalAccount.emailVerifiedAt ?? new Date(),
          isActive: true,
        },
        select: { id: true },
      });
      globalAccountId = refreshed.id;
    } else {
      const createdGlobal = await tx.globalUserAccount.create({
        data: {
          email: emailLower,
          passwordHash: await bcrypt.hash(body.password, 12),
          fullName: body.fullName,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
        select: { id: true },
      });
      globalAccountId = createdGlobal.id;
    }

    return tx.user.create({
      data: {
        gymId,
        globalUserId: globalAccountId,
        email: emailLower,
        username: await generateGymScopedUsername(tx, body.fullName, gym.name),
        fullName: body.fullName,
        role: UserRole.admin,
        isActive: true,
      },
      select: {
        id: true,
        gymId: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });
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

export const requestCompanyDeletion = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const { gymId } = req.params as { gymId: string };
  const body = req.body as DeleteCompanyRequestInput;

  await verifyPlatformPassword(session.platformUserId, body.platformPassword);

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }
  if (gym.deletedAt) {
    throw new HttpError(409, "La empresa ya fue eliminada");
  }

  const challengeToken = generateDeletionChallengeToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  await prisma.gym.update({
    where: { id: gymId },
    data: {
      deletionPendingAt: new Date(),
      deletionChallengeHash: hashDeletionChallenge(challengeToken),
      deletionChallengeExpiresAt: expiresAt,
      deletionRequestedByPlatformUserId: session.platformUserId,
    },
  });

  res.json({
    message: "Paso 1 completado. Confirma eliminacion con el token y nombre de empresa.",
    challengeToken,
    expiresAt: expiresAt.toISOString(),
    confirmationHint: gym.name,
  });
};

export const confirmCompanyDeletion = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const { gymId } = req.params as { gymId: string };
  const body = req.body as DeleteCompanyConfirmInput;

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      deletionChallengeHash: true,
      deletionChallengeExpiresAt: true,
    },
  });
  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }
  if (gym.deletedAt) {
    throw new HttpError(409, "La empresa ya fue eliminada");
  }

  if (!gym.deletionChallengeHash || !gym.deletionChallengeExpiresAt) {
    throw new HttpError(400, "Primero debes solicitar la eliminacion (paso 1)");
  }
  if (gym.deletionChallengeExpiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "El token de eliminacion expiró. Solicita uno nuevo.");
  }

  if (gym.name.trim().toLowerCase() !== body.confirmation.trim().toLowerCase()) {
    throw new HttpError(400, "La confirmacion no coincide con el nombre del gimnasio");
  }

  if (hashDeletionChallenge(body.challengeToken) !== gym.deletionChallengeHash) {
    throw new HttpError(401, "Token de confirmacion invalido");
  }

  const deletedAt = new Date();
  const recoverUntil = new Date(deletedAt);
  recoverUntil.setUTCDate(recoverUntil.getUTCDate() + 60);

  await prisma.$transaction([
    prisma.gym.update({
      where: { id: gymId },
      data: {
        deletedAt,
        recoverUntil,
        deletedByPlatformUserId: session.platformUserId,
        deletionPendingAt: null,
        deletionChallengeHash: null,
        deletionChallengeExpiresAt: null,
      },
    }),
    prisma.gymSubscription.updateMany({
      where: { gymId },
      data: {
        status: GymSubscriptionStatus.cancelled,
        updatedBy: session.platformUserId,
      },
    }),
    prisma.user.updateMany({
      where: { gymId },
      data: { isActive: false },
    }),
    prisma.gymSubscriptionAudit.create({
      data: {
        gymId,
        action: "company.deleted",
        reason: "Soft delete with 60-day recovery",
        createdBy: session.platformUserId,
      },
    }),
  ]);

  res.json({
    message: "Empresa eliminada. Puedes recuperarla durante 60 dias.",
    deletedAt: deletedAt.toISOString(),
    recoverUntil: recoverUntil.toISOString(),
  });
};

export const requestHardDelete = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const { gymId } = req.params as { gymId: string };
  const body = req.body as DeleteCompanyRequestInput;

  await verifyPlatformPassword(session.platformUserId, body.platformPassword);

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }
  if (!gym.deletedAt) {
    throw new HttpError(409, "La empresa debe estar en estado eliminado antes de proceder con la eliminación definitiva");
  }

  const challengeToken = generateDeletionChallengeToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15);

  await prisma.gym.update({
    where: { id: gymId },
    data: {
      deletionPendingAt: new Date(),
      deletionChallengeHash: hashDeletionChallenge(challengeToken),
      deletionChallengeExpiresAt: expiresAt,
      deletionRequestedByPlatformUserId: session.platformUserId,
    },
  });

  res.json({
    message: "Paso 1 completado. Confirma la eliminación definitiva con el token y el nombre de la empresa.",
    challengeToken,
    expiresAt: expiresAt.toISOString(),
    confirmationHint: gym.name,
  });
};

export const confirmHardDelete = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const { gymId } = req.params as { gymId: string };
  const body = req.body as DeleteCompanyConfirmInput;

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      deletionChallengeHash: true,
      deletionChallengeExpiresAt: true,
    },
  });
  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }
  if (!gym.deletedAt) {
    throw new HttpError(409, "La empresa debe estar en estado eliminado antes de proceder con la eliminación definitiva");
  }

  if (!gym.deletionChallengeHash || !gym.deletionChallengeExpiresAt) {
    throw new HttpError(400, "Primero debes solicitar la eliminación definitiva (paso 1)");
  }
  if (gym.deletionChallengeExpiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "El token de eliminación expiró. Solicita uno nuevo.");
  }
  if (gym.name.trim().toLowerCase() !== body.confirmation.trim().toLowerCase()) {
    throw new HttpError(400, "La confirmación no coincide con el nombre del gimnasio");
  }
  if (hashDeletionChallenge(body.challengeToken) !== gym.deletionChallengeHash) {
    throw new HttpError(401, "Token de confirmación inválido");
  }

  await prisma.$transaction(async (tx) => {
    const gymUsers = await tx.user.findMany({
      where: { gymId },
      select: { id: true },
    });
    const userIds = gymUsers.map((u) => u.id);

    // Delete user-level records that don't cascade automatically in DB
    if (userIds.length > 0) {
      await tx.userPermissionGrant.deleteMany({ where: { userId: { in: userIds } } });
      await tx.userHealthConnection.deleteMany({ where: { userId: { in: userIds } } });
      await tx.aIChatLog.deleteMany({ where: { userId: { in: userIds } } });
    }

    // Delete all gym-scoped records (gymId FK — no DB cascade from gyms)
    await tx.gymSubscriptionAudit.deleteMany({ where: { gymId } });
    await tx.gymSubscription.deleteMany({ where: { gymId } });
    await tx.membershipTransaction.deleteMany({ where: { gymId } });
    await tx.membershipDailySummaryDispatch.deleteMany({ where: { gymId } });
    await tx.gymScheduleTemplate.deleteMany({ where: { gymId } });
    await tx.gymScheduleException.deleteMany({ where: { gymId } });
    await tx.trainerPresenceSession.deleteMany({ where: { gymId } });
    await tx.membershipReportExport.deleteMany({ where: { gymId } });
    await tx.pushToken.deleteMany({ where: { gymId } });
    await tx.generalNotification.deleteMany({ where: { gymId } });
    await tx.messageThread.deleteMany({ where: { gymId } }); // direct_messages cascade from thread
    await tx.emergencyTicket.deleteMany({ where: { gymId } });
    await tx.auditLog.deleteMany({ where: { gymId } });
    await tx.assistanceRequest.deleteMany({ where: { gymId } });
    await tx.trainerAssignedRoutine.deleteMany({ where: { gymId } }); // assigned exercises cascade
    await tx.trainerRoutineTemplate.deleteMany({ where: { gymId } }); // template exercises cascade

    // Delete the gym — cascades users → user_profiles, measurements
    await tx.gym.delete({ where: { id: gymId } });
  });

  res.json({
    message: "Empresa eliminada definitivamente. Esta acción es irreversible.",
    gymId,
    gymName: gym.name,
    deletedAt: new Date().toISOString(),
  });
};

export const recoverCompany = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const { gymId } = req.params as { gymId: string };
  const body = req.body as RecoverCompanyInput;

  await verifyPlatformPassword(session.platformUserId, body.platformPassword);

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, deletedAt: true, recoverUntil: true },
  });
  if (!gym) {
    throw new HttpError(404, "Empresa no encontrada");
  }
  if (!gym.deletedAt || !gym.recoverUntil) {
    throw new HttpError(409, "La empresa no esta eliminada");
  }
  if (gym.recoverUntil.getTime() < Date.now()) {
    throw new HttpError(410, "La ventana de recuperacion de 60 dias ya expiro");
  }

  await prisma.$transaction([
    prisma.gym.update({
      where: { id: gymId },
      data: {
        deletedAt: null,
        recoverUntil: null,
        deletedByPlatformUserId: null,
        deletionPendingAt: null,
        deletionChallengeHash: null,
        deletionChallengeExpiresAt: null,
        deletionRequestedByPlatformUserId: null,
      },
    }),
    prisma.gymSubscription.updateMany({
      where: { gymId },
      data: {
        status: GymSubscriptionStatus.active,
        updatedBy: session.platformUserId,
      },
    }),
    prisma.gymSubscriptionAudit.create({
      data: {
        gymId,
        action: "company.recovered",
        reason: "Recovered during 60-day window",
        createdBy: session.platformUserId,
      },
    }),
  ]);

  res.json({
    message: "Empresa recuperada correctamente",
    gymId,
  });
};

// ── Gym Lock / Unlock ──────────────────────────────────────────────────

export const lockCompany = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const { gymId } = req.params as { gymId: string };
  const { locked } = req.body as { locked: boolean };

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { id: true, deletedAt: true },
  });
  if (!gym || gym.deletedAt) {
    throw new HttpError(404, "Empresa no encontrada");
  }

  const lockedAt = locked ? new Date() : null;

  await prisma.$transaction([
    prisma.gym.update({ where: { id: gymId }, data: { lockedAt } }),
    prisma.gymSubscriptionAudit.create({
      data: {
        gymId,
        action: locked ? "company.locked" : "company.unlocked",
        reason: locked ? "Acceso bloqueado por plataforma" : "Acceso desbloqueado por plataforma",
        createdBy: session.platformUserId,
      },
    }),
  ]);

  res.json({
    message: locked ? "Gimnasio bloqueado correctamente" : "Gimnasio desbloqueado correctamente",
    gymId,
    lockedAt: lockedAt ? lockedAt.toISOString() : null,
  });
};

// ── Admin Deactivate ───────────────────────────────────────────────────

export const deactivateCompanyAdmin = async (req: Request, res: Response): Promise<void> => {
  requirePlatformSession(req);
  const { gymId, adminId } = req.params as { gymId: string; adminId: string };

  const user = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, gymId: true, role: true, isActive: true },
  });

  if (!user || user.gymId !== gymId) {
    throw new HttpError(404, "Administrador no encontrado en esta empresa");
  }
  if (user.role !== UserRole.admin) {
    throw new HttpError(400, "El usuario no es administrador");
  }
  if (!user.isActive) {
    throw new HttpError(409, "El administrador ya esta desactivado");
  }

  // Block if this would leave 0 active admins
  const activeAdminCount = await prisma.user.count({
    where: { gymId, role: UserRole.admin, isActive: true },
  });
  if (activeAdminCount <= 1) {
    throw new HttpError(
      409,
      "No puedes desactivar al unico administrador activo del gimnasio",
    );
  }

  await prisma.user.update({ where: { id: adminId }, data: { isActive: false } });

  res.json({ message: "Administrador desactivado correctamente", userId: adminId });
};

// ── Admin Hard Delete ──────────────────────────────────────────────────

export const deleteCompanyAdmin = async (req: Request, res: Response): Promise<void> => {
  const session = requirePlatformSession(req);
  const { gymId, adminId } = req.params as { gymId: string; adminId: string };
  const { platformPassword } = req.body as { platformPassword: string };

  await verifyPlatformPassword(session.platformUserId, platformPassword);

  const user = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, gymId: true, role: true, globalUserId: true },
  });

  if (!user || user.gymId !== gymId) {
    throw new HttpError(404, "Administrador no encontrado en esta empresa");
  }
  if (user.role !== UserRole.admin) {
    throw new HttpError(400, "El usuario no es administrador");
  }

  // Block if this is the only admin (active or not)
  const totalAdminCount = await prisma.user.count({
    where: { gymId, role: UserRole.admin },
  });
  if (totalAdminCount <= 1) {
    throw new HttpError(
      409,
      "No puedes eliminar al unico administrador del gimnasio",
    );
  }

  // Check if GlobalUserAccount has other memberships
  const otherMemberships = await prisma.user.count({
    where: { globalUserId: user.globalUserId, id: { not: adminId } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id: adminId } });
    if (otherMemberships === 0) {
      await tx.globalUserAccount.delete({ where: { id: user.globalUserId } });
    }
  });

  res.json({ message: "Administrador eliminado correctamente", userId: adminId });
};
