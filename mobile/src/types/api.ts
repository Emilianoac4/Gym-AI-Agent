export type UserRole = "admin" | "trainer" | "member";

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

export interface RoutineCheckin {
  id: string;
  weekStart: string;
  sessionDay: string;
  completedAt: string;
}

export interface RoutineExerciseCheckin {
  id: string;
  weekStart: string;
  sessionDay: string;
  exerciseName: string;
  completedAt: string;
}

export interface RoutineExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
}

export interface RoutineSession {
  day: string;
  focus: string;
  duration_minutes: number;
  exercises: RoutineExercise[];
}

export interface GeneratedRoutine {
  routine_name: string;
  duration_weeks: number;
  weekly_sessions: number;
  sessions: RoutineSession[];
  progression_tips: string[];
  nutrition_notes: string;
}

export interface StrengthLog {
  id: string;
  exerciseName: string;
  loadKg: number;
  originalLoad?: {
    value: number;
    unit: "kg" | "lb";
  };
  reps: number | null;
  sets: number | null;
  performedAt: string;
}

export interface StrengthWeeklyHistoryPoint {
  weekStart: string;
  latestLoadKg: number;
  bestLoadKg: number;
  logsCount: number;
  lastPerformedAt: string;
}

export interface ExerciseStrengthProgress {
  exerciseName: string;
  logsCount: number;
  latestLoadKg: number;
  firstLoadKg: number;
  bestLoadKg: number;
  absoluteChangeKg: number;
  percentChange: number | null;
  estimatedOneRM: number | null;
  lastPerformedAt: string;
  weeklyHistory: StrengthWeeklyHistoryPoint[];
}

export interface StrengthProgressSummary {
  totalLogs: number;
  activeExercises: number;
  improvingExercises: number;
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
