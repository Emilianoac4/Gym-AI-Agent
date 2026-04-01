import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class AIService {
  private openai: OpenAI;
  private readonly models: {
    routine: string;
    chat: string;
    tip: string;
    nutrition: string;
  };
  private static readonly OUT_OF_SCOPE_REPLY =
    "Solo puedo ayudarte con entrenamiento, nutricion deportiva, recuperacion, habitos saludables y dudas del gimnasio. Si quieres, reformula tu pregunta en ese contexto.";

  private static readonly CHAT_SYSTEM_PROMPT = `
You are GymIA, an assistant for a gym app.
Mission boundaries:
- Allowed: workout programming, exercise technique, gym habits, recovery, sleep habits, hydration, healthy lifestyle coaching, sports nutrition for fitness goals.
- Not allowed: legal, finance, programming, academic exams, romance, politics, hacking/cybersecurity, explicit sexual content, violence, and any non-gym operational tasks.
- Medical safety: do not diagnose diseases or prescribe medication. If user asks for medical diagnosis/treatment, suggest consulting a licensed professional.

If a request is out of scope, politely refuse and redirect to fitness/gym topics.
Respond in the same language as the user.
Keep answers practical, concise, and under 220 words.
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

  private static readonly IN_SCOPE_HINTS: RegExp[] = [
    /\b(gym|gimnasio|entrenamiento|rutina|ejercicio|pesas|fuerza|hipertrofia|cardio|movilidad)\b/i,
    /\b(nutricion|proteina|calorias|dieta|macros|hidratacion|suplement)\b/i,
    /\b(descanso|sueno|recuperacion|dolor muscular|estiramiento|calentamiento)\b/i,
    /\b(salud|habitos|bienestar|fitness|coach)\b/i,
  ];

  private isOutOfScope(message: string): boolean {
    const trimmed = message.trim();
    if (!trimmed) {
      return true;
    }

    if (AIService.OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      return true;
    }

    return !AIService.IN_SCOPE_HINTS.some((pattern) => pattern.test(trimmed));
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
    const prompt = `
You are an expert fitness coach creating a personalized workout routine.

User Profile:
- Goal: ${userContext.goal}
- Experience Level: ${userContext.experienceLevel}
- Weekly Availability: ${userContext.availability}
- Medical Conditions: ${userContext.medicalConditions || "None"}
- Current Injuries: ${userContext.injuries || "None"}

CRITICAL REQUIREMENTS:
1. Generate a complete, detailed routine with exercises for ALL sessions
2. Number of sessions must match weekly_sessions field
3. Each session must have AT LEAST 4 exercises with full details
4. Include practical progression tips and nutrition advice

Generate JSON ONLY (no markdown, no explanation, valid JSON only):
{
  "routine_name": "Custom ${userContext.experienceLevel} ${userContext.goal} Routine",
  "duration_weeks": 12,
  "weekly_sessions": ${userContext.availability.includes("3") ? 3 : userContext.availability.includes("4") ? 4 : userContext.availability.includes("5") ? 5 : 3},
  "sessions": [
    {
      "day": "Monday",
      "focus": "Upper Body Push",
      "duration_minutes": 60,
      "exercises": [
        {"name": "Barbell Bench Press", "sets": 4, "reps": "6-8", "rest_seconds": 120, "notes": "Focus on chest"},
        {"name": "Incline Dumbbell Press", "sets": 3, "reps": "8-10", "rest_seconds": 90, "notes": "Chest and shoulders"},
        {"name": "Cable Flyes", "sets": 3, "reps": "12-15", "rest_seconds": 60, "notes": "Isolate chest"},
        {"name": "Shoulder Press", "sets": 3, "reps": "8-10", "rest_seconds": 90, "notes": "Shoulder development"}
      ]
    }
  ],
  "progression_tips": [
    "Increase weight by 5-10% when you can complete all reps with good form",
    "Track all lifts in a journal for consistency",
    "Rest 48 hours between same muscle groups"
  ],
  "nutrition_notes": "Target 0.8-1g protein per lb of bodyweight, eat in slight caloric surplus for muscle gains"
}

Customize the routine to match the user context. Return ONLY valid JSON.
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

    const content = (response.choices[0]?.message?.content || "").trim();
    
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
      // If JSON is invalid or incomplete, throw error for user feedback
      const validationError = error instanceof Error ? error.message : "Invalid JSON from AI";
      throw new Error(`Routine generation incomplete: ${validationError}. Please try again.`);
    }
    
    await this.saveLogSafely({
      userId,
      type: "ROUTINE_GENERATION",
      userMessage: prompt.substring(0, 500),
      aiResponse: content.substring(0, 1000),
    });

    return content;
  }

  /**
   * Free-form chat with AI fitness coach
   */
  async chat(userId: string, userMessage: string): Promise<string> {
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
      response = await this.openai.chat.completions.create({
        model: this.models.chat,
        messages: [
          { role: "system", content: AIService.CHAT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 800,
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
