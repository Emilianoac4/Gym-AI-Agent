import { Request, Response, NextFunction } from "express";
import { aiService } from "./ai.service";
import { PrismaClient } from "@prisma/client";
import { HttpError } from "../../utils/http-error";

const prisma = new PrismaClient();
const ROUTINE_CHECKIN_PREFIX = "ROUTINE_CHECKIN::";
const STRENGTH_LOG_PREFIX = "STRENGTH_LOG::";

function getWeekStartIso(date: Date): string {
  const clone = new Date(date);
  clone.setUTCHours(0, 0, 0, 0);
  const day = clone.getUTCDay();
  const diff = (day + 6) % 7;
  clone.setUTCDate(clone.getUTCDate() - diff);
  return clone.toISOString().slice(0, 10);
}

function normalizeSessionDay(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase();
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

function estimatedOneRM(loadKg: number, reps: number | null): number | null {
  if (!reps || reps <= 0) {
    return null;
  }

  const value = loadKg * (1 + reps / 30);
  return Number(value.toFixed(2));
}

export class AIController {
  static async createStrengthLog(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.params.userId as string;
      const auth = (req as any).auth;
      const { exerciseName, loadKg, reps, sets, performedAt } = req.body as {
        exerciseName: string;
        loadKg: number;
        reps?: number;
        sets?: number;
        performedAt?: string;
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const performedDate = performedAt ? new Date(performedAt) : new Date();
      const normalizedExercise = normalizeExerciseName(exerciseName);
      const marker = `${STRENGTH_LOG_PREFIX}${normalizedExercise}`;

      const payload = {
        exerciseName: exerciseName.trim(),
        loadKg,
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
        completedAt?: string;
      };

      if (auth.role !== "admin" && auth.userId !== userId) {
        throw new HttpError(403, "Forbidden");
      }

      const completedDate = completedAt ? new Date(completedAt) : new Date();
      const weekStart = getWeekStartIso(completedDate);
      const normalizedDay = normalizeSessionDay(sessionDay);
      const marker = `${ROUTINE_CHECKIN_PREFIX}${weekStart}::${normalizedDay}`;

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
          userMessage: {
            startsWith: ROUTINE_CHECKIN_PREFIX,
          },
          createdAt: {
            gte: fromDate,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const checkins = logs
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

      res.json({
        message: "Routine check-ins retrieved",
        count: checkins.length,
        checkins,
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
      let parsedRoutine;
      try {
        parsedRoutine = JSON.parse(routine);
      } catch (e) {
        parsedRoutine = { raw: routine };
      }

      res.json({
        message: "Routine generated successfully",
        routine: parsedRoutine,
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
}
