import { z } from "zod";

export const createMeasurementSchema = z.object({
  date: z.string().datetime().optional(),
  weightKg: z.number().positive().optional(),
  bodyFatPct: z.number().min(0).max(100).optional(),
  muscleMass: z.number().nonnegative().optional(),
  chestCm: z.number().positive().optional(),
  waistCm: z.number().positive().optional(),
  hipCm: z.number().positive().optional(),
  armCm: z.number().positive().optional(),
  photoUrl: z.string().url().optional(),
});

export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;
