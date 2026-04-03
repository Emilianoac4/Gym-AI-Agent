import { z } from "zod";

export const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const sendGeneralNotificationSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  category: z.enum(["schedule", "pricing", "event", "maintenance", "general"]),
});
export type SendGeneralNotificationInput = z.infer<typeof sendGeneralNotificationSchema>;

export const createThreadSchema = z.object({
  targetUserId: z.string().uuid().optional(),
});
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

// threadId comes from URL param, merged into flat object by the validate middleware
export const sendMessageSchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().min(1).max(2000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const createEmergencyTicketSchema = z.object({
  category: z.enum(["harassment", "injury", "accident", "incident"]),
  description: z.string().min(10).max(2000),
});
export type CreateEmergencyTicketInput = z.infer<typeof createEmergencyTicketSchema>;

export const resolveEmergencyTicketSchema = z.object({
  ticketId: z.string().uuid(),
});
export type ResolveEmergencyTicketInput = z.infer<typeof resolveEmergencyTicketSchema>;
