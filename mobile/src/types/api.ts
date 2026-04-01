export type UserRole = "admin" | "member";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  gymId: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Profile {
  id: string;
  userId: string;
  birthDate?: string;
  heightCm?: number;
  goal?: string;
  medicalConds?: string;
  injuries?: string;
  experienceLvl?: string;
  availability?: string;
  dietPrefs?: string;
}

export interface ApiError {
  statusCode?: number;
  message: string;
}

export interface Measurement {
  id: string;
  userId: string;
  date: string;
  weightKg?: number;
  bodyFatPct?: number;
  muscleMass?: number;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  armCm?: number;
  photoUrl?: string;
}

export interface CreateMeasurementPayload {
  date?: string;
  weightKg?: number;
  bodyFatPct?: number;
  muscleMass?: number;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  armCm?: number;
  photoUrl?: string;
}

export interface ProgressSummaryMetric {
  latest: number | null;
  weeklyChange: number | null;
  monthlyChange: number | null;
}

export interface ProgressTimelinePoint {
  id: string;
  date: string;
  weightKg?: number;
  bodyFatPct?: number;
  muscleMass?: number;
  waistCm?: number;
  armCm?: number;
}

export interface ProgressSummary {
  measurementsCount: number;
  hasMeasurementThisWeek: boolean;
  daysSinceLastMeasurement: number | null;
  weeklyCheckInStreak: number;
  nextAction: string;
  metrics: {
    weightKg: ProgressSummaryMetric;
    bodyFatPct: ProgressSummaryMetric;
    muscleMass: ProgressSummaryMetric;
    waistCm: ProgressSummaryMetric;
    armCm: ProgressSummaryMetric;
  };
  timeline: ProgressTimelinePoint[];
}

export type AIChatLogType = "CHAT" | "ROUTINE_GENERATION" | "NUTRITION_GENERATION" | "DAILY_TIP";

export interface AIChatLog {
  id: string;
  userId: string;
  type: AIChatLogType;
  userMessage: string;
  aiResponse: string;
  createdAt: string;
}
