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
    role: z.enum(["admin", "trainer", "member"]).default("member"),
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  requestedRole: z.enum(["admin", "trainer", "member"]),
});

export const oauthLoginSchema = z.object({
  idToken: z.string().min(20),
  requestedRole: z.enum(["admin", "trainer", "member"]),
});

export const changeTemporaryPasswordSchema = z.object({
  newPassword: z.string().min(8),
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
export type OauthLoginInput = z.infer<typeof oauthLoginSchema>;
export type ChangeTemporaryPasswordInput = z.infer<typeof changeTemporaryPasswordSchema>;
export type RequestEmailVerificationInput = z.infer<typeof requestEmailVerificationSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
