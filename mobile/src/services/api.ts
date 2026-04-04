import {
  AIChatLog,
  AdminKpi,
  AssistanceRequest,
  AssistanceRatingEntry,
  AvailabilityTrainerPermission,
  ChurnRiskEntry,
  CreateMeasurementPayload,
  DirectMessage,
  GeneralNotification,
  GeneratedRoutine,
  GymAvailabilityDay,
  GymAvailabilityExceptionDay,
  GymAvailabilityPermissions,
  GymAvailabilityTemplateDay,
  EmergencyTicket,
  ExerciseStrengthProgress,
  GymSettings,
  Measurement,
  MembershipReport,
  MembershipReportExportInfo,
  MessageThread,
  ProgressSummary,
  RoutineCheckin,
  RoutineExerciseCheckin,
  StrengthLog,
  StrengthProgressSummary,
  ThreadWithMessages,
  TrainerPresenceStatus,
  TrainerPresenceSummaryDay,
  UserRole,
} from "../types/api";

const API_BASE_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  timeoutMs?: number;
}

const REQUEST_TIMEOUT_MS = 15000;
const AI_TIMEOUT_MS = 60000;
const AUTH_TIMEOUT_MS = 90000; // longer for cold starts on Render free tier

async function requestWithRetry<T>(path: string, options: RequestOptions = {}, retries = 1): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (err) {
    const isNetworkError =
      err instanceof Error &&
      (err.message.includes("Tiempo de espera") ||
        err.message.includes("No se pudo conectar") ||
        err.message.includes("Failed to fetch"));
    if (retries > 0 && isNetworkError) {
      await new Promise((r) => setTimeout(r, 2000));
      return requestWithRetry<T>(path, options, retries - 1);
    }
    throw err;
  }
}

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
  ping: () =>
    request<unknown>("/health", { timeoutMs: 90000 }).catch(() => null),

  login: (payload: { identifier: string; password: string; requestedRole: UserRole }) =>
    requestWithRetry<{
      token?: string;
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: "admin" | "trainer" | "member";
        gymId: string;
        username?: string;
        mustChangePassword?: boolean;
      };
      requiresGymSelection?: boolean;
      selectorToken?: string;
      gyms?: Array<{
        userId: string;
        gymId: string;
        gymName: string;
        username?: string;
        role: "admin" | "trainer" | "member";
      }>;
    }>("/auth/login", {
      method: "POST",
      body: payload,
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  selectGym: (payload: { selectorToken: string; userId: string }) =>
    requestWithRetry<{
      token: string;
      user: {
        id: string;
        email: string;
        fullName: string;
        role: "admin" | "trainer" | "member";
        gymId: string;
        username?: string;
        mustChangePassword?: boolean;
      };
    }>("/auth/select-gym", {
      method: "POST",
      body: payload,
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  loginWithGoogle: (payload: { idToken: string; requestedRole: UserRole }) =>
    requestWithRetry<{
      token: string;
      user: {
        id: string;
        email: string;
        fullName: string;
        role: "admin" | "trainer" | "member";
        gymId: string;
        mustChangePassword?: boolean;
      };
    }>("/auth/oauth/google", {
      method: "POST",
      body: payload,
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  loginWithApple: (payload: { idToken: string; requestedRole: UserRole }) =>
    requestWithRetry<{
      token: string;
      user: {
        id: string;
        email: string;
        fullName: string;
        role: "admin" | "trainer" | "member";
        gymId: string;
        mustChangePassword?: boolean;
      };
    }>("/auth/oauth/apple", {
      method: "POST",
      body: payload,
      timeoutMs: AUTH_TIMEOUT_MS,
    }),

  changeTemporaryPassword: (token: string, payload: { newPassword: string }) =>
    request<{ message: string }>("/auth/change-temporary-password", {
      method: "POST",
      token,
      body: payload,
    }),

  requestEmailVerification: (payload: { email: string }) =>
    request<{ message: string; devToken?: string }>("/auth/request-email-verification", {
      method: "POST",
      body: payload,
    }),

  verifyEmail: (payload: { token: string }) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: payload,
    }),

  forgotPassword: (payload: { email: string }) =>
    request<{ message: string; devToken?: string }>("/auth/forgot-password", {
      method: "POST",
      body: payload,
    }),

  resetPassword: (payload: { token: string; newPassword: string }) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: payload,
    }),

  register: (payload: {
    gym?: { name: string; ownerName: string; address?: string; phone?: string };
    user: { email: string; password: string; fullName: string; role: "admin" | "trainer" | "member" };
  }, token?: string) =>
    requestWithRetry<{ message: string; user: { id: string; email: string; fullName: string; role: "admin" | "trainer" | "member"; gymId: string } }>("/auth/register", {
      method: "POST",
      token,
      body: payload,
      timeoutMs: AUTH_TIMEOUT_MS,
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

  updateAvatar: (id: string, token: string, imageBase64: string) =>
    request<{ message: string; avatarUrl: string }>(`/users/${id}/avatar`, {
      method: "PATCH",
      token,
      body: { imageBase64 },
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
        membershipStartAt?: string | null;
        membershipEndAt?: string | null;
      }>;
    }>(`/users${role ? `?role=${role}` : ""}`, {
      token,
    }),

  createUser: (
    token: string,
    body: {
      email: string;
      password: string;
      fullName: string;
      role: "trainer" | "member";
      membershipMonths?: number;
      paymentMethod?: "card" | "transfer" | "cash";
      paymentAmount?: number;
      profile?: {
        gender: "female" | "male" | "prefer_not_to_say";
        goal: string;
        availabilityDays: number;
        level: number;
      };
      initialMeasurement?: {
        weightKg?: number;
        bodyFatPct?: number;
        muscleMass?: number;
        chestCm?: number;
        waistCm?: number;
        hipCm?: number;
        armCm?: number;
      };
    }
  ) =>
    request<{
      message: string;
      user: { id: string; email: string; fullName: string; role: string; createdAt: string };
      warning?: string;
      devVerificationToken?: string;
    }>("/users", {
      method: "POST",
      token,
      body,
    }),

  deactivateUser: (id: string, token: string) =>
    request<{ message: string; user: { id: string; isActive: boolean } }>(`/users/${id}/deactivate`, {
      method: "PATCH",
      token,
    }),

  reactivateUser: (id: string, token: string) =>
    request<{ message: string; user: { id: string; isActive: boolean } }>(`/users/${id}/reactivate`, {
      method: "PATCH",
      token,
    }),

  renewMembership: (
    id: string,
    token: string,
    body: {
      membershipMonths: number;
      paymentMethod: "card" | "transfer" | "cash";
      paymentAmount: number;
    }
  ) =>
    request<{ message: string; user: { id: string; membershipStartAt: string; membershipEndAt: string } }>(
      `/users/${id}/renew-membership`,
      {
        method: "PATCH",
        token,
        body,
      }
    ),

  deleteUser: (id: string, token: string) =>
    request<{ message: string; user: { id: string; role: string } }>(`/users/${id}`, {
      method: "DELETE",
      token,
    }),

  getAvailabilityToday: (token: string) =>
    request<{ availability: GymAvailabilityDay }>("/availability/today", {
      token,
    }),

  getAvailabilityNext7Days: (token: string) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const fromDate = `${yyyy}-${mm}-${dd}`;
    return request<{ days: GymAvailabilityDay[] }>(`/availability/next-7-days?from=${fromDate}`, {
      token,
    });
  },

  getAvailabilityTemplate: (token: string) =>
    request<{ template: GymAvailabilityTemplateDay[]; permissions: GymAvailabilityPermissions }>(
      "/availability/template",
      {
        token,
      },
    ),

  getAvailabilityExceptions: (token: string, from: string, to: string) =>
    request<{ exceptions: GymAvailabilityExceptionDay[] }>(
      `/availability/exceptions?from=${from}&to=${to}`,
      {
        token,
      },
    ),

  saveAvailabilityTemplateDay: (
    token: string,
    dayOfWeek: GymAvailabilityTemplateDay["dayOfWeek"],
    body: {
      isOpen: boolean;
      opensAt?: string | null;
      closesAt?: string | null;
      opensAtSecondary?: string | null;
      closesAtSecondary?: string | null;
    },
  ) =>
    request<{ message: string; day: GymAvailabilityTemplateDay }>(`/availability/template/${dayOfWeek}`, {
      method: "PUT",
      token,
      body,
    }),

  saveAvailabilityException: (
    token: string,
    date: string,
    body: {
      isClosed: boolean;
      opensAt?: string | null;
      closesAt?: string | null;
      opensAtSecondary?: string | null;
      closesAtSecondary?: string | null;
      note?: string | null;
    },
  ) =>
    request<{ message: string; exception: GymAvailabilityExceptionDay }>(
      `/availability/exceptions/${date}`,
      {
        method: "PUT",
        token,
        body,
      },
    ),

  deleteAvailabilityException: (token: string, date: string) =>
    request<{ message: string }>(`/availability/exceptions/${date}`, {
      method: "DELETE",
      token,
    }),

  listAvailabilityPermissionTrainers: (token: string) =>
    request<{ trainers: AvailabilityTrainerPermission[] }>("/availability/permissions/trainers", {
      token,
    }),

  grantAvailabilityWrite: (token: string, userId: string) =>
    request<{ message: string; trainer: AvailabilityTrainerPermission }>(
      `/availability/permissions/${userId}/grant`,
      {
        method: "POST",
        token,
      },
    ),

  revokeAvailabilityWrite: (token: string, userId: string) =>
    request<{ message: string; trainer: AvailabilityTrainerPermission }>(
      `/availability/permissions/${userId}/grant`,
      {
        method: "DELETE",
        token,
      },
    ),

  grantNotificationsSend: (token: string, userId: string) =>
    request<{ message: string; trainer: AvailabilityTrainerPermission }>(
      `/availability/permissions/${userId}/notifications/grant`,
      {
        method: "POST",
        token,
      },
    ),

  revokeNotificationsSend: (token: string, userId: string) =>
    request<{ message: string; trainer: AvailabilityTrainerPermission }>(
      `/availability/permissions/${userId}/notifications/grant`,
      {
        method: "DELETE",
        token,
      },
    ),

  getMyTrainerPresenceStatus: (token: string) =>
    request<{ status: TrainerPresenceStatus }>("/operations/trainer-presence/me", {
      token,
    }),

  updateMyTrainerPresenceStatus: (token: string, body: { isActive: boolean }) =>
    request<{ message: string; status: TrainerPresenceStatus }>("/operations/trainer-presence/me", {
      method: "PUT",
      token,
      body,
    }),

  getTrainerPresenceSummary: (token: string, days = 7) =>
    request<{ days: TrainerPresenceSummaryDay[]; generatedAt: string }>(
      `/operations/trainer-presence?days=${days}`,
      {
        token,
      },
    ),

  getActiveTrainers: (token: string) =>
    request<{ trainers: { id: string; fullName: string; avatarUrl: string | null }[] }>(
      `/operations/active-trainers`,
      { token },
    ),

  getMembershipReport: (token: string, days: number, specificDate?: string) =>
    request<{ report: MembershipReport }>(
      `/operations/membership-report?days=${days}${
        specificDate ? `&specificDate=${encodeURIComponent(specificDate)}` : ""
      }`,
      {
        token,
      },
    ),

  exportMembershipReport: (token: string, body: { days: number; specificDate?: string }) =>
    request<{ message: string; report: MembershipReport; export: MembershipReportExportInfo }>(
      "/operations/membership-report/export",
      {
        method: "POST",
        token,
        body,
      },
    ),

  sendMembershipReport: (
    token: string,
    body: {
      days: number;
      specificDate?: string;
      delivery: "linked" | "custom";
      email?: string;
    },
  ) =>
    request<{ message: string; report: MembershipReport; recipient: string }>(
      "/operations/membership-report/send",
      {
        method: "POST",
        token,
        body,
      },
    ),

  getGymSettings: (token: string) =>
    request<{ settings: GymSettings }>("/operations/settings", {
      token,
    }),

  updateGymSettings: (token: string, body: { currency: "USD" | "CRC" }) =>
    request<{ message: string; settings: GymSettings }>("/operations/settings", {
      method: "PUT",
      token,
      body,
    }),

  /* ─── Notifications ──────────────────────────────────────── */

  registerPushToken: (token: string, body: { token: string; platform: string }) =>
    request<{ ok: boolean }>("/notifications/push-token", {
      method: "POST",
      token,
      body,
    }),

  unregisterPushToken: (token: string, body: { token: string }) =>
    request<{ ok: boolean }>("/notifications/push-token", {
      method: "DELETE",
      token,
      body,
    }),

  sendGeneralNotification: (
    token: string,
    body: { title: string; body: string; category: string },
  ) =>
    request<{ ok: boolean; notification: GeneralNotification }>("/notifications/general", {
      method: "POST",
      token,
      body,
    }),

  listGeneralNotifications: (token: string) =>
    request<{ notifications: GeneralNotification[] }>("/notifications/general", {
      method: "GET",
      token,
    }),

  getMyThreads: (token: string) =>
    request<{ threads: MessageThread[] }>("/notifications/threads", {
      method: "GET",
      token,
    }),

  getOrCreateThread: (token: string, body: { targetUserId?: string } = {}) =>
    request<ThreadWithMessages>("/notifications/threads", {
      method: "POST",
      token,
      body,
    }),

  getThreadMessages: (token: string, threadId: string) =>
    request<{ messages: DirectMessage[] }>(`/notifications/threads/${encodeURIComponent(threadId)}`, {
      method: "GET",
      token,
    }),

  sendThreadMessage: (token: string, threadId: string, body: { body: string }) =>
    request<{ message: DirectMessage }>(`/notifications/threads/${encodeURIComponent(threadId)}/messages`, {
      method: "POST",
      token,
      body,
    }),

  createEmergencyTicket: (
    token: string,
    body: { category: "harassment" | "injury" | "accident" | "incident"; description: string },
  ) =>
    request<{ ticket: EmergencyTicket }>("/notifications/tickets", {
      method: "POST",
      token,
      body,
    }),

  listEmergencyTickets: (token: string) =>
    request<{ tickets: EmergencyTicket[] }>("/notifications/tickets", {
      method: "GET",
      token,
    }),

  resolveEmergencyTicket: (token: string, ticketId: string) =>
    request<{ message: string; ticket: { id: string; status: string; resolvedAt: string | null } }>(
      `/notifications/tickets/${encodeURIComponent(ticketId)}/resolve`,
      {
        method: "POST",
        token,
      },
    ),

  /* ─── Assistance Requests ────────────────────────────────── */

  createAssistanceRequest: (token: string, body: { description: string }) =>
    request<{ message: string; request: AssistanceRequest }>("/assistance", {
      method: "POST",
      token,
      body,
    }),

  listMyAssistanceRequests: (token: string, limit = 20, offset = 0) =>
    request<{ requests: AssistanceRequest[]; total: number }>(
      `/assistance/my?limit=${limit}&offset=${offset}`,
      { token },
    ),

  listAssistanceRequests: (token: string, status?: string) =>
    request<{ requests: AssistanceRequest[]; total: number }>(
      `/assistance${status ? `?status=${status}` : ""}`,
      { token },
    ),

  assignAssistanceRequest: (token: string, id: string) =>
    request<{ message: string; request: Pick<AssistanceRequest, "id" | "status" | "trainerId" | "assignedAt"> }>(
      `/assistance/${encodeURIComponent(id)}/assign`,
      { method: "PATCH", token },
    ),

  resolveAssistanceRequest: (token: string, id: string, body: { resolution: string }) =>
    request<{ message: string; request: Pick<AssistanceRequest, "id" | "status" | "resolution" | "resolvedAt"> }>(
      `/assistance/${encodeURIComponent(id)}/resolve`,
      { method: "PATCH", token, body },
    ),

  rateAssistanceRequest: (token: string, id: string, body: { rating: number }) =>
    request<{ message: string; request: Pick<AssistanceRequest, "id" | "status" | "rating" | "ratedAt"> }>(
      `/assistance/${encodeURIComponent(id)}/rate`,
      { method: "PATCH", token, body },
    ),

  listAssistanceRatings: (token: string) =>
    request<{ ratings: AssistanceRatingEntry[]; total: number }>("/assistance/ratings", { token }),

  getKpi: (token: string) =>
    request<{ kpi: AdminKpi }>("/operations/kpi", { token }),

  getChurnRisk: (token: string) =>
    request<{ churnRisk: ChurnRiskEntry[] }>("/operations/churn-risk", { token }),
};
