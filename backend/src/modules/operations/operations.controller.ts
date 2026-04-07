import { AssistanceRequestStatus, AuditAction, MembershipTransactionType, PaymentMethod, UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { createAuditLog } from "../../utils/audit";
import { sendPlatformEmail } from "../../utils/email-auth";
import {
  ExportMembershipReportInput,
  MembershipReportQueryInput,
  SendMembershipReportInput,
  UpdateTrainerPresenceInput,
  GymCurrencyInput,
} from "./operations.validation";

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  card: "Tarjeta",
  transfer: "Transferencia",
  cash: "Efectivo",
};

const TRANSACTION_TYPE_LABEL: Record<MembershipTransactionType, string> = {
  activation: "Registro",
  renewal: "Renovacion",
};

type GymCurrency = "USD" | "CRC";

const normalizeCurrency = (value: string | null | undefined): GymCurrency =>
  value === "CRC" ? "CRC" : "USD";

const getCurrencySymbol = (currency: GymCurrency): string =>
  currency === "CRC" ? "CRC " : "$";

const requireAuth = (req: Request<any, any, any, any>) => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  return req.auth;
};

const requireGymUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, gymId: true, role: true, isActive: true, fullName: true, email: true },
  });

  if (!user || !user.isActive) {
    throw new HttpError(401, "Unauthorized");
  }

  return user;
};

const getTrainerPresenceStatusPayload = async (gymId: string, trainerUserId: string) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [activeSession, todaySessions] = await Promise.all([
    prisma.trainerPresenceSession.findFirst({
      where: { trainerUserId, gymId, endedAt: null },
      orderBy: { startedAt: "desc" },
    }),
    prisma.trainerPresenceSession.findMany({
      where: {
        trainerUserId,
        gymId,
        startedAt: { gte: todayStart },
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return {
    isActive: Boolean(activeSession),
    activeSession: activeSession
      ? {
          id: activeSession.id,
          startedAt: activeSession.startedAt.toISOString(),
          endedAt: null,
        }
      : null,
    sessionsToday: todaySessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      isActive: session.endedAt === null,
      durationMinutes: session.endedAt
        ? Math.max(1, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000))
        : Math.max(1, Math.round((Date.now() - session.startedAt.getTime()) / 60000)),
    })),
  };
};

export const getMyTrainerPresenceStatus = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.trainer) {
    throw new HttpError(403, "Solo los entrenadores pueden gestionar su estado operativo");
  }

  const status = await getTrainerPresenceStatusPayload(actor.gymId, actor.id);
  res.json({ status });
};

export const updateMyTrainerPresenceStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.trainer) {
    throw new HttpError(403, "Solo los entrenadores pueden gestionar su estado operativo");
  }

  const openSession = await prisma.trainerPresenceSession.findFirst({
    where: { trainerUserId: actor.id, gymId: actor.gymId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  const body = req.body as UpdateTrainerPresenceInput;

  if (body.isActive) {
    if (!openSession) {
      await prisma.trainerPresenceSession.create({
        data: {
          gymId: actor.gymId,
          trainerUserId: actor.id,
        },
      });
    }
  } else if (openSession) {
    await prisma.trainerPresenceSession.update({
      where: { id: openSession.id },
      data: { endedAt: new Date() },
    });
  }

  await createAuditLog({
    gymId: actor.gymId,
    actorUserId: actor.id,
    action: AuditAction.trainer_status_changed,
    resourceType: "trainer_presence",
    resourceId: actor.id,
    changes: {
      isActive: body.isActive,
      hadOpenSession: Boolean(openSession),
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] as string,
  });

  const status = await getTrainerPresenceStatusPayload(actor.gymId, actor.id);
  res.json({ message: "Estado operativo actualizado", status });
};

export const getTrainerPresenceSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) {
    throw new HttpError(403, "Solo el administrador puede ver la presencia de entrenadores");
  }

  const query = req.query as unknown as MembershipReportQueryInput;
  const days = Number(query.days ?? 7);
  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));

  const [trainers, sessions] = await Promise.all([
    prisma.user.findMany({
      where: { gymId: actor.gymId, role: UserRole.trainer, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.trainerPresenceSession.findMany({
      where: {
        gymId: actor.gymId,
        OR: [
          { startedAt: { gte: rangeStart } },
          { endedAt: { gte: rangeStart } },
          { endedAt: null },
        ],
      },
      orderBy: [{ startedAt: "asc" }],
    }),
  ]);

  const trainerMap = new Map(trainers.map((trainer) => [trainer.id, trainer.fullName]));
  const dayMap = new Map<string, Array<{
    trainerId: string;
    trainerName: string;
    sessions: Array<{
      id: string;
      startedAt: string;
      endedAt: string | null;
      isActive: boolean;
      startHour: number;
      endHour: number;
    }>;
  }>>();

  for (let index = 0; index < days; index += 1) {
    const day = new Date(rangeStart);
    day.setDate(rangeStart.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    dayMap.set(key, []);
  }

  for (const session of sessions) {
    const key = session.startedAt.toISOString().slice(0, 10);
    if (!dayMap.has(key)) {
      continue;
    }

    const trainerName = trainerMap.get(session.trainerUserId) ?? "Entrenador";
    const current = dayMap.get(key) ?? [];
    let entry = current.find((item) => item.trainerId === session.trainerUserId);
    if (!entry) {
      entry = { trainerId: session.trainerUserId, trainerName, sessions: [] };
      current.push(entry);
      dayMap.set(key, current);
    }

    const endDate = session.endedAt ?? new Date();
    entry.sessions.push({
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      isActive: session.endedAt === null,
      startHour:
        session.startedAt.getHours() + session.startedAt.getMinutes() / 60,
      endHour: endDate.getHours() + endDate.getMinutes() / 60,
    });
  }

  const summary = Array.from(dayMap.entries()).map(([date, trainersForDay]) => ({
    date,
    activeCount: trainersForDay.filter((trainer) => trainer.sessions.some((session) => session.isActive)).length,
    trainers: trainersForDay,
  }));

  res.json({
    days: summary,
    generatedAt: new Date().toISOString(),
  });
};

// Lightweight endpoint usable by any gym member to see which trainers are active right now
export const getActiveTrainers = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  const activeSessions = await prisma.trainerPresenceSession.findMany({
    where: { gymId: actor.gymId, endedAt: null },
    select: { trainerUserId: true },
  });

  const activeIds = [...new Set(activeSessions.map((s) => s.trainerUserId))];

  const trainers = activeIds.length === 0
    ? []
    : await prisma.user.findMany({
        where: { id: { in: activeIds }, role: UserRole.trainer, isActive: true },
        select: { id: true, fullName: true, profile: { select: { avatarUrl: true } } },
        orderBy: { fullName: "asc" },
      });

  res.json({ trainers: trainers.map((t) => ({ id: t.id, fullName: t.fullName, avatarUrl: t.profile?.avatarUrl ?? null })) });
};

const buildMembershipReport = async (
  gymId: string,
  days: number,
  specificDate?: string,
) => {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { currency: true },
  });

  if (!gym) {
    throw new HttpError(404, "Gimnasio no encontrado");
  }

  const reportCurrency = normalizeCurrency(gym.currency);

  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));

  let createdAtFilter: { gte: Date; lt?: Date } = { gte: rangeStart };
  let reportLabel = `${days} dias`;
  if (specificDate) {
    const dayStart = new Date(`${specificDate}T00:00:00.000Z`);
    if (Number.isNaN(dayStart.getTime())) {
      throw new HttpError(400, "Fecha invalida para el reporte");
    }

    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    createdAtFilter = { gte: dayStart, lt: dayEnd };
    reportLabel = specificDate;
  }

  const rows = await prisma.membershipTransaction.findMany({
    where: {
      gymId,
      createdAt: createdAtFilter,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      type: true,
      userId: true,
      actorUserId: true,
      paymentMethod: true,
      amount: true,
      currency: true,
    },
  });

  const userIds = Array.from(new Set(rows.flatMap((row) => [row.userId, row.actorUserId])));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user.fullName]));

  const normalizedRows = rows.map((row) => ({
    id: row.id,
    date: row.createdAt.toISOString(),
    type: row.type,
    typeLabel: TRANSACTION_TYPE_LABEL[row.type],
    memberName: userMap.get(row.userId) ?? "Usuario",
    paymentMethod: row.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABEL[row.paymentMethod],
    actorName: userMap.get(row.actorUserId) ?? "Sistema",
    amount: row.amount,
    currency: normalizeCurrency(row.currency ?? reportCurrency),
  }));

  const summary = normalizedRows.reduce(
    (acc, row) => {
      acc.rowCount += 1;
      acc.totalAmount += row.amount;
      if (row.type === MembershipTransactionType.activation) {
        acc.totalRegistrations += 1;
      } else {
        acc.totalRenewals += 1;
      }
      return acc;
    },
    {
      rowCount: 0,
      totalAmount: 0,
      totalRegistrations: 0,
      totalRenewals: 0,
      currency: reportCurrency,
    },
  );

  const csvLines = [
    [
      "Fecha",
      "Tipo de movimiento",
      "Usuario",
      "Metodo de pago",
      "Registrado por",
      "Moneda",
      "Monto",
    ].join(","),
    ...normalizedRows.map((row) =>
      [
        row.date,
        row.typeLabel,
        row.memberName,
        row.paymentMethodLabel,
        row.actorName,
        row.currency,
        row.amount.toFixed(2),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];

  return {
    periodDays: days,
    reportLabel,
    specificDate: specificDate ?? null,
    currency: reportCurrency,
    generatedAt: new Date().toISOString(),
    summary,
    rows: normalizedRows,
    csv: csvLines.join("\n"),
  };
};

const buildMembershipReportEmail = (report: Awaited<ReturnType<typeof buildMembershipReport>>) => {
  const moneySymbol = getCurrencySymbol(report.currency);
  const rowsHtml = report.rows.length
    ? report.rows
        .map(
          (row) =>
            `<tr><td>${row.date}</td><td>${row.typeLabel}</td><td>${row.memberName}</td><td>${row.paymentMethodLabel}</td><td>${row.actorName}</td><td>${row.currency}</td><td>${moneySymbol}${row.amount.toFixed(2)}</td></tr>`,
        )
        .join("")
    : "<tr><td colspan=\"7\">Sin movimientos en el periodo seleccionado.</td></tr>";

  const html = `
    <h2>Reporte de registros y renovaciones</h2>
    <p>Periodo: ${report.periodDays} dias</p>
    <p>Total movimientos: ${report.summary.rowCount}</p>
    <p>Total registros: ${report.summary.totalRegistrations}</p>
    <p>Total renovaciones: ${report.summary.totalRenewals}</p>
    <p>Moneda: ${report.currency}</p>
    <p>Monto total: ${moneySymbol}${report.summary.totalAmount.toFixed(2)}</p>
    <table border="1" cellspacing="0" cellpadding="6">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Usuario</th>
          <th>Metodo de pago</th>
          <th>Registrado por</th>
          <th>Moneda</th>
          <th>Monto</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p>CSV:</p>
    <pre>${report.csv.replace(/</g, "&lt;")}</pre>
  `;

  const text = [
    "Reporte de registros y renovaciones",
    `Periodo: ${report.periodDays} dias`,
    `Movimientos: ${report.summary.rowCount}`,
    `Registros: ${report.summary.totalRegistrations}`,
    `Renovaciones: ${report.summary.totalRenewals}`,
    `Moneda: ${report.currency}`,
    `Monto total: ${moneySymbol}${report.summary.totalAmount.toFixed(2)}`,
    "",
    report.csv,
  ].join("\n");

  return { html, text };
};

export const getMembershipReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) {
    throw new HttpError(403, "Solo el administrador puede ver reportes");
  }

  const query = req.query as unknown as MembershipReportQueryInput;
  const days = Number(query.days ?? 7);
  const report = await buildMembershipReport(actor.gymId, days, query.specificDate);
  res.json({ report });
};

export const exportMembershipReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) {
    throw new HttpError(403, "Solo el administrador puede exportar reportes");
  }

  const body = req.body as ExportMembershipReportInput;
  const report = await buildMembershipReport(actor.gymId, body.days, body.specificDate);
  const exportRecord = await prisma.membershipReportExport.create({
    data: {
      gymId: actor.gymId,
      generatedByUserId: actor.id,
      periodDays: body.days,
      rowCount: report.summary.rowCount,
      csvContent: report.csv,
    },
  });

  res.json({
    message: "Reporte generado correctamente",
    report,
    export: {
      id: exportRecord.id,
      createdAt: exportRecord.createdAt.toISOString(),
      fileName: `reporte-registros-renovaciones-${body.days}d-${exportRecord.createdAt
        .toISOString()
        .slice(0, 10)}.csv`,
    },
  });
};

export const sendMembershipReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) {
    throw new HttpError(403, "Solo el administrador puede enviar reportes");
  }

  const body = req.body as SendMembershipReportInput;
  const targetEmail = body.delivery === "linked" ? actor.email : body.email;
  if (!targetEmail) {
    throw new HttpError(400, "No se encontro correo vinculado para este perfil");
  }

  const report = await buildMembershipReport(actor.gymId, body.days, body.specificDate);
  const emailContent = buildMembershipReportEmail(report);

  await sendPlatformEmail({
    to: targetEmail,
    subject: `Reporte de registros y renovaciones (${body.days} dias)`,
    html: emailContent.html,
    text: emailContent.text,
  });

  await prisma.membershipReportExport.create({
    data: {
      gymId: actor.gymId,
      generatedByUserId: actor.id,
      periodDays: body.days,
      rowCount: report.summary.rowCount,
      csvContent: report.csv,
    },
  });

  res.json({
    message: `Reporte enviado correctamente a ${targetEmail}`,
    report,
    recipient: targetEmail,
  });
};

export const getGymSettings = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  const gym = await prisma.gym.findUnique({
    where: { id: actor.gymId },
    select: { id: true, currency: true },
  });

  if (!gym) {
    throw new HttpError(404, "Gimnasio no encontrado");
  }

  res.json({ settings: { currency: gym.currency === "CRC" ? "CRC" : "USD" } });
};

export const updateGymSettings = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) {
    throw new HttpError(403, "Solo el administrador puede modificar configuraciones");
  }

  const body = req.body as GymCurrencyInput;

  const gym = await prisma.gym.update({
    where: { id: actor.gymId },
    data: { currency: body.currency },
    select: { currency: true },
  });

  res.json({ message: "Configuracion actualizada", settings: { currency: gym.currency } });
};

export const getKpi = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) throw new HttpError(403, "Solo el administrador puede ver los KPIs");

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(todayStart.getUTCDate() - 6);

  const [
    totalActiveMembers,
    membersWithActiveMembership,
    newUsersToday,
    activeTrainersNow,
    transactionsToday,
    transactionsWeek,
  ] = await Promise.all([
    prisma.user.count({
      where: { gymId: actor.gymId, isActive: true, role: "member" },
    }),
    prisma.user.count({
      where: { gymId: actor.gymId, isActive: true, role: "member", membershipEndAt: { gt: now } },
    }),
    prisma.user.count({
      where: { gymId: actor.gymId, isActive: true, createdAt: { gte: todayStart } },
    }),
    prisma.trainerPresenceSession.count({
      where: { gymId: actor.gymId, endedAt: null },
    }),
    prisma.membershipTransaction.findMany({
      where: {
        gymId: actor.gymId,
        createdAt: { gte: todayStart },
      },
      select: { type: true, amount: true, currency: true },
    }),
    prisma.membershipTransaction.findMany({
      where: {
        gymId: actor.gymId,
        createdAt: { gte: weekStart },
      },
      select: { type: true, amount: true, currency: true },
    }),
  ]);

  const gym = await prisma.gym.findUnique({
    where: { id: actor.gymId },
    select: { currency: true },
  });
  const reportCurrency = normalizeCurrency(gym?.currency);

  const sumAmount = (rows: { amount: number | null; currency: string | null }[]) =>
    rows.reduce((acc, r) => acc + (r.amount ?? 0), 0);

  res.json({
    kpi: {
      totalActiveMembers,
      membersWithActiveMembership,
      newUsersToday,
      activeTrainersNow,
      today: {
        registrations: transactionsToday.filter((t) => t.type === "activation").length,
        renewals: transactionsToday.filter((t) => t.type === "renewal").length,
        revenue: sumAmount(transactionsToday),
      },
      week: {
        registrations: transactionsWeek.filter((t) => t.type === "activation").length,
        renewals: transactionsWeek.filter((t) => t.type === "renewal").length,
        revenue: sumAmount(transactionsWeek),
      },
      currency: reportCurrency,
    },
  });
};

export const getChurnRisk = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) throw new HttpError(403, "Solo el administrador puede ver alertas de abandono");

  const CHURN_DAYS = 6;
  const now = new Date();
  const cutoff = new Date(now.getTime() - CHURN_DAYS * 24 * 60 * 60 * 1000);

  // Active members with valid membership
  const activeMembers = await prisma.user.findMany({
    where: {
      gymId: actor.gymId,
      isActive: true,
      role: "member",
      membershipEndAt: { gt: now },
    },
    select: { id: true, fullName: true, membershipEndAt: true },
  });

  if (activeMembers.length === 0) {
    res.json({ churnRisk: [] });
    return;
  }

  // Last activity per member from ai_chat_logs
  const memberIds = activeMembers.map((m) => m.id);
  const lastLogs = await prisma.aIChatLog.groupBy({
    by: ["userId"],
    where: { userId: { in: memberIds } },
    _max: { createdAt: true },
  });

  const lastActivityMap = new Map(
    lastLogs.map((row) => [row.userId, row._max.createdAt]),
  );

  const churnRisk = activeMembers
    .map((member) => {
      const lastActivity = lastActivityMap.get(member.id) ?? null;
      const daysSince = lastActivity
        ? Math.floor((now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      return { userId: member.id, fullName: member.fullName, lastActivity, daysSince };
    })
    .filter((m) => m.lastActivity === null || (m.daysSince !== null && m.daysSince >= CHURN_DAYS))
    .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));

  res.json({ churnRisk });
};

// ─── Admin Dashboard Summary ─────────────────────────────────────────────────

/** Costa Rica is permanently UTC-6 (no DST). */
const CR_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Returns the UTC Date representing 00:00:00 Costa Rica time for the given date. */
function getCrDayStart(date: Date): Date {
  const crMs = date.getTime() - CR_OFFSET_MS;
  const crDay = new Date(crMs);
  crDay.setUTCHours(0, 0, 0, 0);
  return new Date(crDay.getTime() + CR_OFFSET_MS);
}

/** In-memory cache keyed by gymId (TTL = 30 s). */
type DashboardCacheEntry = { data: AdminDashboardSummaryPayload; expiresAt: number };
const dashboardCache = new Map<string, DashboardCacheEntry>();
const DASHBOARD_CACHE_TTL_MS = 30_000;

type DashKpiCard<T> = T & { status: "ok" | "error"; errorMessage?: string };
type DashTrend = { direction: "up" | "down" | "stable"; previousValue: number };

interface AdminDashboardSummaryPayload {
  v: 1;
  generatedAt: string;
  timezone: "America/Costa_Rica";
  cards: {
    trainersActiveNow: DashKpiCard<{ value: number }>;
    usersActiveToday: DashKpiCard<{ value: number; trend: DashTrend }>;
    subscriptionsActive: DashKpiCard<{ value: number; trend: DashTrend }>;
    subscriptionsExpired: DashKpiCard<{
      count: number;
      top10: Array<{ userId: string; fullName: string; membershipEndAt: string }>;
    }>;
    assistancePending: DashKpiCard<{
      total: number;
      byStatus: { CREATED: number; ASSIGNED: number; IN_PROGRESS: number };
    }>;
    unreadThreadsForAdmin: DashKpiCard<{ value: number }>;
    renewalsToday: DashKpiCard<{ count: number; amount: number; trend: DashTrend; currency: string }>;
    incomesToday: DashKpiCard<{ value: number; trend: DashTrend; currency: string }>;
    churnRisk: DashKpiCard<{ count: number; trend: DashTrend }>;
  };
  alerts: Array<{ type: string; message: string; severity: "info" | "warning" | "critical" }>;
  errors: Record<string, string>;
}

function buildDashTrend(current: number, previous: number): DashTrend {
  if (current > previous) return { direction: "up", previousValue: previous };
  if (current < previous) return { direction: "down", previousValue: previous };
  return { direction: "stable", previousValue: previous };
}

function errDashCard<T extends object>(base: T): DashKpiCard<T> {
  return { ...base, status: "error" };
}

async function buildAdminDashboardPayload(
  gymId: string,
  adminUserId: string,
): Promise<AdminDashboardSummaryPayload> {
  const now = new Date();
  const todayStart = getCrDayStart(now);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const CHURN_THRESHOLD_DAYS = 6;

  const memberRows = await prisma.user.findMany({
    where: { gymId, isActive: true, role: UserRole.member },
    select: { id: true },
  });
  const memberIds = memberRows.map((m) => m.id);

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { currency: true } });
  const reportCurrency = normalizeCurrency(gym?.currency);
  const errors: Record<string, string> = {};

  const [
    trainersActiveNowResult,
    chatActiveToday,
    routineActiveToday,
    assistanceActiveToday,
    chatActiveYesterday,
    routineActiveYesterday,
    assistanceActiveYesterday,
    subsActiveNow,
    subsActiveYesterday,
    subsExpired,
    assistanceCREATED,
    assistanceASSIGNED,
    assistanceIN_PROGRESS,
    unreadThreadCount,
    txToday,
    txYesterday,
    chatLastActivity,
  ] = await Promise.all([
    prisma.trainerPresenceSession
      .count({ where: { gymId, endedAt: null } })
      .catch(() => null as null),

    memberIds.length === 0
      ? Promise.resolve([] as string[])
      : prisma.aIChatLog
          .findMany({
            where: { userId: { in: memberIds }, createdAt: { gte: todayStart } },
            select: { userId: true },
            distinct: ["userId"],
          })
          .then((rows) => rows.map((r) => r.userId))
          .catch(() => [] as string[]),

    memberIds.length === 0
      ? Promise.resolve([] as string[])
      : prisma.routineExerciseLog
          .findMany({
            where: { userId: { in: memberIds }, performedAt: { gte: todayStart } },
            select: { userId: true },
            distinct: ["userId"],
          })
          .then((rows) => rows.map((r) => r.userId))
          .catch(() => [] as string[]),

    prisma.assistanceRequest
      .findMany({
        where: { gymId, createdAt: { gte: todayStart } },
        select: { memberId: true },
        distinct: ["memberId"],
      })
      .then((rows) => rows.map((r) => r.memberId))
      .catch(() => [] as string[]),

    memberIds.length === 0
      ? Promise.resolve([] as string[])
      : prisma.aIChatLog
          .findMany({
            where: { userId: { in: memberIds }, createdAt: { gte: yesterdayStart, lt: todayStart } },
            select: { userId: true },
            distinct: ["userId"],
          })
          .then((rows) => rows.map((r) => r.userId))
          .catch(() => [] as string[]),

    memberIds.length === 0
      ? Promise.resolve([] as string[])
      : prisma.routineExerciseLog
          .findMany({
            where: { userId: { in: memberIds }, performedAt: { gte: yesterdayStart, lt: todayStart } },
            select: { userId: true },
            distinct: ["userId"],
          })
          .then((rows) => rows.map((r) => r.userId))
          .catch(() => [] as string[]),

    prisma.assistanceRequest
      .findMany({
        where: { gymId, createdAt: { gte: yesterdayStart, lt: todayStart } },
        select: { memberId: true },
        distinct: ["memberId"],
      })
      .then((rows) => rows.map((r) => r.memberId))
      .catch(() => [] as string[]),

    prisma.user
      .count({ where: { gymId, isActive: true, role: UserRole.member, membershipEndAt: { gt: now } } })
      .catch(() => null as null),

    prisma.user
      .count({ where: { gymId, isActive: true, role: UserRole.member, membershipEndAt: { gt: yesterdayStart } } })
      .catch(() => null as null),

    prisma.user
      .findMany({
        where: { gymId, isActive: true, role: UserRole.member, membershipEndAt: { not: null, lte: now } },
        select: { id: true, fullName: true, membershipEndAt: true },
        orderBy: { membershipEndAt: "asc" },
        take: 10,
      })
      .catch(() => null as null),

    prisma.assistanceRequest
      .count({ where: { gymId, status: AssistanceRequestStatus.CREATED } })
      .catch(() => null as null),

    prisma.assistanceRequest
      .count({ where: { gymId, status: AssistanceRequestStatus.ASSIGNED } })
      .catch(() => null as null),

    prisma.assistanceRequest
      .count({ where: { gymId, status: AssistanceRequestStatus.IN_PROGRESS } })
      .catch(() => null as null),

    prisma.messageThread
      .count({
        where: {
          gymId,
          adminUserId,
          expiresAt: { gt: now },
          messages: { some: { senderUserId: { not: adminUserId }, readAt: null } },
        },
      })
      .catch(() => null as null),

    prisma.membershipTransaction
      .findMany({
        where: { gymId, createdAt: { gte: todayStart } },
        select: { type: true, amount: true },
      })
      .catch(() => null as null),

    prisma.membershipTransaction
      .findMany({
        where: { gymId, createdAt: { gte: yesterdayStart, lt: todayStart } },
        select: { type: true, amount: true },
      })
      .catch(() => null as null),

    memberIds.length === 0
      ? Promise.resolve([] as Array<{ userId: string; _max: { createdAt: Date | null } }>)
      : prisma.aIChatLog
          .groupBy({
            by: ["userId"],
            where: { userId: { in: memberIds } },
            _max: { createdAt: true },
          })
          .catch(() => [] as Array<{ userId: string; _max: { createdAt: Date | null } }>),
  ]);

  // trainersActiveNow
  let trainersCard: AdminDashboardSummaryPayload["cards"]["trainersActiveNow"];
  if (trainersActiveNowResult === null) {
    errors["trainersActiveNow"] = "No se pudo obtener conteo de entrenadores activos";
    trainersCard = errDashCard({ value: 0 });
  } else {
    trainersCard = { value: trainersActiveNowResult, status: "ok" };
  }

  // usersActiveToday
  const activeTodaySet = new Set([...chatActiveToday, ...routineActiveToday, ...assistanceActiveToday]);
  const activeYesterdaySet = new Set([...chatActiveYesterday, ...routineActiveYesterday, ...assistanceActiveYesterday]);
  const usersActiveTodayCard: AdminDashboardSummaryPayload["cards"]["usersActiveToday"] = {
    value: activeTodaySet.size,
    trend: buildDashTrend(activeTodaySet.size, activeYesterdaySet.size),
    status: "ok",
  };

  // subscriptionsActive
  let subsActiveCard: AdminDashboardSummaryPayload["cards"]["subscriptionsActive"];
  if (subsActiveNow === null) {
    errors["subscriptionsActive"] = "No se pudo obtener suscripciones activas";
    subsActiveCard = errDashCard({ value: 0, trend: buildDashTrend(0, 0) });
  } else {
    subsActiveCard = {
      value: subsActiveNow,
      trend: buildDashTrend(subsActiveNow, subsActiveYesterday ?? subsActiveNow),
      status: "ok",
    };
  }

  // subscriptionsExpired
  let subsExpiredCard: AdminDashboardSummaryPayload["cards"]["subscriptionsExpired"];
  if (subsExpired === null) {
    errors["subscriptionsExpired"] = "No se pudo obtener membresías vencidas";
    subsExpiredCard = errDashCard({ count: 0, top10: [] });
  } else {
    subsExpiredCard = {
      count: subsExpired.length,
      top10: subsExpired.map((u) => ({
        userId: u.id,
        fullName: u.fullName,
        membershipEndAt: u.membershipEndAt!.toISOString(),
      })),
      status: "ok",
    };
  }

  // assistancePending
  let assistancePendingCard: AdminDashboardSummaryPayload["cards"]["assistancePending"];
  if (assistanceCREATED === null || assistanceASSIGNED === null || assistanceIN_PROGRESS === null) {
    errors["assistancePending"] = "No se pudo obtener solicitudes pendientes";
    assistancePendingCard = errDashCard({ total: 0, byStatus: { CREATED: 0, ASSIGNED: 0, IN_PROGRESS: 0 } });
  } else {
    const total = assistanceCREATED + assistanceASSIGNED + assistanceIN_PROGRESS;
    assistancePendingCard = {
      total,
      byStatus: { CREATED: assistanceCREATED, ASSIGNED: assistanceASSIGNED, IN_PROGRESS: assistanceIN_PROGRESS },
      status: "ok",
    };
  }

  // unreadThreadsForAdmin
  let unreadThreadsCard: AdminDashboardSummaryPayload["cards"]["unreadThreadsForAdmin"];
  if (unreadThreadCount === null) {
    errors["unreadThreadsForAdmin"] = "No se pudo obtener mensajes no leídos";
    unreadThreadsCard = errDashCard({ value: 0 });
  } else {
    unreadThreadsCard = { value: unreadThreadCount, status: "ok" };
  }

  // renewalsToday + incomesToday
  let renewalsTodayCard: AdminDashboardSummaryPayload["cards"]["renewalsToday"];
  let incomesTodayCard: AdminDashboardSummaryPayload["cards"]["incomesToday"];

  if (txToday === null) {
    errors["renewalsToday"] = "No se pudo obtener renovaciones del día";
    errors["incomesToday"] = "No se pudo obtener ingresos del día";
    renewalsTodayCard = errDashCard({ count: 0, amount: 0, trend: buildDashTrend(0, 0), currency: reportCurrency });
    incomesTodayCard = errDashCard({ value: 0, trend: buildDashTrend(0, 0), currency: reportCurrency });
  } else {
    const txYesterdaySafe = txYesterday ?? [];
    const renewalsCount = txToday.filter((t) => t.type === MembershipTransactionType.renewal).length;
    const renewalsAmount = txToday
      .filter((t) => t.type === MembershipTransactionType.renewal)
      .reduce((acc, t) => acc + t.amount, 0);
    const renewalsYesterdayCount = txYesterdaySafe.filter((t) => t.type === MembershipTransactionType.renewal).length;
    const incomeToday = txToday.reduce((acc, t) => acc + t.amount, 0);
    const incomeYesterday = txYesterdaySafe.reduce((acc, t) => acc + t.amount, 0);

    renewalsTodayCard = {
      count: renewalsCount,
      amount: renewalsAmount,
      trend: buildDashTrend(renewalsCount, renewalsYesterdayCount),
      currency: reportCurrency,
      status: "ok",
    };
    incomesTodayCard = {
      value: incomeToday,
      trend: buildDashTrend(incomeToday, incomeYesterday),
      currency: reportCurrency,
      status: "ok",
    };
  }

  // churnRisk
  const churnCutoffCurrent = new Date(now.getTime() - CHURN_THRESHOLD_DAYS * 86_400_000);
  const churnCutoffPrev30 = new Date(churnCutoffCurrent.getTime() - 30 * 86_400_000);
  const lastActivityMap2 = new Map(chatLastActivity.map((row) => [row.userId, row._max.createdAt]));
  const churnCurrentCount = memberIds.filter((id) => {
    const last = lastActivityMap2.get(id) ?? null;
    return last === null || last < churnCutoffCurrent;
  }).length;
  const churnPrev30Count = memberIds.filter((id) => {
    const last = lastActivityMap2.get(id) ?? null;
    return last === null || last < churnCutoffPrev30;
  }).length;
  const churnRiskCard: AdminDashboardSummaryPayload["cards"]["churnRisk"] = {
    count: churnCurrentCount,
    trend: buildDashTrend(churnCurrentCount, churnPrev30Count),
    status: "ok",
  };

  // alerts
  const alerts: AdminDashboardSummaryPayload["alerts"] = [];
  if (assistancePendingCard.status === "ok" && assistancePendingCard.byStatus.CREATED > 0) {
    alerts.push({
      type: "assistance_unassigned",
      message: `${assistancePendingCard.byStatus.CREATED} solicitud(es) de asistencia sin asignar`,
      severity: "warning",
    });
  }
  if (churnRiskCard.count > 0) {
    alerts.push({
      type: "churn_risk",
      message: `${churnRiskCard.count} usuario(s) en riesgo de abandono`,
      severity: churnRiskCard.count >= 5 ? "critical" : "warning",
    });
  }
  if (subsExpiredCard.status === "ok" && subsExpiredCard.count > 0) {
    alerts.push({
      type: "subscriptions_expired",
      message: `${subsExpiredCard.count} miembro(s) con membresía vencida`,
      severity: "info",
    });
  }

  return {
    v: 1,
    generatedAt: now.toISOString(),
    timezone: "America/Costa_Rica",
    cards: {
      trainersActiveNow: trainersCard,
      usersActiveToday: usersActiveTodayCard,
      subscriptionsActive: subsActiveCard,
      subscriptionsExpired: subsExpiredCard,
      assistancePending: assistancePendingCard,
      unreadThreadsForAdmin: unreadThreadsCard,
      renewalsToday: renewalsTodayCard,
      incomesToday: incomesTodayCard,
      churnRisk: churnRiskCard,
    },
    alerts,
    errors,
  };
}

export const getAdminDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  const auth = requireAuth(req);
  const actor = await requireGymUser(auth.userId);

  if (actor.role !== UserRole.admin) {
    throw new HttpError(403, "Forbidden: solo administradores pueden acceder al resumen del panel");
  }

  const targetGymId = actor.gymId;

  const cached = dashboardCache.get(targetGymId);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ summary: cached.data });
    return;
  }

  const data = await buildAdminDashboardPayload(targetGymId, actor.id);
  dashboardCache.set(targetGymId, { data, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });

  res.json({ summary: data });
};