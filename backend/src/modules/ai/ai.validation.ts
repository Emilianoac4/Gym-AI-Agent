import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message cannot exceed 2000 characters"),
  startNewConversation: z.boolean().optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
