import { z } from "zod";

const exerciseSchema = z.object({
  name: z.string().min(1),
  originalName: z.string().optional(),
  reps: z.number().int().positive(),
  sets: z.number().int().positive(),
  restSeconds: z.number().int().min(0),
  tips: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  purpose: z.string().min(1).max(500),
  exercises: z.array(exerciseSchema).min(1),
});

export const updateTemplateSchema = createTemplateSchema;

const DAY_VALUES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export const updateAssignedRoutineSchema = z.object({
  name: z.string().min(1).max(100),
  purpose: z.string().min(1).max(500),
  exercises: z.array(exerciseSchema).min(1),
  scheduledDays: z.array(z.enum(DAY_VALUES)).optional(),
});

export const assignRoutineSchema = z.object({
  memberId: z.string().uuid(),
  name: z.string().min(1).max(100),
  purpose: z.string().min(1).max(500),
  templateId: z.string().uuid().optional(),
  exercises: z.array(exerciseSchema).min(1),
  aiWarnings: z.array(z.string()).optional(),
  scheduledDays: z.array(z.enum(DAY_VALUES)).optional(),
});

export const standardizeNameSchema = z.object({
  name: z.string().min(1).max(200),
});

export const validateRoutineSchema = z.object({
  memberId: z.string().uuid(),
  routineName: z.string().min(1),
  purpose: z.string().min(1),
  exercises: z.array(
    z.object({
      name: z.string().min(1),
      reps: z.number().int().positive(),
      sets: z.number().int().positive(),
      restSeconds: z.number().int().min(0),
      tips: z.string().optional(),
    })
  ).min(1),
});

export type CreateTemplateInput         = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput         = z.infer<typeof updateTemplateSchema>;
export type UpdateAssignedRoutineInput  = z.infer<typeof updateAssignedRoutineSchema>;
export type AssignRoutineInput          = z.infer<typeof assignRoutineSchema>;
export type StandardizeNameInput        = z.infer<typeof standardizeNameSchema>;
export type ValidateRoutineInput        = z.infer<typeof validateRoutineSchema>;
