import OpenAI from "openai";
import { AuditAction, PrismaClient } from "@prisma/client";
import { createAuditLog } from "../../utils/audit";
import {
  AI_OUT_OF_SCOPE_REPLY,
  appendMedicalDisclaimer,
  classifyAiUserIntent,
  validateAiOutputPolicy,
} from "./ai.guardrails";

const prisma = new PrismaClient();
const ROUTINE_CHECKIN_PREFIX = "ROUTINE_CHECKIN::";
const STRENGTH_LOG_PREFIX = "STRENGTH_LOG::";
const EXERCISE_CHECKIN_PREFIX = "EXERCISE_CHECKIN::";

type RoutineExercise = {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
};

type RoutineSession = {
  day: string;
  focus: string;
  duration_minutes: number;
  exercises: RoutineExercise[];
};

type GeneratedRoutine = {
  routine_name: string;
  duration_weeks: number;
  weekly_sessions: number;
  sessions: RoutineSession[];
  progression_tips?: string[];
  nutrition_notes?: string;
};

type UserRoutineContext = {
  goal: string;
  experienceLevel: string;
  availability: string;
  injuries?: string;
  medicalConditions?: string;
};

function formatIsoDate(date: Date | null | undefined): string {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function normalizeDay(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function estimatedOneRM(loadKg: number, reps: number | null): number | null {
  if (!reps || reps <= 0) {
    return null;
  }

  const value = loadKg * (1 + reps / 30);
  return Number(value.toFixed(2));
}

function parseRoutinePayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

class AIService {
  private openai: OpenAI;
  private readonly chatContextTurns: number;
  private readonly chatContextMaxChars: number;
  private readonly chatMaxTokens: number;
  private readonly models: {
    routine: string;
    chat: string;
    tip: string;
    nutrition: string;
  };
  private static readonly CHAT_SYSTEM_PROMPT = `
Eres Tuco, el coach de inteligencia artificial de tu gimnasio.
Mision y limites:
- Permitido: programacion de entrenamientos, tecnica de ejercicios, habitos de gym, recuperacion, sueno, hidratacion, coaching de estilo de vida saludable, nutricion deportiva para objetivos de fitness.
- No permitido: legal, finanzas, programacion de software, examenes academicos, romance, politica, hacking/ciberseguridad, contenido sexual explicito, violencia, y cualquier tarea no relacionada con el gimnasio.
- Seguridad medica: no diagnostiques enfermedades ni recetes medicamentos. Si el usuario pide un diagnostico medico, suggiere consultar a un profesional licenciado.
- Si se te proporciona contexto estructurado del usuario como progreso de fuerza, mediciones, rutina o membresia, usalo directamente para personalizar la respuesta. Si faltan datos, dilo con precision; no afirmes que no tienes acceso si el contexto ya fue proporcionado.

Si una solicitud esta fuera de alcance, recuerdala amablemente y redirige al tema de fitness/gym.
Responde en el mismo idioma que el usuario.
Adapta el tono por usuario: cercano y tecnico por defecto; si notas preferencias claras de estilo en su historial, manten consistencia.
La personalizacion de tono y memoria es implicita: no pidas al usuario configurar sliders o ajustes manuales de personalidad.
Mantén las respuestas practicas, concisas y de menos de 220 palabras.
  `;

  private static readonly DEFAULT_CHAT_CONTEXT_TURNS = 12;
  private static readonly MAX_CHAT_CONTEXT_TURNS = 20;
  private static readonly DEFAULT_CHAT_CONTEXT_MAX_CHARS = 500;
  private static readonly MIN_CHAT_CONTEXT_MAX_CHARS = 120;
  private static readonly DEFAULT_CHAT_MAX_TOKENS = 800;

  private toPositiveInt(
    value: string | undefined,
    fallback: number,
    options?: { min?: number; max?: number }
  ): number {
    const parsed = Number.parseInt(value || "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    const min = options?.min;
    const max = options?.max;

    if (typeof min === "number" && parsed < min) {
      return min;
    }

    if (typeof max === "number" && parsed > max) {
      return max;
    }

    return parsed;
  }

  private trimForContext(text: string): string {
    return text.trim().slice(0, this.chatContextMaxChars);
  }

  private async getRecentChatContext(userId: string) {
    try {
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const history = await prisma.aIChatLog.findMany({
        where: {
          userId,
          type: "CHAT",
          createdAt: {
            gte: fromDate,
          },
          NOT: [
            {
              userMessage: {
                startsWith: ROUTINE_CHECKIN_PREFIX,
              },
            },
            {
              userMessage: {
                startsWith: STRENGTH_LOG_PREFIX,
              },
            },
            {
              userMessage: {
                startsWith: EXERCISE_CHECKIN_PREFIX,
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: this.chatContextTurns,
      });

      const ordered = [...history].reverse();

      return ordered.flatMap((entry) => {
        const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
        const previousUserMessage = this.trimForContext(entry.userMessage || "");
        const previousAssistantMessage = this.trimForContext(entry.aiResponse || "");

        if (previousUserMessage) {
          messages.push({ role: "user", content: previousUserMessage });
        }

        if (previousAssistantMessage) {
          messages.push({ role: "assistant", content: previousAssistantMessage });
        }

        return messages;
      });
    } catch (error) {
      if (this.isLogTableMissing(error)) {
        return [];
      }

      throw error;
    }
  }

  private async saveGuardrailAudit(userId: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      await createAuditLog({
        actorUserId: userId,
        action: AuditAction.platform_action,
        resourceType: "ai_guardrail",
        resourceId: `${Date.now()}`,
        metadata,
      });
    } catch (error) {
      console.warn("Failed to persist AI guardrail audit", error);
    }
  }

  private async getUserChatContext(userId: string): Promise<string> {
    try {
      const [user, latestMeasurement, strengthLogs, latestRoutineLog] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            fullName: true,
            membershipStatus: true,
            membershipEndAt: true,
            profile: {
              select: {
                goal: true,
                experienceLvl: true,
                injuries: true,
                availability: true,
                medicalConds: true,
                heightCm: true,
              },
            },
          },
        }),
        prisma.measurement.findFirst({
          where: { userId },
          orderBy: { date: "desc" },
          select: {
            date: true,
            weightKg: true,
            bodyFatPct: true,
            muscleMass: true,
            chestCm: true,
            waistCm: true,
            hipCm: true,
            armCm: true,
          },
        }),
        prisma.routineExerciseLog.findMany({
          where: {
            userId,
            loadKg: { not: null },
          },
          orderBy: [{ performedAt: "desc" }],
          take: 60,
          select: {
            exerciseName: true,
            loadKg: true,
            reps: true,
            sets: true,
            performedAt: true,
            normalizedExerciseName: true,
          },
        }),
        prisma.aIChatLog.findFirst({
          where: { userId, type: "ROUTINE_GENERATION" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, aiResponse: true },
        }),
      ]);

      if (!user) {
        return "";
      }

      const lines: string[] = [];
      if (user.fullName?.trim()) {
        lines.push(`User name: ${user.fullName.trim()}`);
      }
      if (user.profile?.goal?.trim()) {
        lines.push(`Primary goal: ${user.profile.goal.trim()}`);
      }
      if (user.profile?.experienceLvl?.trim()) {
        lines.push(`Experience level: ${user.profile.experienceLvl.trim()}`);
      }
      if (user.profile?.availability?.trim()) {
        lines.push(`Availability: ${user.profile.availability.trim()}`);
      }
      if (typeof user.profile?.heightCm === "number") {
        lines.push(`Height: ${user.profile.heightCm} cm`);
      }
      if (user.profile?.injuries?.trim()) {
        lines.push(`Injuries/limitations: ${user.profile.injuries.trim()}`);
      }
      if (user.profile?.medicalConds?.trim()) {
        lines.push(`Medical considerations already declared in profile: ${user.profile.medicalConds.trim()}`);
      }
      if (user.membershipStatus) {
        lines.push(`Membership status: ${user.membershipStatus}`);
      }
      if (user.membershipEndAt) {
        lines.push(`Membership valid until: ${formatIsoDate(user.membershipEndAt)}`);
      }

      if (latestMeasurement) {
        const measurementParts = [
          `Latest body measurement date: ${formatIsoDate(latestMeasurement.date)}`,
          typeof latestMeasurement.weightKg === "number" ? `weight ${latestMeasurement.weightKg} kg` : null,
          typeof latestMeasurement.bodyFatPct === "number" ? `body fat ${latestMeasurement.bodyFatPct}%` : null,
          typeof latestMeasurement.muscleMass === "number" ? `muscle mass ${latestMeasurement.muscleMass}` : null,
          typeof latestMeasurement.chestCm === "number" ? `chest ${latestMeasurement.chestCm} cm` : null,
          typeof latestMeasurement.waistCm === "number" ? `waist ${latestMeasurement.waistCm} cm` : null,
          typeof latestMeasurement.hipCm === "number" ? `hip ${latestMeasurement.hipCm} cm` : null,
          typeof latestMeasurement.armCm === "number" ? `arm ${latestMeasurement.armCm} cm` : null,
        ].filter((value): value is string => Boolean(value));

        if (measurementParts.length > 0) {
          lines.push(measurementParts.join(", "));
        }
      }

      if (strengthLogs.length > 0) {
        const bestByExercise = new Map<
          string,
          {
            exerciseName: string;
            loadKg: number;
            reps: number | null;
            sets: number | null;
            performedAt: Date;
          }
        >();

        for (const log of strengthLogs) {
          const key = log.normalizedExerciseName;
          const currentBest = bestByExercise.get(key);
          if (!currentBest || (log.loadKg ?? 0) > currentBest.loadKg) {
            bestByExercise.set(key, {
              exerciseName: log.exerciseName,
              loadKg: log.loadKg ?? 0,
              reps: log.reps,
              sets: log.sets,
              performedAt: log.performedAt,
            });
          }
        }

        const personalRecords = Array.from(bestByExercise.values())
          .sort((left, right) => right.performedAt.getTime() - left.performedAt.getTime())
          .slice(0, 8)
          .map((record) => {
            const repInfo = record.reps ? ` x ${record.reps} reps` : "";
            const setInfo = record.sets ? ` (${record.sets} sets)` : "";
            return `${record.exerciseName}: ${record.loadKg} kg${repInfo}${setInfo} on ${formatIsoDate(record.performedAt)}`;
          });

        if (personalRecords.length > 0) {
          lines.push(`Known strength records: ${personalRecords.join(" | ")}`);
        }

        const recentStrength = strengthLogs
          .slice(0, 5)
          .map((log) => {
            const repInfo = log.reps ? ` x ${log.reps} reps` : "";
            return `${log.exerciseName}: ${log.loadKg ?? 0} kg${repInfo} on ${formatIsoDate(log.performedAt)}`;
          });

        if (recentStrength.length > 0) {
          lines.push(`Recent strength activity: ${recentStrength.join(" | ")}`);
        }
      } else {
        lines.push("Known strength records: no strength logs registered yet.");
      }

      if (latestRoutineLog?.aiResponse) {
        const parsedRoutine = parseRoutinePayload(latestRoutineLog.aiResponse) as GeneratedRoutine | null;
        if (parsedRoutine?.routine_name && Array.isArray(parsedRoutine.sessions)) {
          const sessionSummary = parsedRoutine.sessions
            .slice(0, 4)
            .map((session) => `${session.day}: ${session.focus}`)
            .join(" | ");
          lines.push(`Latest routine: ${parsedRoutine.routine_name} (${parsedRoutine.weekly_sessions} sessions/week). Sessions: ${sessionSummary}`);
        }
      }

      return lines.join("\n");
    } catch (error) {
      console.warn("Failed to load user chat context", error);
      return "";
    }
  }

  private async buildDeterministicStrengthReply(userId: string, userMessage: string): Promise<string | null> {
    const normalizedMessage = normalizeText(userMessage);
    const asksForStrengthRecord =
      /(record|marca personal|maximo|maxima|peso max|1rm|rm)/.test(normalizedMessage) &&
      /(press|banca|bench|sentadilla|squat|peso muerto|deadlift|hombro|militar|remo)/.test(normalizedMessage);

    const asksMeasurements =
      /(peso|medicion|medidas|grasa corporal|muscular|cintura|cadera|brazo|imc|composicion)/.test(normalizedMessage);

    const asksMembership =
      /(membresia|vencimiento|vencer|expira|dias de membresia|estado de membresia)/.test(normalizedMessage);

    const asksWeeklyAdherence =
      /(adherencia|constancia|racha|cumpli|cumplimiento|semanal|avance semanal|entrene esta semana)/.test(normalizedMessage);

    if (!asksForStrengthRecord && !asksMeasurements && !asksMembership && !asksWeeklyAdherence) {
      return null;
    }

    if (asksMembership) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          membershipStatus: true,
          membershipEndAt: true,
        },
      });

      if (!user) {
        return "No pude encontrar tu perfil para consultar tu estado de membresia.";
      }

      const endDateText = user.membershipEndAt ? formatIsoDate(user.membershipEndAt) : "sin fecha registrada";
      return `Tu estado de membresia actual es ${user.membershipStatus ?? "INACTIVE"} y la fecha de vencimiento registrada es ${endDateText}.`;
    }

    if (asksMeasurements) {
      const measurement = await prisma.measurement.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
        select: {
          date: true,
          weightKg: true,
          bodyFatPct: true,
          muscleMass: true,
          waistCm: true,
          hipCm: true,
          armCm: true,
          chestCm: true,
        },
      });

      if (!measurement) {
        return "Si tengo acceso a tus datos, pero no hay mediciones corporales registradas aun.";
      }

      const parts = [
        typeof measurement.weightKg === "number" ? `peso ${measurement.weightKg} kg` : null,
        typeof measurement.bodyFatPct === "number" ? `grasa corporal ${measurement.bodyFatPct}%` : null,
        typeof measurement.muscleMass === "number" ? `masa muscular ${measurement.muscleMass}` : null,
        typeof measurement.chestCm === "number" ? `pecho ${measurement.chestCm} cm` : null,
        typeof measurement.waistCm === "number" ? `cintura ${measurement.waistCm} cm` : null,
        typeof measurement.hipCm === "number" ? `cadera ${measurement.hipCm} cm` : null,
        typeof measurement.armCm === "number" ? `brazo ${measurement.armCm} cm` : null,
      ].filter((value): value is string => Boolean(value));

      return `Tu ultima medicion registrada es del ${formatIsoDate(measurement.date)}: ${parts.join(", ") || "sin detalle de campos"}.`;
    }

    if (asksWeeklyAdherence) {
      const [latestRoutineLog, completedSessions] = await Promise.all([
        prisma.aIChatLog.findFirst({
          where: { userId, type: "ROUTINE_GENERATION" },
          orderBy: { createdAt: "desc" },
          select: { aiResponse: true },
        }),
        prisma.routineSessionLog.findMany({
          where: {
            userId,
            completedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          select: { id: true, completedAt: true },
        }),
      ]);

      const routine = latestRoutineLog?.aiResponse
        ? (parseRoutinePayload(latestRoutineLog.aiResponse) as GeneratedRoutine | null)
        : null;
      const planned = typeof routine?.weekly_sessions === "number" ? routine.weekly_sessions : null;
      const done = completedSessions.length;

      if (planned === null) {
        return `Esta semana tienes ${done} sesion(es) completadas en los ultimos 7 dias. Aun no tengo una rutina activa para comparar meta semanal.`;
      }

      const adherencePct = planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0;
      return `En los ultimos 7 dias completaste ${done} de ${planned} sesiones planificadas. Tu adherencia semanal estimada es ${adherencePct}%.`;
    }

    const logs = await prisma.routineExerciseLog.findMany({
      where: {
        userId,
        loadKg: { not: null },
      },
      orderBy: [{ performedAt: "desc" }],
      take: 200,
      select: {
        exerciseName: true,
        normalizedExerciseName: true,
        loadKg: true,
        reps: true,
        sets: true,
        performedAt: true,
      },
    });

    if (logs.length === 0) {
      return "Si tengo acceso a tus datos, pero todavia no veo marcas de fuerza registradas en tu historial. Registra tus cargas para poder darte tu record exacto.";
    }

    const bestByExercise = new Map<
      string,
      {
        exerciseName: string;
        loadKg: number;
        reps: number | null;
        sets: number | null;
        performedAt: Date;
      }
    >();

    for (const log of logs) {
      const key = log.normalizedExerciseName;
      const currentBest = bestByExercise.get(key);
      if (!currentBest || (log.loadKg ?? 0) > currentBest.loadKg) {
        bestByExercise.set(key, {
          exerciseName: log.exerciseName,
          loadKg: log.loadKg ?? 0,
          reps: log.reps,
          sets: log.sets,
          performedAt: log.performedAt,
        });
      }
    }

    const exerciseAliasMap: Array<{ label: string; aliases: string[] }> = [
      { label: "press de banca", aliases: ["press banca", "press de banca", "bench", "bench press", "banca"] },
      { label: "sentadilla", aliases: ["sentadilla", "squat"] },
      { label: "peso muerto", aliases: ["peso muerto", "deadlift"] },
    ];

    const targetExercise = exerciseAliasMap.find((entry) =>
      entry.aliases.some((alias) => normalizedMessage.includes(alias)),
    );

    if (targetExercise) {
      const record = Array.from(bestByExercise.values()).find((item) => {
        const exercise = normalizeText(item.exerciseName);
        return targetExercise.aliases.some((alias) => exercise.includes(alias));
      });

      if (!record) {
        return `Si tengo acceso a tus datos. Aun no aparece una marca registrada de ${targetExercise.label}. Si quieres, te digo tus mejores marcas actuales en otros ejercicios.`;
      }

      const oneRm = estimatedOneRM(record.loadKg, record.reps);
      const repsText = record.reps ? ` x ${record.reps} reps` : "";
      const setsText = record.sets ? ` (${record.sets} series)` : "";
      const rmText = oneRm ? ` Tu 1RM estimado es ${oneRm} kg.` : "";

      return `Tu mejor marca registrada en ${targetExercise.label} es ${record.loadKg} kg${repsText}${setsText}, del ${formatIsoDate(record.performedAt)}.${rmText}`;
    }

    const topRecords = Array.from(bestByExercise.values())
      .sort((left, right) => right.performedAt.getTime() - left.performedAt.getTime())
      .slice(0, 3)
      .map((item) => {
        const repsText = item.reps ? ` x ${item.reps} reps` : "";
        return `${item.exerciseName}: ${item.loadKg} kg${repsText}`;
      });

    if (topRecords.length === 0) {
      return "Si tengo acceso a tus datos, pero todavia no hay registros suficientes para calcular marcas personales.";
    }

    return `Si tengo acceso a tus datos. Tus mejores marcas registradas recientemente son: ${topRecords.join(" | ")}.`;
  }

  private isLogTableMissing(error: unknown): boolean {
    const candidate = error as {
      code?: string;
      message?: string;
      meta?: { modelName?: string };
    };

    if (candidate?.code === "P2021") {
      return true;
    }

    const message = candidate?.message || "";
    return (
      message.includes('table `public.ai_chat_logs` does not exist') ||
      message.includes('relation "ai_chat_logs" does not exist')
    );
  }

  private async saveLogSafely(data: {
    userId: string;
    type: "CHAT" | "ROUTINE_GENERATION" | "NUTRITION_GENERATION" | "DAILY_TIP";
    userMessage: string;
    aiResponse: string;
  }): Promise<void> {
    try {
      await prisma.aIChatLog.create({ data });
    } catch (error) {
      if (this.isLogTableMissing(error)) {
        console.warn("AI log table missing. Skipping log persistence.");
        return;
      }

      // Do not break user-facing AI response when persistence fails unexpectedly.
      console.error("Failed to persist AI chat log", error);
    }
  }

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.openai = new OpenAI({ apiKey });
    this.chatContextTurns = this.toPositiveInt(
      process.env.OPENAI_CHAT_CONTEXT_TURNS,
      AIService.DEFAULT_CHAT_CONTEXT_TURNS,
      { min: 1, max: AIService.MAX_CHAT_CONTEXT_TURNS }
    );
    this.chatContextMaxChars = this.toPositiveInt(
      process.env.OPENAI_CHAT_CONTEXT_MAX_CHARS,
      AIService.DEFAULT_CHAT_CONTEXT_MAX_CHARS,
      { min: AIService.MIN_CHAT_CONTEXT_MAX_CHARS }
    );
    this.chatMaxTokens = this.toPositiveInt(
      process.env.OPENAI_CHAT_MAX_TOKENS,
      AIService.DEFAULT_CHAT_MAX_TOKENS,
      { min: 200 }
    );
    // Use configurable models so deployments do not break when a model is unavailable.
    this.models = {
      routine: process.env.OPENAI_MODEL_ROUTINE || "gpt-4o-mini",
      chat: process.env.OPENAI_MODEL_CHAT || "gpt-4o-mini",
      tip: process.env.OPENAI_MODEL_TIP || "gpt-4o-mini",
      nutrition: process.env.OPENAI_MODEL_NUTRITION || "gpt-4o-mini",
    };
  }

  private extractProviderError(error: unknown): Error {
    const candidate = error as {
      message?: string;
      error?: { message?: string; code?: string };
      status?: number;
    };

    const providerMessage = candidate?.error?.message || candidate?.message;
    const providerCode = candidate?.error?.code;
    const providerStatus = candidate?.status;

    return new Error(
      `AI provider error${providerStatus ? ` (${providerStatus})` : ""}${providerCode ? ` [${providerCode}]` : ""}: ${providerMessage || "Unknown provider error"}`,
    );
  }

  /**
   * Generate a personalized workout routine based on user profile
   */
  async generateRoutine(
    userId: string,
    userContext: {
      goal: string;
      experienceLevel: string;
      availability: string;
      preferredDays?: string[];
      injuries?: string;
      medicalConditions?: string;
    }
  ): Promise<string> {
    const DAY_MAP: Record<string, string> = {
      monday: "Lunes",
      tuesday: "Martes",
      wednesday: "Miércoles",
      thursday: "Jueves",
      friday: "Viernes",
      saturday: "Sábado",
      sunday: "Domingo",
    };

    const mappedDays =
      Array.isArray(userContext.preferredDays) && userContext.preferredDays.length > 0
        ? userContext.preferredDays.map((d) => DAY_MAP[d] ?? d)
        : null;

    const levelNorm = userContext.experienceLevel.toLowerCase();
    const durationByLevel =
      levelNorm.includes("principiante") || levelNorm.includes("beginner")
        ? 45
        : levelNorm.includes("basico") || levelNorm.includes("basic")
        ? 50
        : levelNorm.includes("avanzado") || levelNorm.includes("advanced")
        ? 75
        : levelNorm.includes("elite")
        ? 90
        : 60; // intermedio / default

    const weeklySessions = mappedDays
      ? mappedDays.length
      : userContext.availability.includes("5")
      ? 5
      : userContext.availability.includes("4")
      ? 4
      : userContext.availability.includes("3")
      ? 3
      : 3;

    const daysInstruction = mappedDays
      ? `- Dias de entrenamiento del usuario: ${mappedDays.join(", ")}
IMPORTANTE: Las sesiones DEBEN usar EXACTAMENTE esos dias en ese orden como campo "day". No uses otros dias.`
      : `- Disponibilidad semanal: ${userContext.availability}
La IA puede elegir libremente los dias de entrenamiento.`;

    const prompt = `
Eres Tuco, el coach de IA de tu gimnasio, creando una rutina de entrenamiento personalizada.

Perfil del usuario:
- Objetivo: ${userContext.goal}
- Nivel de experiencia: ${userContext.experienceLevel}
${daysInstruction}
- Condiciones medicas: ${userContext.medicalConditions || "Ninguna"}
- Lesiones actuales: ${userContext.injuries || "Ninguna"}

GUIA DE VOLUMEN E INTENSIDAD POR NIVEL (aplica la que corresponda al usuario):
- Principiante: 4-5 ejercicios por sesion | series 2-3 | repeticiones 10-15 | descanso 90-120s | enfoque en tecnica y aprendizaje de patron de movimiento | cargas bajas
- Basico:       5-6 ejercicios por sesion | series 3   | repeticiones 8-12  | descanso 75-90s  | consolidar tecnica, introducir progresion lineal | cargas moderadas-bajas
- Intermedio:   6-7 ejercicios por sesion | series 3-4 | repeticiones 6-12  | descanso 60-90s  | mezcla de compuestos y accesorios, periodizacion basica | cargas moderadas
- Avanzado:     7-8 ejercicios por sesion | series 4   | repeticiones 4-10  | descanso 60-90s  | periodizacion, supersets opcionales | cargas altas
- Elite:        8-10 ejercicios por sesion | series 4-5 | repeticiones 3-8  | descanso 45-90s  | tecnicas de intensidad avanzadas (drop sets, cluster sets, tempo) | cargas maximas

REQUISITOS:
1. Genera una rutina completa con ejercicios para TODAS las sesiones semanales (${weeklySessions} sesiones)
2. Selecciona la cantidad de ejercicios por sesion segun el nivel del usuario y el enfoque del dia (dias de grupo muscular grande pueden tener mas ejercicios que dias de grupo pequeno)
3. Incluye consejos de progresion practicos y notas de nutricion
4. La duracion de cada sesion debe ser de ${durationByLevel} minutos aprox.
5. Todo en espanol (nombres de ejercicios, enfoque, notas, consejos)

Genera SOLO JSON valido (sin markdown, sin explicaciones):
{
  "routine_name": "string en espanol",
  "duration_weeks": 12,
  "weekly_sessions": ${weeklySessions},
  "sessions": [
    {
      "day": "Lunes",
      "focus": "string en espanol",
      "duration_minutes": ${durationByLevel},
      "exercises": [
        {"name": "string", "sets": number, "reps": "string", "rest_seconds": number, "notes": "string en espanol"}
      ]
    }
  ],
  "progression_tips": ["string en espanol"],
  "nutrition_notes": "string en espanol"
}

Personaliza la rutina completamente segun el perfil. Devuelve SOLO JSON valido.
    `;

    let response;
    try {
      response = await this.openai.chat.completions.create({
        model: this.models.routine,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });
    } catch (error) {
      throw this.extractProviderError(error);
    }

    const rawContent = (response.choices[0]?.message?.content || "").trim();

    // Strip potential markdown code fences (```json ... ``` or ``` ... ```)
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const content = codeBlockMatch?.[1]?.trim() ?? rawContent;

    // Validate that response contains valid JSON structure with sessions
    try {
      const parsed = JSON.parse(content);
      if (!parsed.sessions || parsed.sessions.length === 0) {
        throw new Error("Generated routine has no sessions");
      }
      if (parsed.sessions.some((s: any) => !s.exercises || s.exercises.length === 0)) {
        throw new Error("Some sessions have no exercises");
      }
    } catch (error) {
      // Surface as AI provider error so it returns 502 with a user-friendly message
      const detail = error instanceof Error ? error.message : "Invalid JSON from AI";
      throw new Error(`AI provider error: No se pudo generar la rutina completa. Por favor intenta de nuevo. (${detail})`);
    }

    await this.saveLogSafely({
      userId,
      type: "ROUTINE_GENERATION",
      userMessage: prompt.substring(0, 500),
      aiResponse: content,
    });

    return content;
  }

  async regenerateRoutineDay(
    userId: string,
    userContext: {
      goal: string;
      experienceLevel: string;
      availability: string;
      injuries?: string;
      medicalConditions?: string;
    },
    currentRoutine: GeneratedRoutine,
    sessionDay: string
  ): Promise<GeneratedRoutine> {
    const targetSession = currentRoutine.sessions.find(
      (session) => normalizeDay(session.day) === normalizeDay(sessionDay)
    );

    if (!targetSession) {
      throw new Error("Session day not found in routine");
    }

    const targetExerciseCount = Math.max(targetSession.exercises.length, 5);

    const prompt = `
Eres Tuco, el coach de IA de tu gimnasio. Debes regenerar SOLO un dia de rutina manteniendo el estilo del plan actual.

Contexto del usuario:
- Objetivo: ${userContext.goal}
- Nivel: ${userContext.experienceLevel}
- Disponibilidad: ${userContext.availability}
- Lesiones: ${userContext.injuries || "Ninguna"}
- Condiciones medicas: ${userContext.medicalConditions || "Ninguna"}

Dia a regenerar: ${targetSession.day}
Enfoque del dia: ${targetSession.focus}
Duracion objetivo: ${targetSession.duration_minutes} minutos

Responde SOLO JSON valido con este esquema:
{
  "day": "${targetSession.day}",
  "focus": "string en espanol",
  "duration_minutes": number,
  "exercises": [
    {"name":"string","sets":number,"reps":"string","rest_seconds":number,"notes":"string"}
  ]
}

Reglas:
- Entrega exactamente ${targetExerciseCount} ejercicios.
- Todo en espanol.
- No cambies el dia.
    `;

    let response;
    try {
      response = await this.openai.chat.completions.create({
        model: this.models.routine,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1200,
      });
    } catch (error) {
      throw this.extractProviderError(error);
    }

    const rawDayContent = (response.choices[0]?.message?.content || "").trim();
    const dayCodeBlockMatch = rawDayContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const dayContent = dayCodeBlockMatch?.[1]?.trim() ?? rawDayContent;

    let newSession: RoutineSession;
    try {
      newSession = JSON.parse(dayContent) as RoutineSession;
      if (!Array.isArray(newSession.exercises) || newSession.exercises.length < 1) {
        throw new Error("Invalid session exercises");
      }
      if (newSession.exercises.length < targetExerciseCount) {
        throw new Error("Insufficient exercises returned");
      }
      newSession.exercises = newSession.exercises.slice(0, targetExerciseCount);
      newSession.day = targetSession.day;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid JSON from AI";
      throw new Error(`AI provider error: No se pudo regenerar el dia de rutina. Por favor intenta de nuevo. (${detail})`);
    }

    const updatedSessions = currentRoutine.sessions.map((session) =>
      normalizeDay(session.day) === normalizeDay(sessionDay) ? newSession : session
    );

    const updatedRoutine: GeneratedRoutine = {
      ...currentRoutine,
      sessions: updatedSessions,
    };

    await this.saveLogSafely({
      userId,
      type: "ROUTINE_GENERATION",
      userMessage: `REGENERATE_DAY::${sessionDay}`,
      aiResponse: JSON.stringify(updatedRoutine),
    });

    return updatedRoutine;
  }

  async addRoutineDay(
    userId: string,
    userContext: UserRoutineContext,
    currentRoutine: GeneratedRoutine,
    day: string,
    focus: string
  ): Promise<GeneratedRoutine> {
    const existingDaysSummary = currentRoutine.sessions
      .map((s) => `- ${s.day}: ${s.focus} (${s.duration_minutes} min, ${s.exercises.length} ejercicios)`)
      .join("\n");

    const prompt = `
Eres Tuco, el coach de IA de tu gimnasio. El usuario quiere agregar un nuevo dia de entrenamiento a su rutina actual.

Contexto del usuario:
- Objetivo: ${userContext.goal}
- Nivel: ${userContext.experienceLevel}
- Disponibilidad: ${userContext.availability}
- Lesiones: ${userContext.injuries || "Ninguna"}
- Condiciones medicas: ${userContext.medicalConditions || "Ninguna"}

Dias ya existentes en la rutina:
${existingDaysSummary}

Nuevo dia a crear:
- Dia de la semana: ${day}
- Enfoque deseado por el usuario: ${focus}

Responde SOLO JSON valido con este esquema (sin markdown):
{
  "day": "${day}",
  "focus": "string en espanol",
  "duration_minutes": number,
  "exercises": [
    {"name":"string","sets":number,"reps":"string","rest_seconds":number,"notes":"string"}
  ]
}

Reglas:
- Crea entre 4 y 6 ejercicios apropiados para el enfoque indicado y el nivel del usuario.
- El enfoque debe complementar los dias ya existentes cuando sea posible.
- Usa el enfoque indicado por el usuario como guia principal.
- Todo en espanol.
- No incluyas markdown ni explicaciones, solo el JSON.
    `;

    let response;
    try {
      response = await this.openai.chat.completions.create({
        model: this.models.routine,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1200,
      });
    } catch (error) {
      throw this.extractProviderError(error);
    }

    const rawContent = (response.choices[0]?.message?.content || "").trim();
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const cleanContent = codeBlockMatch?.[1]?.trim() ?? rawContent;

    let newSession: RoutineSession;
    try {
      newSession = JSON.parse(cleanContent) as RoutineSession;
      if (!Array.isArray(newSession.exercises) || newSession.exercises.length < 1) {
        throw new Error("Invalid session exercises");
      }
      newSession.day = day;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid JSON from AI";
      throw new Error(
        `AI provider error: No se pudo generar el nuevo dia de entrenamiento. Por favor intenta de nuevo. (${detail})`
      );
    }

    const updatedRoutine: GeneratedRoutine = {
      ...currentRoutine,
      weekly_sessions: currentRoutine.weekly_sessions + 1,
      sessions: [...currentRoutine.sessions, newSession],
    };

    await this.saveLogSafely({
      userId,
      type: "ROUTINE_GENERATION",
      userMessage: `ADD_ROUTINE_DAY::${day}`,
      aiResponse: JSON.stringify(updatedRoutine),
    });

    return updatedRoutine;
  }

  async addExerciseToRoutine(
    userId: string,
    userContext: UserRoutineContext,
    currentRoutine: GeneratedRoutine,
    sessionDay: string,
    manualExercise?: { name: string; sets: number; reps: string }
  ): Promise<GeneratedRoutine> {
    const targetSession = currentRoutine.sessions.find(
      (session) => normalizeDay(session.day) === normalizeDay(sessionDay)
    );

    if (!targetSession) {
      throw new Error("Session day not found in routine");
    }

    let newExercise: RoutineExercise;

    if (manualExercise) {
      newExercise = {
        name: manualExercise.name.trim(),
        sets: manualExercise.sets,
        reps: manualExercise.reps.trim(),
        rest_seconds: 60,
        notes: "Agregado manualmente por el usuario.",
      };
    } else {
      const existingNames = targetSession.exercises.map((e) => e.name).join(", ");

      const prompt = `
Eres Tuco, el coach de IA de tu gimnasio. El usuario quiere agregar UN nuevo ejercicio a su sesion de entrenamiento.

Contexto del usuario:
- Objetivo: ${userContext.goal}
- Nivel: ${userContext.experienceLevel}
- Lesiones: ${userContext.injuries || "Ninguna"}
- Condiciones medicas: ${userContext.medicalConditions || "Ninguna"}

Sesion: ${targetSession.day} (${targetSession.focus})
Ejercicios ya presentes en la sesion: ${existingNames}

Genera UN ejercicio nuevo que complemente esta sesion, diferente a los ya existentes.

Responde SOLO JSON valido:
{
  "name": "string en espanol",
  "sets": number,
  "reps": "string",
  "rest_seconds": number,
  "notes": "string en espanol"
}
`;

      let response;
      try {
        response = await this.openai.chat.completions.create({
          model: this.models.routine,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 300,
        });
      } catch (error) {
        throw this.extractProviderError(error);
      }

      const rawContent = (response.choices[0]?.message?.content || "").trim();
      const codeBlock = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const content = codeBlock?.[1]?.trim() ?? rawContent;

      try {
        newExercise = JSON.parse(content) as RoutineExercise;
        if (!newExercise.name || typeof newExercise.sets !== "number") {
          throw new Error("Invalid exercise structure");
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Invalid JSON from AI";
        throw new Error(`AI provider error: No se pudo generar el ejercicio. Por favor intenta de nuevo. (${detail})`);
      }
    }

    const updatedSessions = currentRoutine.sessions.map((session) => {
      if (normalizeDay(session.day) !== normalizeDay(sessionDay)) {
        return session;
      }
      return {
        ...session,
        exercises: [...session.exercises, newExercise],
      };
    });

    const updatedRoutine: GeneratedRoutine = {
      ...currentRoutine,
      sessions: updatedSessions,
    };

    await this.saveLogSafely({
      userId,
      type: "ROUTINE_GENERATION",
      userMessage: `ADD_EXERCISE::${sessionDay}::${manualExercise ? "manual" : "ai"}`,
      aiResponse: JSON.stringify(updatedRoutine),
    });

    return updatedRoutine;
  }

  async replaceRoutineExercise(
    userId: string,
    userContext: UserRoutineContext,
    currentRoutine: GeneratedRoutine,
    sessionDay: string,
    exerciseName: string,
    reason?: string,
    replacementExercise?: RoutineExercise
  ): Promise<GeneratedRoutine> {
    const targetSession = currentRoutine.sessions.find(
      (session) => normalizeDay(session.day) === normalizeDay(sessionDay)
    );

    if (!targetSession) {
      throw new Error("Session day not found in routine");
    }

    let replacement: RoutineExercise;

    if (replacementExercise) {
      replacement = {
        name: replacementExercise.name,
        sets: replacementExercise.sets,
        reps: replacementExercise.reps,
        rest_seconds: replacementExercise.rest_seconds,
        notes: replacementExercise.notes || "Seleccionado manualmente por el usuario.",
      };
    } else {
      const prompt = `
Eres Tuco, el coach de IA de tu gimnasio. Debes proponer UN ejercicio alternativo para reemplazar otro ejercicio.

Contexto usuario:
- Objetivo: ${userContext.goal}
- Nivel: ${userContext.experienceLevel}
- Lesiones: ${userContext.injuries || "Ninguna"}
- Condiciones medicas: ${userContext.medicalConditions || "Ninguna"}

Sesion: ${targetSession.day} (${targetSession.focus})
Ejercicio a reemplazar: ${exerciseName}
Motivo (si existe): ${reason || "No especificado"}

Responde SOLO JSON valido:
{
  "name": "string",
  "sets": number,
  "reps": "string",
  "rest_seconds": number,
  "notes": "string en espanol"
}
`;

      let response;
      try {
        response = await this.openai.chat.completions.create({
          model: this.models.routine,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        });
      } catch (error) {
        throw this.extractProviderError(error);
      }

      const rawReplContent = (response.choices[0]?.message?.content || "").trim();
      const replCodeBlock = rawReplContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const replContent = replCodeBlock?.[1]?.trim() ?? rawReplContent;
      try {
        replacement = JSON.parse(replContent) as RoutineExercise;
        if (!replacement.name || typeof replacement.sets !== "number") {
          throw new Error("Invalid replacement exercise");
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Invalid JSON from AI";
        throw new Error(`AI provider error: No se pudo recomendar un ejercicio de reemplazo. Por favor intenta de nuevo. (${detail})`);
      }
    }

    const updatedSessions = currentRoutine.sessions.map((session) => {
      if (normalizeDay(session.day) !== normalizeDay(sessionDay)) {
        return session;
      }

      const updatedExercises = session.exercises.map((exercise) =>
        exercise.name.trim().toLowerCase() === exerciseName.trim().toLowerCase()
          ? replacement
          : exercise
      );

      return {
        ...session,
        exercises: updatedExercises,
      };
    });

    const updatedRoutine: GeneratedRoutine = {
      ...currentRoutine,
      sessions: updatedSessions,
    };

    await this.saveLogSafely({
      userId,
      type: "ROUTINE_GENERATION",
      userMessage: `REPLACE_EXERCISE::${sessionDay}::${exerciseName}`,
      aiResponse: JSON.stringify(updatedRoutine),
    });

    return updatedRoutine;
  }

  async getRoutineExerciseAlternatives(
    userContext: UserRoutineContext,
    currentRoutine: GeneratedRoutine,
    sessionDay: string,
    exerciseName: string,
    count = 5
  ): Promise<RoutineExercise[]> {
    const targetSession = currentRoutine.sessions.find(
      (session) => normalizeDay(session.day) === normalizeDay(sessionDay)
    );

    if (!targetSession) {
      throw new Error("Session day not found in routine");
    }

    const prompt = `
Eres Tuco, el coach de IA de tu gimnasio. Debes proponer ${count} ejercicios alternativos para reemplazar uno dentro de una sesion.

Contexto usuario:
- Objetivo: ${userContext.goal}
- Nivel: ${userContext.experienceLevel}
- Lesiones: ${userContext.injuries || "Ninguna"}
- Condiciones medicas: ${userContext.medicalConditions || "Ninguna"}

Sesion: ${targetSession.day} (${targetSession.focus})
Ejercicio actual: ${exerciseName}

Responde SOLO JSON valido con este esquema exacto:
{
  "options": [
    {"name":"string","sets":number,"reps":"string","rest_seconds":number,"notes":"string en espanol"}
  ]
}

Reglas:
- Entrega exactamente ${count} opciones.
- No incluyas el ejercicio actual.
- Todo en espanol.
`;

    let response;
    try {
      response = await this.openai.chat.completions.create({
        model: this.models.routine,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 900,
      });
    } catch (error) {
      throw this.extractProviderError(error);
    }

    const rawOptContent = (response.choices[0]?.message?.content || "").trim();
    const optCodeBlock = rawOptContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const optContent = optCodeBlock?.[1]?.trim() ?? rawOptContent;
    try {
      const parsed = JSON.parse(optContent) as { options?: RoutineExercise[] };
      const options = (parsed.options || [])
        .filter((item) => item && item.name)
        .slice(0, count)
        .map((item) => ({
          name: item.name,
          sets: Number(item.sets),
          reps: String(item.reps || "10-12"),
          rest_seconds: Number(item.rest_seconds),
          notes: typeof item.notes === "string" ? item.notes : undefined,
        }));

      if (options.length === 0) {
        throw new Error("No options returned");
      }

      return options;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid JSON from AI";
      throw new Error(`AI provider error: No se pudieron generar opciones de reemplazo. Por favor intenta de nuevo. (${detail})`);
    }
  }

  /**
   * Free-form chat with AI fitness coach
   */
  async chat(
    userId: string,
    userMessage: string,
    options: { startNewConversation?: boolean } = {}
  ): Promise<string> {
    const decision = classifyAiUserIntent(userMessage);
    if (!decision.allowed) {
      await this.saveGuardrailAudit(userId, {
        stage: "input",
        decisionCode: decision.code,
        reason: decision.reason,
        userMessagePreview: userMessage.substring(0, 220),
      });

      await this.saveLogSafely({
        userId,
        type: "CHAT",
        userMessage: userMessage.substring(0, 500),
        aiResponse: AI_OUT_OF_SCOPE_REPLY,
      });

      return AI_OUT_OF_SCOPE_REPLY;
    }

    const deterministicReply = await this.buildDeterministicStrengthReply(userId, userMessage);
    if (deterministicReply) {
      const finalDeterministicReply = appendMedicalDisclaimer(deterministicReply);

      await this.saveLogSafely({
        userId,
        type: "CHAT",
        userMessage: userMessage.substring(0, 500),
        aiResponse: finalDeterministicReply.substring(0, 1000),
      });

      return finalDeterministicReply;
    }

    let response;
    try {
      const recentContext = options.startNewConversation ? [] : await this.getRecentChatContext(userId);
      const userContext = await this.getUserChatContext(userId);
      response = await this.openai.chat.completions.create({
        model: this.models.chat,
        messages: [
          { role: "system", content: AIService.CHAT_SYSTEM_PROMPT },
          ...(userContext
            ? [
                {
                  role: "system" as const,
                  content:
                    "Known user context (if relevant to the answer):\n" + userContext,
                },
              ]
            : []),
          ...recentContext,
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: this.chatMaxTokens,
      });
    } catch (error) {
      throw this.extractProviderError(error);
    }

    const content = response.choices[0]?.message?.content || "";
    const outputDecision = validateAiOutputPolicy(content);

    if (!outputDecision.allowed) {
      await this.saveGuardrailAudit(userId, {
        stage: "output",
        decisionCode: outputDecision.code,
        reason: outputDecision.reason,
        modelResponsePreview: content.substring(0, 220),
      });

      await this.saveLogSafely({
        userId,
        type: "CHAT",
        userMessage: userMessage.substring(0, 500),
        aiResponse: AI_OUT_OF_SCOPE_REPLY,
      });

      return AI_OUT_OF_SCOPE_REPLY;
    }

    const finalResponse = appendMedicalDisclaimer(content);

    await this.saveLogSafely({
      userId,
      type: "CHAT",
      userMessage: userMessage.substring(0, 500),
      aiResponse: finalResponse.substring(0, 1000),
    });

    return finalResponse;
  }

  /**
   * Generate a daily fitness tip based on user profile
   */
  async generateDailyTip(userId: string): Promise<string> {
    const prompt = `
Generate a short, motivational daily fitness tip for someone trying to build a healthier lifestyle.
Make it actionable and encouraging. Keep it under 100 words.
`;

    let response;
    try {
      response = await this.openai.chat.completions.create({
        model: this.models.tip,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 200,
      });
    } catch (error) {
      throw this.extractProviderError(error);
    }

    const content = response.choices[0]?.message?.content || "";
    const finalTip = appendMedicalDisclaimer(content);

    await this.saveLogSafely({
      userId,
      type: "DAILY_TIP",
      userMessage: "Generate daily tip",
      aiResponse: finalTip.substring(0, 1000),
    });

    return finalTip;
  }

  /**
   * Generate a personalized nutrition plan
   */
  async generateNutritionPlan(
    userId: string,
    userContext: {
      goal: string;
      dietPreferences?: string;
      medicalConditions?: string;
    }
  ): Promise<string> {
    const prompt = `
You are a certified nutrition specialist. Based on the following user profile, generate a detailed nutrition plan in JSON format.

User Context:
- Goal: ${userContext.goal}
- Diet Preferences: ${userContext.dietPreferences || "None"}
- Medical Conditions: ${userContext.medicalConditions || "None"}

Generate a JSON response with the following structure:
{
  "plan_name": "string",
  "daily_calories": number,
  "macros": {
    "protein_g": number,
    "carbs_g": number,
    "fats_g": number
  },
  "meal_plan": [
    {
      "meal": "string (Breakfast, Lunch, Dinner, Snack)",
      "options": ["string"],
      "macros": {
        "protein_g": number,
        "carbs_g": number,
        "fats_g": number
      }
    }
  ],
  "hydration_tips": "string",
  "supplement_notes": "string",
  "shopping_list": ["string"]
}

Return ONLY valid JSON.
    `;

    let response;
    try {
      response = await this.openai.chat.completions.create({
        model: this.models.nutrition,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });
    } catch (error) {
      throw this.extractProviderError(error);
    }

    const content = response.choices[0]?.message?.content || "";

    await this.saveLogSafely({
      userId,
      type: "NUTRITION_GENERATION",
      userMessage: prompt.substring(0, 500),
      aiResponse: content.substring(0, 1000),
    });

    return content;
  }
}

export const aiService = new AIService();
