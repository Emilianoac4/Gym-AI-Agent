import { z } from "zod";

export const updateGymSubscriptionSchema = z.object({
  planTier: z.enum(["basica", "standard", "premium"]),
  userLimit: z.coerce.number().int().min(1).max(50000),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
  reason: z.string().max(500).optional(),
});

export const enforceGymSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const gymParamsSchema = z.object({
  gymId: z.string().uuid(),
});

export const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(120),
});

export const platformAdminUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(120),
  fullName: z.string().min(2).max(120),
  usernames: z.array(z.string().min(2).max(40)).max(10).optional(),
});

export const createCompanyAdminSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  password: z.string().min(8).max(120),
});

export type UpdateGymSubscriptionInput = z.infer<typeof updateGymSubscriptionSchema>;
export type EnforceGymSubscriptionInput = z.infer<typeof enforceGymSubscriptionSchema>;
export type CreateCompanyAdminInput = z.infer<typeof createCompanyAdminSchema>;
export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;
export type PlatformAdminUserInput = z.infer<typeof platformAdminUserSchema>;
