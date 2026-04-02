import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  fullName: z.string().min(2, "Nombre requerido"),
  role: z.enum(["trainer", "member"]),
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
