import { z } from "zod";

export const updateTrainerPresenceSchema = z.object({
  isActive: z.boolean(),
});

export const membershipReportQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).default(7),
});

export const exportMembershipReportSchema = z.object({
  days: z.number().int().min(1).max(180),
});

export type UpdateTrainerPresenceInput = z.infer<typeof updateTrainerPresenceSchema>;
export type MembershipReportQueryInput = z.infer<typeof membershipReportQuerySchema>;
export type ExportMembershipReportInput = z.infer<typeof exportMembershipReportSchema>;