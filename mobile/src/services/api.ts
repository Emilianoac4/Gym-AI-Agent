import {
  AIChatLog,
  CreateMeasurementPayload,
  GeneratedRoutine,
  ExerciseStrengthProgress,
  Measurement,
  ProgressSummary,
  RoutineCheckin,
  RoutineExerciseCheckin,
  StrengthLog,
  StrengthProgressSummary,
  UserRole,
} from "../types/api";

const API_BASE_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  body?: unknown;
  timeoutMs?: number;
}

const REQUEST_TIMEOUT_MS = 15000;
const AI_TIMEOUT_MS = 60000;

function parseJsonSafe(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Tiempo de espera agotado. Revisa tu conexion e intenta de nuevo.");
    }
    throw new Error("No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.");
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  const data = parseJsonSafe(text) as { message?: string; requestId?: string } | null;
  const requestId = response.headers.get("x-request-id") ?? data?.requestId;

  if (!response.ok) {
    const baseMessage = data?.message ?? `Request failed (${response.status})`;
    const messageWithTrace = requestId ? `${baseMessage} [requestId: ${requestId}]` : baseMessage;
    throw new Error(messageWithTrace);
  }

  return data as T;
}

export const api = {
  login: (payload: { email: string; password: string; requestedRole: UserRole }) =>
    request<{ token: string; user: { id: string; email: string; fullName: string; role: "admin" | "trainer" | "member"; gymId: string } }>("/auth/login", {
      method: "POST",
      body: payload,
    }),

  loginWithGoogle: (payload: { idToken: string; requestedRole: UserRole }) =>
    request<{ token: string; user: { id: string; email: string; fullName: string; role: "admin" | "trainer" | "member"; gymId: string } }>("/auth/oauth/google", {
      method: "POST",
      body: payload,
    }),

  loginWithApple: (payload: { idToken: string; requestedRole: UserRole }) =>
    request<{ token: string; user: { id: string; email: string; fullName: string; role: "admin" | "trainer" | "member"; gymId: string } }>("/auth/oauth/apple", {
      method: "POST",
      body: payload,
    }),

  register: (payload: {
    gym?: { name: string; ownerName: string; address?: string; phone?: string };
    user: { email: string; password: string; fullName: string; role: "admin" | "trainer" | "member" };
  }, token?: string) =>
    request<{ message: string; user: { id: string; email: string; fullName: string; role: "admin" | "trainer" | "member"; gymId: string } }>("/auth/register", {
      method: "POST",
      token,
      body: payload,
    }),

  getProfile: (id: string, token: string) =>
    request<{ user: { id: string; email: string; fullName: string; role: "admin" | "trainer" | "member"; gymId: string; createdAt: string }; profile: any }>(`/users/${id}/profile`, {
      token,
    }),

  updateProfile: (id: string, token: string, body: Record<string, unknown>) =>
    request<{ message: string; profile: any }>(`/users/${id}/profile`, {
      method: "PUT",
      token,
      body,
    }),

  getRoutine: (id: string, token: string) =>
    request<{ message: string; routine: unknown }>(`/ai/${id}/routine`, {
      method: "POST",
      token,
      timeoutMs: AI_TIMEOUT_MS,
    }),

  getLatestRoutine: (id: string, token: string) =>
    request<{ message: string; routine: GeneratedRoutine; generatedAt: string }>(
      `/ai/${id}/routine/latest`,
      {
        token,
      }
    ),

  regenerateRoutineDay: (id: string, token: string, body: { sessionDay: string }) =>
    request<{ message: string; routine: GeneratedRoutine }>(`/ai/${id}/routine/regenerate-day`, {
      method: "POST",
      token,
      body,
      timeoutMs: AI_TIMEOUT_MS,
    }),

  replaceRoutineExercise: (
    id: string,
    token: string,
    body: {
      sessionDay: string;
      exerciseName: string;
      reason?: string;
      replacementExercise?: {
        name: string;
        sets: number;
        reps: string;
        rest_seconds: number;
        notes?: string;
      };
    }
  ) =>
    request<{ message: string; routine: GeneratedRoutine }>(`/ai/${id}/routine/exercises/replace`, {
      method: "POST",
      token,
      body,
      timeoutMs: AI_TIMEOUT_MS,
    }),

  getExerciseReplacementOptions: (
    id: string,
    token: string,
    body: { sessionDay: string; exerciseName: string; count?: number }
  ) =>
    request<{
      message: string;
      options: Array<{
        name: string;
        sets: number;
        reps: string;
        rest_seconds: number;
        notes?: string;
      }>;
    }>(`/ai/${id}/routine/exercises/options`, {
      method: "POST",
      token,
      body,
      timeoutMs: AI_TIMEOUT_MS,
    }),

  removeRoutineExercise: (
    id: string,
    token: string,
    body: { sessionDay: string; exerciseName: string }
  ) =>
    request<{ message: string; routine: GeneratedRoutine }>(`/ai/${id}/routine/exercises/remove`, {
      method: "POST",
      token,
      body,
    }),

  getRoutineCheckins: (id: string, token: string, days = 28) =>
    request<{
      message: string;
      count: number;
      checkins: RoutineCheckin[];
      exerciseCheckins: RoutineExerciseCheckin[];
    }>(
      `/ai/${id}/routine/checkins?days=${days}`,
      {
        token,
      }
    ),

  createRoutineCheckin: (id: string, token: string, body: { sessionDay: string; completedAt?: string }) =>
    request<{ message: string; checkin: RoutineCheckin }>(`/ai/${id}/routine/checkins`, {
      method: "POST",
      token,
      body,
    }),

  createExerciseCheckin: (
    id: string,
    token: string,
    body: { sessionDay: string; exerciseName: string; completedAt?: string }
  ) =>
    request<{ message: string; checkin: RoutineExerciseCheckin }>(
      `/ai/${id}/routine/exercises/checkins`,
      {
        method: "POST",
        token,
        body,
      }
    ),

  createStrengthLog: (
    id: string,
    token: string,
    body: {
      exerciseName: string;
      loadValue: number;
      loadUnit?: "kg" | "lb";
      reps?: number;
      sets?: number;
      performedAt?: string;
    }
  ) =>
    request<{ message: string; log: StrengthLog }>(`/ai/${id}/strength/logs`, {
      method: "POST",
      token,
      body,
    }),

  getStrengthProgress: (id: string, token: string, days = 90) =>
    request<{
      message: string;
      summary: StrengthProgressSummary;
      exercises: ExerciseStrengthProgress[];
      recentLogs: StrengthLog[];
    }>(`/ai/${id}/strength/progress?days=${days}`, {
      token,
    }),

  askCoach: (
    id: string,
    token: string,
    message: string,
    options?: { startNewConversation?: boolean }
  ) =>
    request<{ message: string; response: string }>(`/ai/${id}/chat`, {
      method: "POST",
      token,
      body: {
        message,
        startNewConversation: options?.startNewConversation ?? false,
      },
      timeoutMs: AI_TIMEOUT_MS,
    }),

  getChatHistory: (id: string, token: string, limit = 20) =>
    request<{ message: string; count: number; history: AIChatLog[] }>(`/ai/${id}/history?limit=${limit}`, {
      token,
    }),

  clearChatHistory: (id: string, token: string) =>
    request<{ message: string; deletedCount: number }>(`/ai/${id}/history`, {
      method: "DELETE",
      token,
    }),

  getMeasurements: (id: string, token: string) =>
    request<{ measurements: Measurement[] }>(`/users/${id}/measurements`, {
      token,
    }),

  getProgressSummary: (id: string, token: string) =>
    request<{ summary: ProgressSummary }>(`/users/${id}/measurements/progress`, {
      token,
    }),

  createMeasurement: (id: string, token: string, body: CreateMeasurementPayload) =>
    request<{ message: string; measurement: Measurement }>(`/users/${id}/measurements`, {
      method: "POST",
      token,
      body,
    }),

  listUsers: (token: string, role?: string) =>
    request<{
      users: Array<{
        id: string;
        email: string;
        fullName: string;
        role: string;
        createdAt: string;
        isActive: boolean;
      }>;
    }>(`/users${role ? `?role=${role}` : ""}`, {
      token,
    }),

  createUser: (
    token: string,
    body: { email: string; password: string; fullName: string; role: "trainer" | "member" }
  ) =>
    request<{
      message: string;
      user: { id: string; email: string; fullName: string; role: string; createdAt: string };
    }>("/users", {
      method: "POST",
      token,
      body,
    }),

  deactivateUser: (id: string, token: string) =>
    request<{ message: string; user: { id: string; isActive: boolean } }>(`/users/${id}`, {
      method: "DELETE",
      token,
    }),
};
