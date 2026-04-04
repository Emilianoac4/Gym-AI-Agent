import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  fullName: z.string().min(2, "Nombre requerido"),
  role: z.enum(["trainer", "member"]),
  membershipMonths: z.number().int().min(1).max(12).optional(),
  paymentMethod: z.enum(["card", "transfer", "cash"]).optional(),
  paymentAmount: z.number().positive().optional(),
  profile: z
    .object({
      gender: z.enum(["female", "male", "prefer_not_to_say"]),
      goal: z.string().min(2),
      availabilityDays: z.number().int().min(1).max(7),
      level: z.number().int().min(1).max(5),
    })
    .optional(),
  initialMeasurement: z
    .object({
      weightKg: z.number().positive().optional(),
      bodyFatPct: z.number().min(1).max(100).optional(),
      muscleMass: z.number().positive().optional(),
      chestCm: z.number().positive().optional(),
      waistCm: z.number().positive().optional(),
      hipCm: z.number().positive().optional(),
      armCm: z.number().positive().optional(),
    })
    .optional(),
}).superRefine((value, ctx) => {
  if (value.role === "member" && !value.membershipMonths) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes seleccionar una membresia entre 1 y 12 meses",
      path: ["membershipMonths"],
    });
  }

  if (value.role === "member" && !value.paymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes seleccionar el metodo de pago",
      path: ["paymentMethod"],
    });
  }

  if (value.role === "member" && !value.paymentAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes indicar el monto pagado",
      path: ["paymentAmount"],
    });
  }

  if (value.role === "member" && !value.profile) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes completar los datos personales del cliente",
      path: ["profile"],
    });
  }
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const renewMembershipSchema = z.object({
  membershipMonths: z.number().int().min(1).max(12),
  paymentMethod: z.enum(["card", "transfer", "cash"]),
  paymentAmount: z.number().positive(),
});

export type RenewMembershipInput = z.infer<typeof renewMembershipSchema>;

const DAY_VALUES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export const updateProfileSchema = z.object({
  gender: z.enum(["female", "male", "prefer_not_to_say"]).optional(),
  birthDate: z.string().datetime().optional(),
  heightCm: z.number().positive().optional(),
  goal: z.string().optional(),
  medicalConds: z.string().optional(),
  injuries: z.string().optional(),
  experienceLvl: z.string().optional(),
  availability: z.string().optional(),
  dietPrefs: z.string().optional(),
  preferredDays: z.array(z.enum(DAY_VALUES)).optional(),
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
