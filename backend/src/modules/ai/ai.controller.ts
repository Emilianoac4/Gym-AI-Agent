import { Request, Response, NextFunction } from "express";
import { aiService } from "./ai.service";
import { PrismaClient } from "@prisma/client";
import { HttpError } from "../../utils/http-error";

const prisma = new PrismaClient();
const ROUTINE_CHECKIN_PREFIX = "ROUTINE_CHECKIN::";
const EXERCISE_CHECKIN_PREFIX = "EXERCISE_CHECKIN::";
const STRENGTH_LOG_PREFIX = "STRENGTH_LOG::";

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
  const clone = new Date(date);
  clone.setUTCHours(0, 0, 0, 0);
  const day = clone.getUTCDay();
  const diff = (day + 6) % 7;
  clone.setUTCDate(clone.getUTCDate() - diff);
  return clone.toISOString().slice(0, 10);
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
      injuries: userWithProfile.profile.injuries,
      medicalConditions: userWithProfile.profile.medicalConds,
    };
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
      prisma.aIChatLog.findMany({
        where: {
          userId,
          type: "CHAT",
          userMessage: {
            startsWith: `${ROUTINE_CHECKIN_PREFIX}${weekStart}::`,
          },
        },
      }),
      prisma.aIChatLog.findMany({
        where: {
          userId,
          type: "CHAT",
          userMessage: {
            startsWith: `${EXERCISE_CHECKIN_PREFIX}${weekStart}::`,
          },
        },
      }),
    ]);

    const completedDays = new Set<string>();
    dayLogs.forEach((item) => {
      const parts = item.userMessage.split("::");
      if (parts.length >= 3) {
        completedDays.add(parts[2]);
      }
    });

    const completedExercisesByDay = new Map<string, Set<string>>();
    exerciseLogs.forEach((item) => {
      const parts = item.userMessage.split("::");
      if (parts.length >= 4) {
        const day = parts[2];
        const exercise = parts[3];
        const current = completedExercisesByDay.get(day) || new Set<string>();
        current.add(exercise);
        completedExercisesByDay.set(day, current);
      }
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
      const normalizedExercise = normalizeExerciseName(exerciseName);
      const marker = `${STRENGTH_LOG_PREFIX}${normalizedExercise}`;

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

      const created = await prisma.aIChatLog.create({
        data: {
          userId,
          type: "CHAT",
          userMessage: marker,
          aiResponse: JSON.stringify(payload),
          createdAt: performedDate,
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

      const completedIso = toIsoString(completedAt);
      const completedDate = new Date(completedIso);
      const weekStart = getWeekStartIso(completedDate);
      const normalizedDay = normalizeSessionDay(sessionDay);
      const normalizedExercise = normalizeExerciseName(exerciseName);
      const marker = `${EXERCISE_CHECKIN_PREFIX}${weekStart}::${normalizedDay}::${normalizedExercise}`;
      const latestRoutine = await AIController.getLatestRoutineSnapshot(userId);

      const existing = await prisma.aIChatLog.findFirst({
        where: {
          userId,
          type: "CHAT",
          userMessage: marker,
        },
      });

      if (existing) {
        res.json({
          message: "Exercise check-in already registered",
          checkin: {
            id: existing.id,
            weekStart,
            sessionDay,
            exerciseName,
            completedAt: existing.createdAt,
          },
        });
        return;
      }

      const created = await prisma.aIChatLog.create({
        data: {
          userId,
          type: "CHAT",
          userMessage: marker,
          aiResponse: `Exercise completed: ${exerciseName}`,
          createdAt: completedDate,
        },
      });

      // Auto complete day when every exercise in the session is marked.
      const session = latestRoutine.routine.sessions.find(
        (item) => normalizeSessionDay(item.day) === normalizedDay
      );

      if (session) {
        const existingExerciseLogs = await prisma.aIChatLog.findMany({
          where: {
            userId,
            type: "CHAT",
            userMessage: {
              startsWith: `${EXERCISE_CHECKIN_PREFIX}${weekStart}::${normalizedDay}::`,
            },
          },
        });

        const completedSet = new Set<string>();
        existingExerciseLogs.forEach((entry) => {
          const parts = entry.userMessage.split("::");
          if (parts.length >= 4) {
            completedSet.add(parts[3]);
          }
        });

        const allDone = session.exercises.every((exercise) =>
          completedSet.has(normalizeExerciseName(exercise.name))
        );

        if (allDone) {
          const dayMarker = `${ROUTINE_CHECKIN_PREFIX}${weekStart}::${normalizedDay}`;
          const existingDay = await prisma.aIChatLog.findFirst({
            where: {
              userId,
              type: "CHAT",
              userMessage: dayMarker,
            },
          });

          if (!existingDay) {
            await prisma.aIChatLog.create({
              data: {
                userId,
                type: "CHAT",
                userMessage: dayMarker,
                aiResponse: `Session completed: ${sessionDay}`,
                createdAt: completedDate,
              },
            });
          }
        }
      }

      res.status(201).json({
        message: "Exercise check-in saved",
        checkin: {
          id: created.id,
          weekStart,
          sessionDay,
          exerciseName,
          completedAt: created.createdAt,
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

      const logs = await prisma.aIChatLog.findMany({
        where: {
          userId,
          type: "CHAT",
          userMessage: {
            startsWith: STRENGTH_LOG_PREFIX,
          },
          createdAt: {
            gte: fromDate,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const entries = logs
        .map((item) => {
          const payload = parseStrengthPayload(item.aiResponse);
          if (!payload) {
            return null;
          }

          return {
            id: item.id,
            exerciseName: payload.exerciseName,
            loadKg: payload.loadKg,
            reps: payload.reps,
            sets: payload.sets,
            performedAt: payload.performedAt,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

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
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));

      const improvingExercises = exerciseProgress.filter(
        (item) => item.absoluteChangeKg > 0
      ).length;

      res.json({
        message: "Strength progress retrieved",
        summary: {
          totalLogs: entries.length,
          activeExercises: exerciseProgress.length,
          improvingExercises,
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
      const normalizedDay = normalizeSessionDay(sessionDay);
      const marker = `${ROUTINE_CHECKIN_PREFIX}${weekStart}::${normalizedDay}`;
      const latestRoutine = await AIController.getLatestRoutineSnapshot(userId);

      const existing = await prisma.aIChatLog.findFirst({
        where: {
          userId,
          type: "CHAT",
          userMessage: marker,
        },
      });

      if (existing) {
        res.json({
          message: "Routine check-in already registered for this week",
          checkin: {
            id: existing.id,
            sessionDay,
            completedAt: existing.createdAt,
            weekStart,
          },
        });
        return;
      }

      const created = await prisma.aIChatLog.create({
        data: {
          userId,
          type: "CHAT",
          userMessage: marker,
          aiResponse: `Session completed: ${sessionDay}`,
          createdAt: completedDate,
        },
      });

      res.status(201).json({
        message: "Routine check-in saved",
        checkin: {
          id: created.id,
          sessionDay,
          completedAt: created.createdAt,
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
      const logs = await prisma.aIChatLog.findMany({
        where: {
          userId,
          type: "CHAT",
          OR: [
            {
              userMessage: {
                startsWith: ROUTINE_CHECKIN_PREFIX,
              },
            },
            {
              userMessage: {
                startsWith: EXERCISE_CHECKIN_PREFIX,
              },
            },
          ],
          createdAt: {
            gte: fromDate,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const checkins = logs
        .filter((item) => item.userMessage.startsWith(ROUTINE_CHECKIN_PREFIX))
        .map((item) => {
          const parts = item.userMessage.split("::");
          if (parts.length < 3) {
            return null;
          }
          return {
            id: item.id,
            weekStart: parts[1],
            sessionDay: parts[2],
            completedAt: item.createdAt,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const exerciseCheckins = logs
        .filter((item) => item.userMessage.startsWith(EXERCISE_CHECKIN_PREFIX))
        .map((item) => {
          const parts = item.userMessage.split("::");
          if (parts.length < 4) {
            return null;
          }
          return {
            id: item.id,
            weekStart: parts[1],
            sessionDay: parts[2],
            exerciseName: parts[3],
            completedAt: item.createdAt,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

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

      // Generate routine via OpenAI
      const routine = await aiService.generateRoutine(userId, {
        goal: userWithProfile.profile.goal || "General fitness",
        experienceLevel: userWithProfile.profile.experienceLvl || "Beginner",
        availability: userWithProfile.profile.availability || "3 days per week",
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
      try {
        const latest = await AIController.getLatestRoutineSnapshot(userId);
        const completionState = await AIController.getCurrentWeekCompletionState(userId);

        const generatedByDay = new Map<string, RoutineSession>();
        parsedRoutine.sessions.forEach((session) => {
          generatedByDay.set(normalizeSessionDay(session.day), session);
        });

        const existingDayOrder = new Set<string>();
        const mergedSessions = latest.routine.sessions.map((existingSession) => {
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
      } catch (error) {
        if (error instanceof HttpError && error.statusCode === 404) {
          // First generation path: aiService already stored snapshot.
          mergedRoutine = parsedRoutine;
        } else {
          throw error;
        }
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
}
