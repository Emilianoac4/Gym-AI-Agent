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
  completedAt: z
    .string()
    .datetime({ offset: true, message: "completedAt must be an ISO datetime" })
    .optional(),
});

export const routineCheckinsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).optional(),
});

export const strengthLogSchema = z.object({
  exerciseName: z
    .string()
    .min(2, "Exercise name is required")
    .max(80, "Exercise name is too long"),
  loadKg: z
    .coerce.number()
    .positive("Load must be greater than 0")
    .max(1000, "Load is out of range"),
  reps: z.coerce.number().int().min(1).max(100).optional(),
  sets: z.coerce.number().int().min(1).max(30).optional(),
  performedAt: z
    .string()
    .datetime({ offset: true, message: "performedAt must be an ISO datetime" })
    .optional(),
});

export const strengthProgressQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional(),
});
