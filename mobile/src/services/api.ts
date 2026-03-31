import { AIChatLog, CreateMeasurementPayload, Measurement } from "../types/api";

const API_BASE_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  token?: string;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed");
  }

  return data as T;
}

export const api = {
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: { id: string; email: string; fullName: string; role: "admin" | "member"; gymId: string } }>("/auth/login", {
      method: "POST",
      body: payload,
    }),

  register: (payload: {
    gym?: { name: string; ownerName: string; address?: string; phone?: string };
    user: { email: string; password: string; fullName: string; role: "admin" | "member" };
  }, token?: string) =>
    request<{ message: string; user: { id: string; email: string; fullName: string; role: "admin" | "member"; gymId: string } }>("/auth/register", {
      method: "POST",
      token,
      body: payload,
    }),

  getProfile: (id: string, token: string) =>
    request<{ user: { id: string; email: string; fullName: string; role: "admin" | "member"; gymId: string; createdAt: string }; profile: any }>(`/users/${id}/profile`, {
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
    }),

  askCoach: (id: string, token: string, message: string) =>
    request<{ message: string; response: string }>(`/ai/${id}/chat`, {
      method: "POST",
      token,
      body: { message },
    }),

  getChatHistory: (id: string, token: string, limit = 20) =>
    request<{ message: string; count: number; history: AIChatLog[] }>(`/ai/${id}/history?limit=${limit}`, {
      token,
    }),

  getMeasurements: (id: string, token: string) =>
    request<{ measurements: Measurement[] }>(`/users/${id}/measurements`, {
      token,
    }),

  createMeasurement: (id: string, token: string, body: CreateMeasurementPayload) =>
    request<{ message: string; measurement: Measurement }>(`/users/${id}/measurements`, {
      method: "POST",
      token,
      body,
    }),
};
