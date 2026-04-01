import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { HttpError } from "../../utils/http-error";
import { CreateMeasurementInput } from "./measurements.validation";

type MetricKey = "weightKg" | "bodyFatPct" | "muscleMass" | "waistCm" | "armCm";

type SummaryMetric = {
  latest: number | null;
  weeklyChange: number | null;
  monthlyChange: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function getAverageForRange(
  values: Array<{ date: Date; value: number | null }>,
  fromMs: number,
  toMs: number,
): number | null {
  const inRange = values
    .filter((entry) => {
      const time = entry.date.getTime();
      return time >= fromMs && time < toMs && entry.value !== null;
    })
    .map((entry) => entry.value as number);

  if (inRange.length === 0) {
    return null;
  }

  const total = inRange.reduce((sum, value) => sum + value, 0);
  return roundMetric(total / inRange.length);
}

function computeChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) {
    return null;
  }
  return roundMetric(current - previous);
}

function getLatestValue(values: Array<{ date: Date; value: number | null }>): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const candidate = values[i];
    if (candidate && candidate.value !== null) {
      return candidate.value;
    }
  }
  return null;
}

function buildMetricSummary(
  values: Array<{ date: Date; value: number | null }>,
  nowMs: number,
): SummaryMetric {
  const last7Start = nowMs - 7 * DAY_MS;
  const prev7Start = nowMs - 14 * DAY_MS;
  const last30Start = nowMs - 30 * DAY_MS;
  const prev30Start = nowMs - 60 * DAY_MS;

  const current7 = getAverageForRange(values, last7Start, nowMs + 1);
  const previous7 = getAverageForRange(values, prev7Start, last7Start);
  const current30 = getAverageForRange(values, last30Start, nowMs + 1);
  const previous30 = getAverageForRange(values, prev30Start, last30Start);

  return {
    latest: getLatestValue(values),
    weeklyChange: computeChange(current7, previous7),
    monthlyChange: computeChange(current30, previous30),
  };
}

function getWeekStart(date: Date): string {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  const day = clone.getDay();
  const diff = (day + 6) % 7;
  clone.setDate(clone.getDate() - diff);
  return clone.toISOString().slice(0, 10);
}

function getConsecutiveWeeklyCheckIns(dates: Date[]): number {
  if (dates.length === 0) {
    return 0;
  }

  const uniqueWeekStarts = Array.from(new Set(dates.map(getWeekStart))).sort();

  let streak = 0;
  let expected = getWeekStart(new Date());

  for (let i = uniqueWeekStarts.length - 1; i >= 0; i -= 1) {
    if (uniqueWeekStarts[i] === expected) {
      streak += 1;
      const expectedDate = new Date(`${expected}T00:00:00.000Z`);
      expectedDate.setDate(expectedDate.getDate() - 7);
      expected = expectedDate.toISOString().slice(0, 10);
      continue;
    }

    const expectedDate = new Date(`${expected}T00:00:00.000Z`);
    const candidateDate = new Date(`${uniqueWeekStarts[i]}T00:00:00.000Z`);
    const diffWeeks = Math.round((expectedDate.getTime() - candidateDate.getTime()) / (7 * DAY_MS));
    if (diffWeeks <= 0) {
      continue;
    }
    break;
  }

  return streak;
}

export const createMeasurementForUser = async (
  req: Request<{ id: string }, unknown, CreateMeasurementInput>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;

  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.role !== "admin" && req.auth.userId !== id) {
    throw new HttpError(403, "You can only create your own measurements");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new HttpError(404, "User not found");
  }

  const measurement = await prisma.measurement.create({
    data: {
      userId: id,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      weightKg: req.body.weightKg,
      bodyFatPct: req.body.bodyFatPct,
      muscleMass: req.body.muscleMass,
      chestCm: req.body.chestCm,
      waistCm: req.body.waistCm,
      hipCm: req.body.hipCm,
      armCm: req.body.armCm,
      photoUrl: req.body.photoUrl,
    },
  });

  res.status(201).json({ message: "Measurement created", measurement });
};

export const listMeasurementsForUser = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.role !== "admin" && req.auth.userId !== id) {
    throw new HttpError(403, "You can only access your own measurements");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new HttpError(404, "User not found");
  }

  const measurements = await prisma.measurement.findMany({
    where: { userId: id },
    orderBy: { date: "desc" },
  });

  res.json({ measurements });
};

export const getProgressSummaryForUser = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!req.auth) {
    throw new HttpError(401, "Unauthorized");
  }

  if (req.auth.role !== "admin" && req.auth.userId !== id) {
    throw new HttpError(403, "You can only access your own progress");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) {
    throw new HttpError(404, "User not found");
  }

  const measurements = await prisma.measurement.findMany({
    where: { userId: id },
    orderBy: { date: "asc" },
    take: 180,
  });

  const now = new Date();
  const nowMs = now.getTime();
  const lastMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const daysSinceLastMeasurement = lastMeasurement
    ? Math.floor((nowMs - new Date(lastMeasurement.date).getTime()) / DAY_MS)
    : null;
  const hasMeasurementThisWeek = measurements.some(
    (item) => nowMs - new Date(item.date).getTime() <= 7 * DAY_MS,
  );

  const mapValues = (key: MetricKey): Array<{ date: Date; value: number | null }> =>
    measurements.map((item) => ({
      date: new Date(item.date),
      value: item[key] ?? null,
    }));

  const summary = {
    measurementsCount: measurements.length,
    hasMeasurementThisWeek,
    daysSinceLastMeasurement,
    weeklyCheckInStreak: getConsecutiveWeeklyCheckIns(measurements.map((item) => new Date(item.date))),
    nextAction: hasMeasurementThisWeek
      ? "Vas bien. Completa tu rutina y registra avances esta semana."
      : "Haz tu check-in semanal de medidas para mantener seguimiento.",
    metrics: {
      weightKg: buildMetricSummary(mapValues("weightKg"), nowMs),
      bodyFatPct: buildMetricSummary(mapValues("bodyFatPct"), nowMs),
      muscleMass: buildMetricSummary(mapValues("muscleMass"), nowMs),
      waistCm: buildMetricSummary(mapValues("waistCm"), nowMs),
      armCm: buildMetricSummary(mapValues("armCm"), nowMs),
    },
    timeline: measurements.slice(-12).map((item) => ({
      id: item.id,
      date: item.date,
      weightKg: item.weightKg,
      bodyFatPct: item.bodyFatPct,
      muscleMass: item.muscleMass,
      waistCm: item.waistCm,
      armCm: item.armCm,
    })),
  };

  res.json({ summary });
};
