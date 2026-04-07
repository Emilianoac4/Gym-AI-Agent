import { Request, Response, NextFunction } from "express";
import { aiService } from "./ai.service";
import { PrismaClient } from "@prisma/client";
import { HttpError } from "../../utils/http-error";

const prisma = new PrismaClient();
const ROUTINE_CHECKIN_PREFIX = "ROUTINE_CHECKIN::";
const EXERCISE_CHECKIN_PREFIX = "EXERCISE_CHECKIN::";
const STRENGTH_LOG_PREFIX = "STRENGTH_LOG::";

const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";
const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type RoutineExercise = {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
};

type RoutineSession = {
  day: string;
  focus: string;
  duration_minutes: number;
  exercises: RoutineExercise[];
};

type GeneratedRoutine = {
  routine_name: string;
  duration_weeks: number;
  weekly_sessions: number;
  sessions: RoutineSession[];
  progression_tips?: string[];
  nutrition_notes?: string;
};

const LB_TO_KG = 0.45359237;

function getWeekStartIso(date: Date): string {
  const dateKey = getDateKeyIso(date);
  const day = getSessionDayFromDate(date);
  const diffMap: Record<string, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };

  return shiftDateKey(dateKey, -(diffMap[day] ?? 0));
}

function getDateKeyIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COSTA_RICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function getSessionDayFromDate(date: Date): string {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: COSTA_RICA_TIME_ZONE,
    weekday: "long",
  })
    .format(date)
    .toLowerCase();

  const index = DAY_KEYS.indexOf(weekday as (typeof DAY_KEYS)[number]);
  return index >= 0 ? DAY_KEYS[index] : "monday";
}

function shiftDateKey(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function normalizeSessionDay(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeExerciseName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toIsoString(value?: string | Date): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Invalid datetime value");
  }

  return parsed.toISOString();
}

function normalizeDayName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function convertToKg(value: number, unit: "kg" | "lb"): number {
  if (unit === "lb") {
    return Number((value * LB_TO_KG).toFixed(3));
  }

  return Number(value.toFixed(3));
}

function parseStrengthPayload(raw: string): {
  exerciseName: string;
  loadKg: number;
  reps: number | null;
  sets: number | null;
  performedAt: string;
} | null {
  try {
    const parsed = JSON.parse(raw) as {
      exerciseName?: string;
      loadKg?: number;
      reps?: number;
      sets?: number;
      performedAt?: string;
    };

    if (!parsed.exerciseName || typeof parsed.loadKg !== "number") {
      return null;
    }

    return {
      exerciseName: parsed.exerciseName,
      loadKg: parsed.loadKg,
      reps: typeof parsed.reps === "number" ? parsed.reps : null,
      sets: typeof parsed.sets === "number" ? parsed.sets : null,
      performedAt: parsed.performedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseRoutinePayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function estimatedOneRM(loadKg: number, reps: number | null): number | null {
  if (!reps || reps <= 0) {
    return null;
  }

  const value = loadKg * (1 + reps / 30);
  return Number(value.toFixed(2));
}

export class AIController {
  private static async getUserProfileContext(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    const userWithProfile = user as any;
    if (!userWithProfile.profile) {
      throw new HttpError(
        400,
        "User profile not complete. Please fill your profile first."
      );
    }

    return {
      goal: userWithProfile.profile.goal || "General fitness",
      experienceLevel: userWithProfile.profile.experienceLvl || "Beginner",
      availability: userWithProfile.profile.availability || "3 days per week",
      preferredDays: Array.isArray(userWithProfile.profile.preferredDays)
        ? (userWithProfile.profile.preferredDays as string[])
        : [],
      injuries: userWithProfile.profile.injuries,
      medicalConditions: userWithProfile.profile.medicalConds,
    };
  }

    private static async getRoutineHistorySnapshots(
      userId: string,
      days = 180
    ): Promise<Array<{ id: string; createdAt: Date; routine: GeneratedRoutine }>> {
      const safeDays = Number.isFinite(days) ? Math.max(1, Math.min(365, days)) : 180;
      const fromDate = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      const logs = await prisma.aIChatLog.findMany({
        where: {
          userId,
          type: "ROUTINE_GENERATION",
          createdAt: {
            gte: fromDate,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 200,
      });

      return logs
        .map((entry) => {
          const routine = parseRoutinePayload(entry.aiResponse) as GeneratedRoutine | null;
          if (!routine || !Array.isArray(routine.sessions)) {
            return null;
          }

          return {
            id: entry.id,
            createdAt: entry.createdAt,
            routine,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    }

  private static async getLatestRoutineSnapshot(userId: string): Promise<{
    routine: GeneratedRoutine;
    createdAt: Date;
  }> {
    const logs = await prisma.aIChatLog.findMany({
      where: {
        userId,
        type: "ROUTINE_GENERATION",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    const latest = logs
      .map((entry) => {
        const routine = parseRoutinePayload(entry.aiResponse) as GeneratedRoutine | null;
        if (!routine || !Array.isArray(routine.sessions)) {
          return null;
        }

        return {
          routine,
          createdAt: entry.createdAt,
        };
      })
      .find((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (!latest) {
      throw new HttpError(404, "No saved routine found. Generate one first.");
    }

    return latest;
  }

  private static async saveRoutineSnapshot(
    userId: string,
    routine: GeneratedRoutine,
    userMessage: string
  ) {
    await prisma.aIChatLog.create({
      data: {
        userId,
        type: "ROUTINE_GENERATION",
        userMessage,
        aiResponse: JSON.stringify(routine),
      },
    });
  }

  private static async getCurrentWeekCompletionState(userId: string) {
    const weekStart = getWeekStartIso(new Date());

    const [dayLogs, exerciseLogs] = await Promise.all([
      prisma.routineSessionLog.findMany({
        where: {
          userId,
          weekStart,
        },
      }),
      prisma.routineExerciseLog.findMany({
        where: {
          userId,
          weekStart,
        },
      }),
    ]);

    const completedDays = new Set<string>();
    dayLogs.forEach((item) => {
      completedDays.add(item.sessionDay);
    });

    const completedExercisesByDay = new Map<string, Set<string>>();
    exerciseLogs.forEach((item) => {
      const day = item.sessionDay;
      const current = completedExercisesByDay.get(day) || new Set<string>();
      current.add(item.normalizedExerciseName);
      completedExercisesByDay.set(day, current);
    });

    return {
      weekStart,
      completedDays,
      completedExercisesByDay,
    };
  }

  static async getLatestRoutine(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const latest = await AIController.getLatestRoutineSnapshot(userId);

      res.json({
        message: "Latest routine retrieved",
        routine: latest.routine,
        generatedAt: latest.createdAt,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createStrengthLog(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { exerciseName, loadValue, loadUnit, reps, sets, performedAt } = req.body as {
        exerciseName: string;
        loadValue: number;
        loadUnit?: "kg" | "lb";
        reps?: number;
        sets?: number;
        performedAt?: string | Date;
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const unit: "kg" | "lb" = loadUnit === "lb" ? "lb" : "kg";
      const loadKg = convertToKg(loadValue, unit);
      const performedDate = new Date(toIsoString(performedAt));
      const weekStart = getWeekStartIso(performedDate);
      const dateKey = getDateKeyIso(performedDate);
      const sessionDay = getSessionDayFromDate(performedDate);
      const normalizedExercise = normalizeExerciseName(exerciseName);

      const payload = {
        exerciseName: exerciseName.trim(),
        loadKg,
        originalLoad: {
          value: Number(loadValue.toFixed(3)),
          unit,
        },
        reps: typeof reps === "number" ? reps : null,
        sets: typeof sets === "number" ? sets : null,
        performedAt: performedDate.toISOString(),
      };

      const created = await prisma.routineExerciseLog.upsert({
        where: {
          routine_exercise_logs_user_id_date_key_session_day_normalized_exercise_name_key: {
            userId,
            dateKey,
            sessionDay,
            normalizedExerciseName: normalizedExercise,
          },
        },
        create: {
          userId,
          weekStart,
          dateKey,
          sessionDay,
          exerciseName: exerciseName.trim(),
          normalizedExerciseName: normalizedExercise,
          loadKg,
          loadUnit: unit,
          reps: typeof reps === "number" ? reps : null,
          sets: typeof sets === "number" ? sets : null,
          performedAt: performedDate,
        },
        update: {
          exerciseName: exerciseName.trim(),
          loadKg,
          loadUnit: unit,
          reps: typeof reps === "number" ? reps : null,
          sets: typeof sets === "number" ? sets : null,
          performedAt: performedDate,
          weekStart,
        },
      });

      res.status(201).json({
        message: "Strength log saved",
        log: {
          id: created.id,
          ...payload,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async regenerateRoutineDay(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { sessionDay } = req.body as { sessionDay: string };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      if (!sessionDay || !sessionDay.trim()) {
        throw new HttpError(400, "sessionDay is required");
      }

      const latest = await AIController.getLatestRoutineSnapshot(userId);
      const userContext = await AIController.getUserProfileContext(userId);
      const completionState = await AIController.getCurrentWeekCompletionState(userId);
      const normalizedSession = normalizeSessionDay(sessionDay);

      if (completionState.completedDays.has(normalizedSession)) {
        throw new HttpError(
          409,
          "No puedes regenerar un dia que ya marcaste como completado"
        );
      }

      const targetSession = latest.routine.sessions.find(
        (item) => normalizeSessionDay(item.day) === normalizedSession
      );

      if (!targetSession) {
        throw new HttpError(404, "Session day not found in routine");
      }

      const completedExercises =
        completionState.completedExercisesByDay.get(normalizedSession) ||
        new Set<string>();

      if (completedExercises.size >= targetSession.exercises.length) {
        throw new HttpError(
          409,
          "No puedes regenerar este dia porque todos los ejercicios ya estan completados"
        );
      }

      const updatedRoutine = await aiService.regenerateRoutineDay(
        userId,
        userContext,
        latest.routine,
        sessionDay
      );

      if (completedExercises.size > 0) {
        const mergedSessions = updatedRoutine.sessions.map((session) => {
          if (normalizeSessionDay(session.day) !== normalizedSession) {
            return session;
          }

          const locked = targetSession.exercises.filter((exercise) =>
            completedExercises.has(normalizeExerciseName(exercise.name))
          );

          const candidates = session.exercises.filter(
            (exercise) => !completedExercises.has(normalizeExerciseName(exercise.name))
          );

          const baselineExerciseCount = Math.max(targetSession.exercises.length, 5);
          const desiredNewCount = Math.max(baselineExerciseCount - locked.length, 0);

          const newExercises = candidates.slice(0, desiredNewCount);

          return {
            ...session,
            exercises: [...locked, ...newExercises],
          };
        });

        const mergedRoutine: GeneratedRoutine = {
          ...updatedRoutine,
          sessions: mergedSessions,
        };

        await AIController.saveRoutineSnapshot(
          userId,
          mergedRoutine,
          `REGENERATE_DAY_PARTIAL::${sessionDay}`
        );

        res.json({
          message: "Routine day regenerated",
          routine: mergedRoutine,
        });
        return;
      }

      res.json({
        message: "Routine day regenerated",
        routine: updatedRoutine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async replaceRoutineExercise(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { sessionDay, exerciseName, reason } = req.body as {
        sessionDay: string;
        exerciseName: string;
        reason?: string;
        replacementExercise?: RoutineExercise;
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const latest = await AIController.getLatestRoutineSnapshot(userId);
      const userContext = await AIController.getUserProfileContext(userId);
      const completionState = await AIController.getCurrentWeekCompletionState(userId);
      const normalizedSession = normalizeSessionDay(sessionDay);
      const normalizedExercise = normalizeExerciseName(exerciseName);

      if (completionState.completedDays.has(normalizedSession)) {
        throw new HttpError(409, "Este dia ya esta completado y no se puede modificar");
      }

      const completedInDay =
        completionState.completedExercisesByDay.get(normalizedSession) ||
        new Set<string>();

      if (completedInDay.has(normalizedExercise)) {
        throw new HttpError(
          409,
          "Este ejercicio ya fue marcado como realizado y no se puede reemplazar"
        );
      }

      const updatedRoutine = await aiService.replaceRoutineExercise(
        userId,
        userContext,
        latest.routine,
        sessionDay,
        exerciseName,
        reason,
        (req.body as { replacementExercise?: RoutineExercise }).replacementExercise
      );

      res.json({
        message: "Exercise replaced",
        routine: updatedRoutine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeRoutineExercise(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { sessionDay, exerciseName } = req.body as {
        sessionDay: string;
        exerciseName: string;
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const latest = await AIController.getLatestRoutineSnapshot(userId);
      const normalizedSession = normalizeDayName(sessionDay);
      const normalizedExercise = normalizeExerciseName(exerciseName);
      const completionState = await AIController.getCurrentWeekCompletionState(userId);

      if (completionState.completedDays.has(normalizedSession)) {
        throw new HttpError(409, "Este dia ya esta completado y no se puede modificar");
      }

      const completedInDay =
        completionState.completedExercisesByDay.get(normalizedSession) ||
        new Set<string>();

      if (completedInDay.has(normalizedExercise)) {
        throw new HttpError(
          409,
          "Este ejercicio ya fue marcado como realizado y no se puede eliminar"
        );
      }

      let removed = false;
      const sessions = latest.routine.sessions.map((session) => {
        if (normalizeDayName(session.day) !== normalizedSession) {
          return session;
        }

        const filtered = session.exercises.filter((exercise) => {
          const keep = normalizeExerciseName(exercise.name) !== normalizedExercise;
          if (!keep) {
            removed = true;
          }
          return keep;
        });

        return {
          ...session,
          exercises: filtered,
        };
      });

      if (!removed) {
        throw new HttpError(404, "Exercise not found in selected session");
      }

      const updatedRoutine: GeneratedRoutine = {
        ...latest.routine,
        sessions,
      };

      await AIController.saveRoutineSnapshot(
        userId,
        updatedRoutine,
        `REMOVE_EXERCISE::${sessionDay}::${exerciseName}`
      );

      res.json({
        message: "Exercise removed",
        routine: updatedRoutine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExerciseReplacementOptions(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { sessionDay, exerciseName, count } = req.body as {
        sessionDay: string;
        exerciseName: string;
        count?: number;
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const latest = await AIController.getLatestRoutineSnapshot(userId);
      const userContext = await AIController.getUserProfileContext(userId);
      const completionState = await AIController.getCurrentWeekCompletionState(userId);
      const normalizedSession = normalizeSessionDay(sessionDay);
      const normalizedExercise = normalizeExerciseName(exerciseName);

      if (completionState.completedDays.has(normalizedSession)) {
        throw new HttpError(409, "Este dia ya esta completado y no se puede modificar");
      }

      const completedInDay =
        completionState.completedExercisesByDay.get(normalizedSession) ||
        new Set<string>();

      if (completedInDay.has(normalizedExercise)) {
        throw new HttpError(
          409,
          "Este ejercicio ya fue marcado como realizado y no se puede reemplazar"
        );
      }

      const options = await aiService.getRoutineExerciseAlternatives(
        userContext,
        latest.routine,
        sessionDay,
        exerciseName,
        count || 5
      );

      res.json({
        message: "Exercise options generated",
        options,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createExerciseCheckin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { sessionDay, exerciseName, completedAt } = req.body as {
        sessionDay: string;
        exerciseName: string;
        completedAt?: string | Date;
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const completedDate = new Date(toIsoString(completedAt));
      const weekStart = getWeekStartIso(completedDate);
      const dateKey = getDateKeyIso(completedDate);
      const normalizedDay = normalizeSessionDay(sessionDay);
      const normalizedExercise = normalizeExerciseName(exerciseName);
      const latestRoutine = await AIController.getLatestRoutineSnapshot(userId);

      const upserted = await prisma.routineExerciseLog.upsert({
        where: {
          routine_exercise_logs_user_id_date_key_session_day_normalized_exercise_name_key: {
            userId,
            dateKey,
            sessionDay: normalizedDay,
            normalizedExerciseName: normalizedExercise,
          },
        },
        create: {
          userId,
          weekStart,
          dateKey,
          sessionDay: normalizedDay,
          exerciseName: exerciseName.trim(),
          normalizedExerciseName: normalizedExercise,
          loadKg: null,
          loadUnit: null,
          reps: null,
          sets: null,
          performedAt: completedDate,
        },
        update: {
          exerciseName: exerciseName.trim(),
          performedAt: completedDate,
          weekStart,
        },
      });

      // Auto complete day when every exercise in the session is marked.
      const session = latestRoutine.routine.sessions.find(
        (item) => normalizeSessionDay(item.day) === normalizedDay
      );

      if (session) {
        const existingExerciseLogs = await prisma.routineExerciseLog.findMany({
          where: {
            userId,
            weekStart,
            sessionDay: normalizedDay,
          },
        });

        const completedSet = new Set<string>();
        existingExerciseLogs.forEach((entry) => {
          completedSet.add(entry.normalizedExerciseName);
        });

        const allDone = session.exercises.every((exercise) =>
          completedSet.has(normalizeExerciseName(exercise.name))
        );

        if (allDone) {
          await prisma.routineSessionLog.upsert({
            where: {
              routine_session_logs_user_id_date_key_session_day_key: {
                userId,
                dateKey,
                sessionDay: normalizedDay,
              },
            },
            create: {
              userId,
              weekStart,
              dateKey,
              sessionDay: normalizedDay,
              completedAt: completedDate,
            },
            update: {
              completedAt: completedDate,
              weekStart,
            },
          });
        }
      }

      res.status(201).json({
        message: "Exercise check-in saved",
        checkin: {
          id: upserted.id,
          weekStart,
          sessionDay,
          exerciseName,
          completedAt: upserted.performedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStrengthProgress(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const logs = await prisma.routineExerciseLog.findMany({
        where: {
          userId,
          loadKg: {
            not: null,
          },
          performedAt: {
            gte: fromDate,
          },
        },
        orderBy: {
          performedAt: "asc",
        },
      });

      const entries = logs.map((item) => ({
        id: item.id,
        exerciseName: item.exerciseName,
        loadKg: item.loadKg ?? 0,
        reps: item.reps,
        sets: item.sets,
        performedAt: item.performedAt.toISOString(),
      }));

      const grouped = new Map<string, typeof entries>();
      for (const entry of entries) {
        const key = normalizeExerciseName(entry.exerciseName);
        const bucket = grouped.get(key) || [];
        bucket.push(entry);
        grouped.set(key, bucket);
      }

      const exerciseProgress = Array.from(grouped.values())
        .map((bucket) => {
          if (bucket.length === 0) {
            return null;
          }

          const first = bucket[0];
          const latest = bucket[bucket.length - 1];
          const best = bucket.reduce((max, current) =>
            current.loadKg > max.loadKg ? current : max
          );
          const absoluteChangeKg = Number((latest.loadKg - first.loadKg).toFixed(2));
          const percentChange =
            first.loadKg > 0
              ? Number((((latest.loadKg - first.loadKg) / first.loadKg) * 100).toFixed(2))
              : null;

          const weeklyBuckets = new Map<string, typeof bucket>();
          for (const entry of bucket) {
            const weekStart = getWeekStartIso(new Date(entry.performedAt));
            const weekItems = weeklyBuckets.get(weekStart) || [];
            weekItems.push(entry);
            weeklyBuckets.set(weekStart, weekItems);
          }

          const weeklyHistory = Array.from(weeklyBuckets.entries())
            .sort(([weekA], [weekB]) => weekA.localeCompare(weekB))
            .map(([weekStart, entriesForWeek]) => {
              const latestWeekEntry = entriesForWeek[entriesForWeek.length - 1];
              const bestWeekEntry = entriesForWeek.reduce((max, current) =>
                current.loadKg > max.loadKg ? current : max
              );

              return {
                weekStart,
                latestLoadKg: latestWeekEntry.loadKg,
                bestLoadKg: bestWeekEntry.loadKg,
                logsCount: entriesForWeek.length,
                lastPerformedAt: latestWeekEntry.performedAt,
              };
            });

          const monthlyBuckets = new Map<string, typeof bucket>();
          for (const entry of bucket) {
            const monthKey = entry.performedAt.slice(0, 7);
            const monthItems = monthlyBuckets.get(monthKey) || [];
            monthItems.push(entry);
            monthlyBuckets.set(monthKey, monthItems);
          }

          const monthlyHistory = Array.from(monthlyBuckets.entries())
            .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
            .map(([monthKey, entriesForMonth]) => {
              const latestMonthEntry = entriesForMonth[entriesForMonth.length - 1];
              const bestMonthEntry = entriesForMonth.reduce((max, current) =>
                current.loadKg > max.loadKg ? current : max
              );

              return {
                month: monthKey,
                latestLoadKg: latestMonthEntry.loadKg,
                bestLoadKg: bestMonthEntry.loadKg,
                logsCount: entriesForMonth.length,
                lastPerformedAt: latestMonthEntry.performedAt,
              };
            });

          const latestDate = new Date(latest.performedAt).getTime();
          const oneWeekAgo = latestDate - 7 * 24 * 60 * 60 * 1000;
          const oneMonthAgo = latestDate - 30 * 24 * 60 * 60 * 1000;

          const lastWeekEntry = bucket
            .filter((entry) => new Date(entry.performedAt).getTime() <= oneWeekAgo)
            .slice(-1)[0];
          const lastMonthEntry = bucket
            .filter((entry) => new Date(entry.performedAt).getTime() <= oneMonthAgo)
            .slice(-1)[0];

          return {
            exerciseName: latest.exerciseName,
            logsCount: bucket.length,
            latestLoadKg: latest.loadKg,
            firstLoadKg: first.loadKg,
            bestLoadKg: best.loadKg,
            absoluteChangeKg,
            percentChange,
            estimatedOneRM: estimatedOneRM(latest.loadKg, latest.reps),
            lastPerformedAt: latest.performedAt,
            weeklyHistory,
            monthlyHistory,
            weeklyChangeKg: lastWeekEntry
              ? Number((latest.loadKg - lastWeekEntry.loadKg).toFixed(2))
              : null,
            monthlyChangeKg: lastMonthEntry
              ? Number((latest.loadKg - lastMonthEntry.loadKg).toFixed(2))
              : null,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));

      const improvingExercises = exerciseProgress.filter(
        (item) => item.absoluteChangeKg > 0
      ).length;

      const weeklyImprovingExercises = exerciseProgress.filter(
        (item) => typeof item.weeklyChangeKg === "number" && item.weeklyChangeKg > 0
      ).length;

      const monthlyImprovingExercises = exerciseProgress.filter(
        (item) => typeof item.monthlyChangeKg === "number" && item.monthlyChangeKg > 0
      ).length;

      res.json({
        message: "Strength progress retrieved",
        summary: {
          totalLogs: entries.length,
          activeExercises: exerciseProgress.length,
          improvingExercises,
          weeklyImprovingExercises,
          monthlyImprovingExercises,
        },
        exercises: exerciseProgress,
        recentLogs: entries.slice(-20).reverse(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createRoutineCheckin(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { sessionDay, completedAt } = req.body as {
        sessionDay: string;
        completedAt?: string | Date;
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      if (!sessionDay || !sessionDay.trim()) {
        throw new HttpError(400, "sessionDay is required");
      }

      const completedDate = new Date(toIsoString(completedAt));
      const weekStart = getWeekStartIso(completedDate);
      const dateKey = getDateKeyIso(completedDate);
      const normalizedDay = normalizeSessionDay(sessionDay);

      const created = await prisma.routineSessionLog.upsert({
        where: {
          routine_session_logs_user_id_date_key_session_day_key: {
            userId,
            dateKey,
            sessionDay: normalizedDay,
          },
        },
        create: {
          userId,
          weekStart,
          dateKey,
          sessionDay: normalizedDay,
          completedAt: completedDate,
        },
        update: {
          completedAt: completedDate,
          weekStart,
        },
      });

      res.status(201).json({
        message: "Routine check-in saved",
        checkin: {
          id: created.id,
          sessionDay,
          completedAt: created.completedAt,
          weekStart,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRoutineCheckins(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 28;
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const [sessionLogs, exerciseLogs] = await Promise.all([
        prisma.routineSessionLog.findMany({
          where: {
            userId,
            completedAt: {
              gte: fromDate,
            },
          },
          orderBy: {
            completedAt: "desc",
          },
        }),
        prisma.routineExerciseLog.findMany({
          where: {
            userId,
            performedAt: {
              gte: fromDate,
            },
          },
          orderBy: {
            performedAt: "desc",
          },
        }),
      ]);

      const checkins = sessionLogs.map((item) => ({
        id: item.id,
        weekStart: item.weekStart,
        sessionDay: item.sessionDay,
        completedAt: item.completedAt,
      }));

      const exerciseCheckins = exerciseLogs.map((item) => ({
        id: item.id,
        weekStart: item.weekStart,
        sessionDay: item.sessionDay,
        exerciseName: item.normalizedExerciseName,
        completedAt: item.performedAt,
      }));

      res.json({
        message: "Routine check-ins retrieved",
        count: checkins.length,
        checkins,
        exerciseCheckins,
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateRoutine(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      // Authorization: user can only request their own routine, admin can request any
      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      // Fetch user profile for context
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      if (!user) {
        throw new HttpError(404, "User not found");
      }

      const userWithProfile = user as any;
      if (!userWithProfile.profile) {
        throw new HttpError(
          400,
          "User profile not complete. Please fill your profile first."
        );
      }

      let previousLatestRoutine: { routine: GeneratedRoutine; createdAt: Date } | null = null;
      try {
        previousLatestRoutine = await AIController.getLatestRoutineSnapshot(userId);
      } catch (error) {
        if (!(error instanceof HttpError) || error.statusCode !== 404) {
          throw error;
        }
      }

      // Generate routine via OpenAI
      const routine = await aiService.generateRoutine(userId, {
        goal: userWithProfile.profile.goal || "General fitness",
        experienceLevel: userWithProfile.profile.experienceLvl || "Beginner",
        availability: userWithProfile.profile.availability || "3 days per week",
        preferredDays: Array.isArray(userWithProfile.profile.preferredDays)
          ? (userWithProfile.profile.preferredDays as string[])
          : [],
        injuries: userWithProfile.profile.injuries,
        medicalConditions: userWithProfile.profile.medicalConds,
      });

      // Parse JSON response
      let parsedRoutine: GeneratedRoutine;
      try {
        parsedRoutine = JSON.parse(routine);
      } catch (e) {
        throw new HttpError(500, "No se pudo interpretar la rutina generada");
      }

      if (!parsedRoutine || !Array.isArray(parsedRoutine.sessions)) {
        throw new HttpError(500, "La rutina generada no tiene un formato valido");
      }

      let mergedRoutine = parsedRoutine;
      if (previousLatestRoutine) {
        const completionState = await AIController.getCurrentWeekCompletionState(userId);

        const generatedByDay = new Map<string, RoutineSession>();
        parsedRoutine.sessions.forEach((session) => {
          generatedByDay.set(normalizeSessionDay(session.day), session);
        });

        const existingDayOrder = new Set<string>();
        const mergedSessions = previousLatestRoutine.routine.sessions.map((existingSession) => {
          const dayKey = normalizeSessionDay(existingSession.day);
          existingDayOrder.add(dayKey);
          const generatedSession = generatedByDay.get(dayKey);

          if (!generatedSession) {
            return existingSession;
          }

          // Completed days remain immutable when regenerating the full routine.
          if (completionState.completedDays.has(dayKey)) {
            return existingSession;
          }

          const completedExercises =
            completionState.completedExercisesByDay.get(dayKey) || new Set<string>();

          if (completedExercises.size === 0) {
            return generatedSession;
          }

          const lockedExercises = existingSession.exercises.filter((exercise) =>
            completedExercises.has(normalizeExerciseName(exercise.name))
          );

          const generatedCandidates = generatedSession.exercises.filter(
            (exercise) => !completedExercises.has(normalizeExerciseName(exercise.name))
          );

          const baselineExerciseCount = Math.max(existingSession.exercises.length, 5);
          const desiredGeneratedCount = Math.max(
            baselineExerciseCount - lockedExercises.length,
            0
          );

          return {
            ...generatedSession,
            exercises: [
              ...lockedExercises,
              ...generatedCandidates.slice(0, desiredGeneratedCount),
            ],
          };
        });

        parsedRoutine.sessions.forEach((generatedSession) => {
          const dayKey = normalizeSessionDay(generatedSession.day);
          if (!existingDayOrder.has(dayKey)) {
            mergedSessions.push(generatedSession);
          }
        });

        mergedRoutine = {
          ...parsedRoutine,
          weekly_sessions: mergedSessions.length,
          sessions: mergedSessions,
        };

        await AIController.saveRoutineSnapshot(
          userId,
          mergedRoutine,
          "REGENERATE_ROUTINE::PRESERVE_PROGRESS"
        );
      }

      res.json({
        message: "Routine generated successfully",
        routine: mergedRoutine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateNutrition(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      // Authorization
      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      // Fetch user profile
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      if (!user) {
        throw new HttpError(404, "User not found");
      }

      const userWithProfile = user as any;
      if (!userWithProfile.profile) {
        throw new HttpError(400, "User profile not complete");
      }

      // Generate nutrition plan
      const plan = await aiService.generateNutritionPlan(userId, {
        goal: userWithProfile.profile.goal || "General fitness",
        dietPreferences: userWithProfile.profile.dietPrefs,
        medicalConditions: userWithProfile.profile.medicalConds,
      });

      // Parse JSON response
      let parsedPlan;
      try {
        parsedPlan = JSON.parse(plan);
      } catch (e) {
        parsedPlan = { raw: plan };
      }

      res.json({
        message: "Nutrition plan generated successfully",
        plan: parsedPlan,
      });
    } catch (error) {
      next(error);
    }
  }

  static async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const { message, startNewConversation } = req.body as {
        message: string;
        startNewConversation?: boolean;
      };
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      // Authorization
      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      if (!message || typeof message !== "string") {
        throw new HttpError(400, "Message is required and must be a string");
      }

      // Chat with AI
      const response = await aiService.chat(userId, message, {
        startNewConversation: Boolean(startNewConversation),
      });

      res.json({
        message: "Chat response received",
        response,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDailyTip(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      // Authorization
      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      // Generate tip
      const tip = await aiService.generateDailyTip(userId);

      res.json({
        message: "Daily tip generated",
        tip,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getChatHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      // Authorization
      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      // Fetch chat history. If logs table is missing, return empty history instead of 500.
      let history = [] as Array<{
        id: string;
        userId: string;
        type: string;
        userMessage: string;
        aiResponse: string;
        createdAt: Date;
      }>;

      try {
        history = await prisma.aIChatLog.findMany({
          where: {
            userId,
            type: "CHAT",
            NOT: [
              {
                userMessage: {
                  startsWith: ROUTINE_CHECKIN_PREFIX,
                },
              },
              {
                userMessage: {
                  startsWith: STRENGTH_LOG_PREFIX,
                },
              },
              {
                userMessage: {
                  startsWith: EXERCISE_CHECKIN_PREFIX,
                },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
      } catch (error) {
        const candidate = error as { code?: string; message?: string };
        const isMissingTable =
          candidate?.code === "P2021" ||
          (candidate?.message || "").includes("ai_chat_logs");

        if (!isMissingTable) {
          throw error;
        }
      }

      res.json({
        message: "Chat history retrieved",
        count: history.length,
        history,
      });
    } catch (error) {
      next(error);
    }
  }

  static async clearChatHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      // Authorization
      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      let deletedCount = 0;

      try {
        const result = await prisma.aIChatLog.deleteMany({
          where: {
            userId,
            type: "CHAT",
            NOT: [
              {
                userMessage: {
                  startsWith: ROUTINE_CHECKIN_PREFIX,
                },
              },
              {
                userMessage: {
                  startsWith: STRENGTH_LOG_PREFIX,
                },
              },
              {
                userMessage: {
                  startsWith: EXERCISE_CHECKIN_PREFIX,
                },
              },
            ],
          },
        });
        deletedCount = result.count;
      } catch (error) {
        const candidate = error as { code?: string; message?: string };
        const isMissingTable =
          candidate?.code === "P2021" ||
          (candidate?.message || "").includes("ai_chat_logs");

        if (!isMissingTable) {
          throw error;
        }
      }

      res.json({
        message: "Chat history cleared",
        deletedCount,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addRoutineDay(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { day, focus } = req.body as { day: string; focus: string };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const latest = await AIController.getLatestRoutineSnapshot(userId);
      const userContext = await AIController.getUserProfileContext(userId);

      const updatedRoutine = await aiService.addRoutineDay(
        userId,
        userContext,
        latest.routine,
        day,
        focus
      );

      res.json({
        message: "New routine day added",
        routine: updatedRoutine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addExerciseToRoutine(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { sessionDay, manual } = req.body as {
        sessionDay: string;
        manual?: { name: string; sets: number; reps: string };
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const latest = await AIController.getLatestRoutineSnapshot(userId);
      const userContext = await AIController.getUserProfileContext(userId);

      const updatedRoutine = await aiService.addExerciseToRoutine(
        userId,
        userContext,
        latest.routine,
        sessionDay,
        manual
      );

      res.json({
        message: "Exercise added to routine",
        routine: updatedRoutine,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRoutineHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 180;
      const snapshots = await AIController.getRoutineHistorySnapshots(userId, days);

      res.json({
        message: "Routine history retrieved",
        count: snapshots.length,
        snapshots,
      });
    } catch (error) {
      next(error);
    }
  }
}
