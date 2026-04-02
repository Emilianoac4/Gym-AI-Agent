import { z } from "zod";

const dayOfWeekValues = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const scheduleBaseSchema = z.object({
  isOpen: z.boolean(),
  opensAt: z.string().regex(timeRegex, "Hora invalida. Usa HH:mm").optional().nullable(),
  closesAt: z.string().regex(timeRegex, "Hora invalida. Usa HH:mm").optional().nullable(),
  slotMinutes: z.number().int().min(15).max(240).optional().nullable(),
  capacityLabel: z.string().trim().min(1).max(40).optional().nullable(),
});

const scheduleInputSchema = scheduleBaseSchema.superRefine((value, ctx) => {
  if (!value.isOpen) {
    return;
  }

  if (!value.opensAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes indicar la hora de apertura",
      path: ["opensAt"],
    });
  }

  if (!value.closesAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes indicar la hora de cierre",
      path: ["closesAt"],
    });
  }

  if (!value.slotMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes indicar la duracion de la franja",
      path: ["slotMinutes"],
    });
  }

  if (value.opensAt && value.closesAt && value.opensAt >= value.closesAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La hora de cierre debe ser posterior a la de apertura",
      path: ["closesAt"],
    });
  }
});

export const updateAvailabilityTemplateDaySchema = z
  .object({
    dayOfWeek: z.enum(dayOfWeekValues),
  })
  .merge(scheduleBaseSchema)
  .superRefine((value, ctx) => {
    const result = scheduleInputSchema.safeParse(value);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: issue.path,
        });
      });
    }
  });

export type UpdateAvailabilityTemplateDayInput = z.infer<typeof updateAvailabilityTemplateDaySchema>;

export const updateAvailabilityTemplateWeekSchema = z
  .object({
    days: z.array(
      z
        .object({
          dayOfWeek: z.enum(dayOfWeekValues),
        })
        .merge(scheduleBaseSchema)
    ).min(1).max(7),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    value.days.forEach((day, index) => {
      const result = scheduleInputSchema.safeParse(day);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ["days", index, ...issue.path],
          });
        });
      }

      if (seen.has(day.dayOfWeek)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "No puedes repetir dias de la semana",
          path: ["days", index, "dayOfWeek"],
        });
      }

      seen.add(day.dayOfWeek);
    });
  });

export type UpdateAvailabilityTemplateWeekInput = z.infer<typeof updateAvailabilityTemplateWeekSchema>;

export const listAvailabilityExceptionsSchema = z.object({
  from: z.string().regex(dateRegex, "Fecha invalida. Usa YYYY-MM-DD"),
  to: z.string().regex(dateRegex, "Fecha invalida. Usa YYYY-MM-DD"),
});

export type ListAvailabilityExceptionsInput = z.infer<typeof listAvailabilityExceptionsSchema>;

export const availabilityDateParamsSchema = z.object({
  date: z.string().regex(dateRegex, "Fecha invalida. Usa YYYY-MM-DD"),
});

export const upsertAvailabilityExceptionSchema = z
  .object({
    date: z.string().regex(dateRegex, "Fecha invalida. Usa YYYY-MM-DD"),
    isClosed: z.boolean(),
    opensAt: z.string().regex(timeRegex, "Hora invalida. Usa HH:mm").optional().nullable(),
    closesAt: z.string().regex(timeRegex, "Hora invalida. Usa HH:mm").optional().nullable(),
    slotMinutes: z.number().int().min(15).max(240).optional().nullable(),
    capacityLabel: z.string().trim().min(1).max(40).optional().nullable(),
    note: z.string().trim().min(1).max(160).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.isClosed) {
      return;
    }

    if (!value.opensAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar la hora de apertura",
        path: ["opensAt"],
      });
    }

    if (!value.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar la hora de cierre",
        path: ["closesAt"],
      });
    }

    if (!value.slotMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar la duracion de la franja",
        path: ["slotMinutes"],
      });
    }

    if (value.opensAt && value.closesAt && value.opensAt >= value.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La hora de cierre debe ser posterior a la de apertura",
        path: ["closesAt"],
      });
    }
  });

export type UpsertAvailabilityExceptionInput = z.infer<typeof upsertAvailabilityExceptionSchema>;

export const availabilityPermissionParamsSchema = z.object({
  userId: z.string().uuid("Identificador de usuario invalido"),
});

export type AvailabilityPermissionParamsInput = z.infer<typeof availabilityPermissionParamsSchema>;