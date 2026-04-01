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
    role: z.enum(["admin", "member"]).default("member"),
  }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const oauthLoginSchema = z.object({
  idToken: z.string().min(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OauthLoginInput = z.infer<typeof oauthLoginSchema>;
