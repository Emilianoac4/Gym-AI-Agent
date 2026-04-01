import { Router } from "express";
import { AIController } from "./ai.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { chatMessageSchema } from "./ai.validation";

export const aiRouter = Router();

// All AI routes require authentication
aiRouter.use(authenticate);

// Generate personalized workout routine
aiRouter.post("/:userId/routine", AIController.generateRoutine);

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
