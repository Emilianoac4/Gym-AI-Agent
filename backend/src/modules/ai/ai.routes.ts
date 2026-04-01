import { Router } from "express";
import { AIController } from "./ai.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import {
  chatMessageSchema,
  routineCheckinSchema,
  routineCheckinsQuerySchema,
  strengthLogSchema,
  strengthProgressQuerySchema,
} from "./ai.validation";

export const aiRouter = Router();

// All AI routes require authentication
aiRouter.use(authenticate);

// Generate personalized workout routine
aiRouter.post("/:userId/routine", AIController.generateRoutine);

// Persist and read weekly routine check-ins
aiRouter.post(
  "/:userId/routine/checkins",
  validate(routineCheckinSchema),
  AIController.createRoutineCheckin
);
aiRouter.get(
  "/:userId/routine/checkins",
  validate(routineCheckinsQuerySchema),
  AIController.getRoutineCheckins
);

// Persist and read strength progression logs
aiRouter.post(
  "/:userId/strength/logs",
  validate(strengthLogSchema),
  AIController.createStrengthLog
);
aiRouter.get(
  "/:userId/strength/progress",
  validate(strengthProgressQuerySchema),
  AIController.getStrengthProgress
);

// Generate personalized nutrition plan
aiRouter.post("/:userId/nutrition", AIController.generateNutrition);

// Chat with AI coach
aiRouter.post(
  "/:userId/chat",
  validate(chatMessageSchema),
  AIController.chat
);

// Get daily fitness tip
aiRouter.get("/:userId/tip", AIController.getDailyTip);

// Get chat history
aiRouter.get("/:userId/history", AIController.getChatHistory);

// Clear chat history
aiRouter.delete("/:userId/history", AIController.clearChatHistory);
