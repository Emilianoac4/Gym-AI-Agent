import { MembershipTransactionType, PaymentMethod, UserRole } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import {
  ExportMembershipReportInput,
  MembershipReportQueryInput,
  UpdateTrainerPresenceInput,
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

const requireAuth = (req: Request<any, any, any, any>) => {
  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  return req.auth;
};

const requireGymUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, gymId: true, role: true, isActive: true, fullName: true },
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

const buildMembershipReport = async (gymId: string, days: number) => {
  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - (days - 1));

  const rows = await prisma.membershipTransaction.findMany({
    where: {
      gymId,
      createdAt: { gte: rangeStart },
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
    { rowCount: 0, totalAmount: 0, totalRegistrations: 0, totalRenewals: 0 },
  );

  const csvLines = [
    [
      "Fecha",
      "Tipo de movimiento",
      "Usuario",
      "Metodo de pago",
      "Registrado por",
      "Monto",
    ].join(","),
    ...normalizedRows.map((row) =>
      [
        row.date,
        row.typeLabel,
        row.memberName,
        row.paymentMethodLabel,
        row.actorName,
        row.amount.toFixed(2),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];

  return {
    periodDays: days,
    generatedAt: new Date().toISOString(),
    summary,
    rows: normalizedRows,
    csv: csvLines.join("\n"),
  };
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
  const report = await buildMembershipReport(actor.gymId, days);
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
  const report = await buildMembershipReport(actor.gymId, body.days);
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