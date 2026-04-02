import { PaymentMethod } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { sendPlatformEmail } from "../utils/email-auth";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  card: "Tarjeta",
  transfer: "Transferencia",
  cash: "Efectivo",
};

const dayBoundsUtc = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const buildSummaryEmail = (
  gymName: string,
  summaryDate: Date,
  rows: Array<{ type: string; paymentMethod: PaymentMethod; amount: number }>,
) => {
  const dateLabel = summaryDate.toISOString().slice(0, 10);
  const total = rows.reduce((acc, row) => acc + row.amount, 0);
  const activationCount = rows.filter((row) => row.type === "activation").length;
  const renewalCount = rows.filter((row) => row.type === "renewal").length;

  const grouped = rows.reduce<Record<string, number>>((acc, row) => {
    const label = METHOD_LABEL[row.paymentMethod];
    acc[label] = (acc[label] ?? 0) + row.amount;
    return acc;
  }, {});

  const groupedLines = Object.entries(grouped)
    .map(([method, amount]) => `<li><strong>${method}:</strong> ${amount.toFixed(2)}</li>`)
    .join("");

  const html = `
    <h2>Resumen diario de membresias - ${gymName}</h2>
    <p>Fecha: <strong>${dateLabel} (UTC)</strong></p>
    <ul>
      <li>Activaciones: <strong>${activationCount}</strong></li>
      <li>Renovaciones: <strong>${renewalCount}</strong></li>
      <li>Total transacciones: <strong>${rows.length}</strong></li>
      <li>Monto total: <strong>${total.toFixed(2)}</strong></li>
    </ul>
    <h3>Desglose por metodo de pago</h3>
    <ul>${groupedLines || "<li>Sin movimientos</li>"}</ul>
    <p>Generado automaticamente por Tuco.</p>
  `;

  const text = [
    `Resumen diario de membresias - ${gymName}`,
    `Fecha: ${dateLabel} (UTC)`,
    `Activaciones: ${activationCount}`,
    `Renovaciones: ${renewalCount}`,
    `Total transacciones: ${rows.length}`,
    `Monto total: ${total.toFixed(2)}`,
    "",
    "Desglose por metodo de pago:",
    ...Object.entries(grouped).map(([method, amount]) => `- ${method}: ${amount.toFixed(2)}`),
  ].join("\n");

  return { html, text };
};

const sendDailyMembershipSummary = async () => {
  const now = new Date();
  if (now.getUTCHours() < env.DAILY_MEMBERSHIP_SUMMARY_HOUR_UTC) {
    return;
  }

  const { start, end } = dayBoundsUtc(now);

  const alreadySent = await prisma.membershipDailySummaryDispatch.findMany({
    where: {
      summaryDay: start,
    },
    select: { gymId: true },
  });

  const sentGyms = new Set(alreadySent.map((row) => row.gymId));

  const gyms = await prisma.gym.findMany({
    select: { id: true, name: true },
  });

  for (const gym of gyms) {
    if (sentGyms.has(gym.id)) {
      continue;
    }

    const rows = await prisma.membershipTransaction.findMany({
      where: {
        gymId: gym.id,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        type: true,
        paymentMethod: true,
        amount: true,
      },
    });

    if (rows.length === 0) {
      await prisma.membershipDailySummaryDispatch.create({
        data: {
          gymId: gym.id,
          summaryDay: start,
        },
      });
      continue;
    }

    const admins = await prisma.user.findMany({
      where: {
        gymId: gym.id,
        role: "admin",
        isActive: true,
      },
      select: { email: true },
    });

    const recipients = admins.map((u) => u.email);
    if (recipients.length === 0) {
      continue;
    }

    const { html, text } = buildSummaryEmail(gym.name, start, rows);

    for (const to of recipients) {
      await sendPlatformEmail({
        to,
        subject: `Resumen diario de transacciones - ${gym.name}`,
        html,
        text,
      });
    }

    await prisma.membershipDailySummaryDispatch.create({
      data: {
        gymId: gym.id,
        summaryDay: start,
      },
    });
  }
};

export const forceSendDailyMembershipSummary = async (): Promise<{ gymsProcessed: number; gymsWithTransactions: number }> => {
  const now = new Date();
  const { start, end } = dayBoundsUtc(now);

  const gyms = await prisma.gym.findMany({
    select: { id: true, name: true },
  });

  let gymsWithTransactions = 0;

  for (const gym of gyms) {
    const rows = await prisma.membershipTransaction.findMany({
      where: {
        gymId: gym.id,
        createdAt: { gte: start, lt: end },
      },
      select: { type: true, paymentMethod: true, amount: true },
    });

    if (rows.length === 0) continue;

    gymsWithTransactions++;

    const admins = await prisma.user.findMany({
      where: { gymId: gym.id, role: "admin", isActive: true },
      select: { email: true },
    });

    const recipients = admins.map((u) => u.email);
    if (recipients.length === 0) continue;

    const { html, text } = buildSummaryEmail(gym.name, start, rows);

    for (const to of recipients) {
      await sendPlatformEmail({
        to,
        subject: `[TEST] Resumen diario de transacciones - ${gym.name}`,
        html,
        text,
      });
    }
  }

  return { gymsProcessed: gyms.length, gymsWithTransactions };
};

export const startDailyMembershipSummaryJob = () => {
  if (!env.DAILY_MEMBERSHIP_SUMMARY_ENABLED) {
    return;
  }

  void sendDailyMembershipSummary();

  setInterval(() => {
    void sendDailyMembershipSummary();
  }, 60 * 60 * 1000);
};
