import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message cannot exceed 2000 characters"),
  startNewConversation: z.boolean().optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const routineCheckinSchema = z.object({
  sessionDay: z
    .string()
    .min(1, "Session day is required")
    .max(50, "Session day is too long"),
  completedAt: z.union([z.string(), z.date()]).optional(),
});

export const routineCheckinsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).optional(),
});

export const strengthLogSchema = z.object({
  exerciseName: z
    .string()
    .min(2, "Exercise name is required")
    .max(80, "Exercise name is too long"),
  loadValue: z
    .coerce.number()
    .positive("Load must be greater than 0")
    .max(2000, "Load is out of range"),
  loadUnit: z.enum(["kg", "lb"]).optional(),
  reps: z.coerce.number().int().min(1).max(100).optional(),
  sets: z.coerce.number().int().min(1).max(30).optional(),
  performedAt: z.union([z.string(), z.date()]).optional(),
});

export const strengthProgressQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional(),
});

export const regenerateRoutineDaySchema = z.object({
  sessionDay: z
    .string()
    .min(1, "Session day is required")
    .max(50, "Session day is too long"),
});

export const removeRoutineExerciseSchema = z.object({
  sessionDay: z
    .string()
    .min(1, "Session day is required")
    .max(50, "Session day is too long"),
  exerciseName: z
    .string()
    .min(2, "Exercise name is required")
    .max(80, "Exercise name is too long"),
});

const replacementExerciseSchema = z.object({
  name: z.string().min(2).max(80),
  sets: z.coerce.number().int().min(1).max(20),
  reps: z.string().min(1).max(20),
  rest_seconds: z.coerce.number().int().min(10).max(600),
  notes: z.string().max(240).nullable().optional(),
});

export const replaceRoutineExerciseSchema = z.object({
  sessionDay: z
    .string()
    .min(1, "Session day is required")
    .max(50, "Session day is too long"),
  exerciseName: z
    .string()
    .min(2, "Exercise name is required")
    .max(80, "Exercise name is too long"),
  reason: z.string().max(200, "Reason is too long").optional(),
  replacementExercise: replacementExerciseSchema.optional(),
});

export const exerciseCheckinSchema = z.object({
  sessionDay: z.string().min(1).max(50),
  exerciseName: z.string().min(2).max(80),
  completedAt: z.union([z.string(), z.date()]).optional(),
});

export const exerciseOptionsSchema = z.object({
  sessionDay: z.string().min(1).max(50),
  exerciseName: z.string().min(2).max(80),
  count: z.coerce.number().int().min(2).max(8).optional(),
});
