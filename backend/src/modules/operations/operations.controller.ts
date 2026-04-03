import { AuditAction, MembershipTransactionType, PaymentMethod, UserRole } from "@prisma/client";
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