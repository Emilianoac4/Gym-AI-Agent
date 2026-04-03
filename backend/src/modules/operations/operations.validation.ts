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

export const sendMembershipReportSchema = z
  .object({
    days: z.number().int().min(1).max(180),
    delivery: z.enum(["linked", "custom"]),
    email: z.string().email().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.delivery === "custom" && !value.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Debes indicar un correo valido para el envio personalizado",
      });
    }
  });

export type UpdateTrainerPresenceInput = z.infer<typeof updateTrainerPresenceSchema>;
export type MembershipReportQueryInput = z.infer<typeof membershipReportQuerySchema>;
export type ExportMembershipReportInput = z.infer<typeof exportMembershipReportSchema>;
export type SendMembershipReportInput = z.infer<typeof sendMembershipReportSchema>;