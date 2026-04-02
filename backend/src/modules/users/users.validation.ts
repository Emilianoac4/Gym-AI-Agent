import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  fullName: z.string().min(2, "Nombre requerido"),
  role: z.enum(["trainer", "member"]),
  membershipMonths: z.number().int().min(1).max(12).optional(),
}).superRefine((value, ctx) => {
  if (value.role === "member" && !value.membershipMonths) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes seleccionar una membresia entre 1 y 12 meses",
      path: ["membershipMonths"],
    });
  }
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

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

export const upsertHealthConnectionSchema = z.object({
  provider: z.enum(["apple_health", "google_fit", "health_connect"]),
  externalEmail: z.string().email().optional(),
  externalSubject: z.string().min(3).optional(),
  metadata: z.string().max(2000).optional(),
});

export const setHealthConnectionStateSchema = z.object({
  isActive: z.boolean(),
});

export type UpsertHealthConnectionInput = z.infer<typeof upsertHealthConnectionSchema>;
export type SetHealthConnectionStateInput = z.infer<typeof setHealthConnectionStateSchema>;
