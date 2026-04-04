import { z } from "zod";

export const createAssistanceRequestSchema = z.object({
  description: z.string().min(1, "La descripcion no puede estar vacia").max(500),
});

export const resolveAssistanceRequestSchema = z.object({
  resolution: z.string().min(5, "La resolucion debe tener al menos 5 caracteres").max(500),
});

export const rateAssistanceRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export const listAssistanceRequestsSchema = z.object({
  status: z.enum(["CREATED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "RATED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateAssistanceRequestInput = z.infer<typeof createAssistanceRequestSchema>;
export type ResolveAssistanceRequestInput = z.infer<typeof resolveAssistanceRequestSchema>;
export type RateAssistanceRequestInput = z.infer<typeof rateAssistanceRequestSchema>;
export type ListAssistanceRequestsQuery = z.infer<typeof listAssistanceRequestsSchema>;
