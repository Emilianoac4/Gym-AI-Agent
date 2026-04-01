import { Request, Response, NextFunction } from "express";
import { aiService } from "./ai.service";
import { PrismaClient } from "@prisma/client";
import { HttpError } from "../../utils/http-error";

const prisma = new PrismaClient();

export class AIController {
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
      const { message } = req.body;
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
      const response = await aiService.chat(userId, message);

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
