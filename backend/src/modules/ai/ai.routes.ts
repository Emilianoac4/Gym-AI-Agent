import { Router } from "express";
import { AIController } from "./ai.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate, authorizeAction } from "../../middleware/auth.middleware";
import {
  addExerciseToRoutineSchema,
  addRoutineDaySchema,
  chatMessageSchema,
  exerciseCheckinSchema,
  exerciseOptionsSchema,
  regenerateRoutineDaySchema,
  removeRoutineExerciseSchema,
  replaceRoutineExerciseSchema,
  routineCheckinsQuerySchema,
  strengthLogSchema,
  strengthProgressQuerySchema,
} from "./ai.validation";

export const aiRouter = Router();

// All AI routes require authentication
aiRouter.use(authenticate);
aiRouter.use(authorizeAction("ai.use"));

// Generate personalized workout routine
aiRouter.post("/:userId/routine", AIController.generateRoutine);
aiRouter.get("/:userId/routine/latest", AIController.getLatestRoutine);
aiRouter.post(
  "/:userId/routine/regenerate-day",
  validate(regenerateRoutineDaySchema),
  AIController.regenerateRoutineDay
);
aiRouter.post(
  "/:userId/routine/exercises/replace",
  validate(replaceRoutineExerciseSchema),
  AIController.replaceRoutineExercise
);
aiRouter.post(
  "/:userId/routine/exercises/options",
  validate(exerciseOptionsSchema),
  AIController.getExerciseReplacementOptions
);
aiRouter.post(
  "/:userId/routine/exercises/checkins",
  validate(exerciseCheckinSchema),
  AIController.createExerciseCheckin
);
aiRouter.post(
  "/:userId/routine/exercises/remove",
  validate(removeRoutineExerciseSchema),
  AIController.removeRoutineExercise
);
aiRouter.post(
  "/:userId/routine/add-day",
  validate(addRoutineDaySchema),
  AIController.addRoutineDay
);
aiRouter.post(
  "/:userId/routine/exercises/add",
  validate(addExerciseToRoutineSchema),
  AIController.addExerciseToRoutine
);

// Persist and read weekly routine check-ins
aiRouter.post(
  "/:userId/routine/checkins",
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
