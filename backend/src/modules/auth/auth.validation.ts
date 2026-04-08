import { z } from "zod";

export const registerSchema = z.object({
  gym: z
    .object({
      name: z.string().min(2),
      ownerName: z.string().min(2),
      address: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  user: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    username: z
      .string()
      .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
      .max(30, "El nombre de usuario no puede tener mas de 30 caracteres")
      .regex(/^[a-zA-Z0-9]+$/, "El nombre de usuario solo puede contener letras y numeros"),
    role: z.enum(["admin", "trainer", "member"]).default("member"),
  }),
});

// Accept both `identifier` (new) and `email` (legacy mobile builds)
export const loginSchema = z
  .object({
    identifier: z.string().min(3).max(255).optional(),
    email: z.string().optional(), // backward compat
    password: z.string().min(8),
    requestedRole: z.enum(["admin", "trainer", "member"]).optional(), // ignored by server; kept for backward compat
  })
  .transform((data) => ({
    identifier: (data.identifier ?? data.email ?? "").trim(),
    password: data.password,
    requestedRole: data.requestedRole,
  }))
  .refine((data) => data.identifier.length >= 3, {
    message: "Se requiere correo electrónico o nombre de usuario",
    path: ["identifier"],
  });

export const selectGymSchema = z.object({
  selectorToken: z.string().min(10),
  userId: z.string().uuid(),
});

export const oauthLoginSchema = z.object({
  idToken: z.string().min(20),
  requestedRole: z.enum(["admin", "trainer", "member"]).optional(), // ignored by server; kept for backward compat
});

export const changeTemporaryPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(16),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(16).optional(),
});

export const requestEmailVerificationSchema = z.object({
  email: z.string().email(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(16),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  newPassword: z.string().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SelectGymInput = z.infer<typeof selectGymSchema>;
export type OauthLoginInput = z.infer<typeof oauthLoginSchema>;
export type ChangeTemporaryPasswordInput = z.infer<typeof changeTemporaryPasswordSchema>;
export type RefreshSessionInput = z.infer<typeof refreshSessionSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type RequestEmailVerificationInput = z.infer<typeof requestEmailVerificationSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
