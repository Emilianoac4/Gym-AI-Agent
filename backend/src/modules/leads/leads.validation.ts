import { z } from "zod";

export const contactSalesSchema = z.object({
  gymName: z.string().min(2, "Nombre del gimnasio requerido").max(100),
  contactEmail: z.string().email("Correo de contacto inválido"),
  phone: z.string().min(6, "Teléfono requerido").max(30),
  plan: z.enum(["basic", "standard", "premium"], {
    error: "Selecciona un plan válido",
  }),
  userCount: z.enum(["1-50", "51-150", "151-300", "300+"], {
    error: "Selecciona un rango de usuarios válido",
  }),
  needs: z.string().max(1000).optional(),
});

export type ContactSalesInput = z.infer<typeof contactSalesSchema>;
