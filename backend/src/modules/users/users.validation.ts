import { z } from "zod";

export const updateProfileSchema = z.object({
  birthDate: z.string().datetime().optional(),
  heightCm: z.number().positive().optional(),
  goal: z.string().optional(),
  medicalConds: z.string().optional(),
  injuries: z.string().optional(),
  experienceLvl: z.string().optional(),
  availability: z.string().optional(),
  dietPrefs: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
