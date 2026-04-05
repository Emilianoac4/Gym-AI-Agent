import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";

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

function normalizeDay(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
  private static readonly OUT_OF_SCOPE_REPLY =
    "Solo puedo ayudarte con entrenamiento, nutricion deportiva, recuperacion, habitos saludables y dudas del gimnasio. Si quieres, reformula tu pregunta en ese contexto.";

  private static readonly CHAT_SYSTEM_PROMPT = `
Eres Tuco, el coach de inteligencia artificial de tu gimnasio.
Mision y limites:
- Permitido: programacion de entrenamientos, tecnica de ejercicios, habitos de gym, recuperacion, sueno, hidratacion, coaching de estilo de vida saludable, nutricion deportiva para objetivos de fitness.
- No permitido: legal, finanzas, programacion de software, examenes academicos, romance, politica, hacking/ciberseguridad, contenido sexual explicito, violencia, y cualquier tarea no relacionada con el gimnasio.
- Seguridad medica: no diagnostiques enfermedades ni recetes medicamentos. Si el usuario pide un diagnostico medico, suggiere consultar a un profesional licenciado.

Si una solicitud esta fuera de alcance, recuerdala amablemente y redirige al tema de fitness/gym.
Responde en el mismo idioma que el usuario.
Mantén las respuestas practicas, concisas y de menos de 220 palabras.
  `;

  private static readonly OUT_OF_SCOPE_PATTERNS: RegExp[] = [
    /\b(codigo|programacion|programar|javascript|python|sql|bug|debug|software|api)\b/i,
    /\b(hack|hacking|phishing|malware|exploit|ddos|ransomware|password)\b/i,
    /\b(crypto|bitcoin|trading|inversion|acciones|forex|impuestos|taxes|contabilidad)\b/i,
    /\b(abogado|demanda|contrato legal|ley|legal advice|lawsuit)\b/i,
    /\b(tarea|examen|homework|ensayo|thesis|tesis|resumen de libro)\b/i,
    /\b(politica|elecciones|presidente|partido politico)\b/i,
    /\b(sexo|sexual|porn|erotico|nudes)\b/i,
  ];

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
      const history = await prisma.aIChatLog.findMany({
        where: {
          userId,
          type: "CHAT",
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

  private isOutOfScope(message: string): boolean {
    const trimmed = message.trim();
    if (!trimmed) {
      return true;
    }

    return AIService.OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(trimmed));
  }

  private async getUserChatContext(userId: string): Promise<string> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          fullName: true,
          profile: {
            select: {
              goal: true,
              experienceLvl: true,
              injuries: true,
            },
          },
        },
      });

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
      if (user.profile?.injuries?.trim()) {
        lines.push(`Injuries/limitations: ${user.profile.injuries.trim()}`);
      }

      return lines.join("\n");
    } catch (error) {
      console.warn("Failed to load user chat context", error);
      return "";
    }
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
      injuries?: string;
      medicalConditions?: string;
    }
  ): Promise<string> {
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

    const weeklySessions = userContext.availability.includes("5")
      ? 5
      : userContext.availability.includes("4")
      ? 4
      : userContext.availability.includes("3")
      ? 3
      : 3;

    const prompt = `
Eres Tuco, el coach de IA de tu gimnasio, creando una rutina de entrenamiento personalizada.

Perfil del usuario:
- Objetivo: ${userContext.goal}
- Nivel de experiencia: ${userContext.experienceLevel}
- Disponibilidad semanal: ${userContext.availability}
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
    if (this.isOutOfScope(userMessage)) {
      await this.saveLogSafely({
        userId,
        type: "CHAT",
        userMessage: userMessage.substring(0, 500),
        aiResponse: AIService.OUT_OF_SCOPE_REPLY,
      });

      return AIService.OUT_OF_SCOPE_REPLY;
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

    await this.saveLogSafely({
      userId,
      type: "CHAT",
      userMessage: userMessage.substring(0, 500),
      aiResponse: content.substring(0, 1000),
    });

    return content;
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

    await this.saveLogSafely({
      userId,
      type: "DAILY_TIP",
      userMessage: "Generate daily tip",
      aiResponse: content.substring(0, 1000),
    });

    return content;
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
