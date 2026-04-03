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

export const createCompanySchema = z.object({
  gymName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  address: z.string().max(255).optional(),
  country: z.string().min(2).max(80).optional(),
  state: z.string().min(2).max(80).optional(),
  district: z.string().min(2).max(80).optional(),
  phone: z.string().max(40).optional(),
  currency: z.enum(["USD", "CRC"]).default("USD"),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2).max(120),
  adminPassword: z.string().min(8).max(120),
  planTier: z.enum(["basica", "standard", "premium"]).default("premium"),
  userLimit: z.coerce.number().int().min(1).max(50000).default(50),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateSubscriptionStatusSchema = z.object({
  status: z.enum(["active", "suspended", "cancelled"]),
  reason: z.string().max(500).optional(),
});

export const platformAlertsQuerySchema = z.object({
  daysAhead: z.coerce.number().int().min(1).max(60).optional(),
});

export const platformDashboardQuerySchema = z.object({
  includeDeleted: z.coerce.boolean().optional(),
});

export const deleteCompanyRequestSchema = z.object({
  platformPassword: z.string().min(8).max(120),
});

export const deleteCompanyConfirmSchema = z.object({
  challengeToken: z.string().min(16).max(200),
  confirmation: z.string().min(2).max(200),
});

export const recoverCompanySchema = z.object({
  platformPassword: z.string().min(8).max(120),
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
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateSubscriptionStatusInput = z.infer<typeof updateSubscriptionStatusSchema>;
export type PlatformAlertsQueryInput = z.infer<typeof platformAlertsQuerySchema>;
export type PlatformDashboardQueryInput = z.infer<typeof platformDashboardQuerySchema>;
export type DeleteCompanyRequestInput = z.infer<typeof deleteCompanyRequestSchema>;
export type DeleteCompanyConfirmInput = z.infer<typeof deleteCompanyConfirmSchema>;
export type RecoverCompanyInput = z.infer<typeof recoverCompanySchema>;
