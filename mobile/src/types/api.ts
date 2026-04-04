export type UserRole = "admin" | "trainer" | "member";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  gymId: string;
  username?: string;
  mustChangePassword?: boolean;
}

export interface LoginSuccessResponse {
  token: string;
  user: AuthUser;
}

export interface GymSelectionOption {
  userId: string;
  gymId: string;
  gymName: string;
  username?: string;
  role: UserRole;
}

export interface LoginGymSelectionResponse {
  requiresGymSelection: true;
  selectorToken: string;
  gyms: GymSelectionOption[];
}

export type LoginResponse = LoginSuccessResponse | LoginGymSelectionResponse;

export interface Profile {
  id: string;
  userId: string;
  gender?: "female" | "male" | "prefer_not_to_say";
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

export type GymDayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface GymAvailabilityActor {
  userId: string;
  fullName: string;
}

export interface GymAvailabilityDay {
  date: string;
  dayOfWeek: GymDayOfWeek;
  status: "open" | "closed";
  source: "template" | "exception" | "default_closed";
  note: string | null;
  opensAt: string | null;
  closesAt: string | null;
  opensAtSecondary: string | null;
  closesAtSecondary: string | null;
  updatedBy: GymAvailabilityActor | null;
  updatedAt: string | null;
}

export interface GymAvailabilityTemplateDay {
  dayOfWeek: GymDayOfWeek;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  opensAtSecondary: string | null;
  closesAtSecondary: string | null;
  updatedBy: GymAvailabilityActor | null;
  updatedAt: string | null;
}

export interface GymAvailabilityExceptionDay {
  date: string;
  dayOfWeek: GymDayOfWeek;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  opensAtSecondary: string | null;
  closesAtSecondary: string | null;
  note: string | null;
  updatedBy: GymAvailabilityActor | null;
  updatedAt: string | null;
}

export interface GymAvailabilityPermissions {
  canWrite: boolean;
  canGrant: boolean;
}

export interface AvailabilityTrainerPermission {
  id: string;
  fullName: string;
  email: string;
  hasAvailabilityWrite: boolean;
  hasNotificationsSend?: boolean;
  grantedAt: string | null;
  grantedBy: GymAvailabilityActor | null;
  notificationsGrantedAt?: string | null;
  notificationsGrantedBy?: GymAvailabilityActor | null;
}

export interface TrainerPresenceSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
  durationMinutes: number;
}

export interface TrainerPresenceStatus {
  isActive: boolean;
  activeSession: {
    id: string;
    startedAt: string;
    endedAt: null;
  } | null;
  sessionsToday: TrainerPresenceSession[];
}

export interface TrainerPresenceSummaryDay {
  date: string;
  activeCount: number;
  trainers: Array<{
    trainerId: string;
    trainerName: string;
    sessions: Array<{
      id: string;
      startedAt: string;
      endedAt: string | null;
      isActive: boolean;
      startHour: number;
      endHour: number;
    }>;
  }>;
}

export interface MembershipReportRow {
  id: string;
  date: string;
  type: "activation" | "renewal";
  typeLabel: string;
  memberName: string;
  paymentMethod: "card" | "transfer" | "cash";
  paymentMethodLabel: string;
  actorName: string;
  amount: number;
  currency: "USD" | "CRC";
}

export interface MembershipReportSummary {
  rowCount: number;
  totalAmount: number;
  totalRegistrations: number;
  totalRenewals: number;
  currency: "USD" | "CRC";
}

export interface MembershipReport {
  periodDays: number;
  reportLabel?: string;
  specificDate?: string | null;
  currency: "USD" | "CRC";
  generatedAt: string;
  summary: MembershipReportSummary;
  rows: MembershipReportRow[];
  csv: string;
}

export interface MembershipReportExportInfo {
  id: string;
  createdAt: string;
  fileName: string;
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

/* ─── Notifications ──────────────────────────────────────── */

export type NotificationCategory = "schedule" | "pricing" | "event" | "maintenance" | "general";

export interface GeneralNotification {
  id: string;
  gymId: string;
  sentByUserId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  createdAt: string;
}

export interface GymAdminEntry {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

/* ─── Trainer Routines ──────────────────────────────────── */

export interface TrainerExercise {
  id: string;
  name: string;
  originalName: string | null;
  reps: number;
  sets: number;
  restSeconds: number;
  tips: string | null;
  sortOrder: number;
}

export interface TrainerRoutineTemplate {
  id: string;
  trainerId: string;
  gymId: string;
  name: string;
  purpose: string;
  createdAt: string;
  updatedAt: string;
  exercises: TrainerExercise[];
}

export interface TrainerAssignedRoutine {
  id: string;
  trainerId: string;
  memberId: string;
  gymId: string;
  templateId: string | null;
  name: string;
  purpose: string;
  aiWarnings: string[] | null;
  isActive: boolean;
  createdAt: string;
  exercises: TrainerExercise[];
}

export interface ExerciseInput {
  name: string;
  originalName?: string;
  reps: number;
  sets: number;
  restSeconds: number;
  tips?: string;
  sortOrder?: number;
}

export interface MessageThread {
  id: string;
  adminUserId: string;
  adminName: string;
  memberId: string;
  memberName: string;
  expiresAt: string;
  createdAt: string;
  lastMessage: {
    body: string;
    senderUserId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
}

export interface DirectMessage {
  id: string;
  senderUserId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface ThreadWithMessages {
  thread: Omit<MessageThread, "lastMessage" | "unreadCount"> & {
    memberName: string;
  };
  messages: DirectMessage[];
}

export interface GymSettings {
  currency: "USD" | "CRC";
}

/* ─── KPI / Churn Risk ───────────────────────────────────── */

export interface AdminKpi {
  totalActiveMembers: number;
  membersWithActiveMembership: number;
  newUsersToday: number;
  activeTrainersNow: number;
  today: {
    registrations: number;
    renewals: number;
    revenue: number;
  };
  week: {
    registrations: number;
    renewals: number;
    revenue: number;
  };
  currency: "USD" | "CRC";
}

export interface ChurnRiskEntry {
  userId: string;
  fullName: string;
  lastActivity: string | null;
  daysSince: number | null;
}

/* ─── Assistance Requests ────────────────────────────────── */

export type AssistanceRequestStatus =
  | "CREATED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "RATED";

export interface AssistanceRequest {
  id: string;
  gymId: string;
  memberId: string;
  trainerId: string | null;
  status: AssistanceRequestStatus;
  type: string | null;
  description: string;
  resolution: string | null;
  rating: number | null;
  ratedAt: string | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberName: string | null;
}

export interface AssistanceRatingEntry {
  id: string;
  memberId: string;
  trainerId: string | null;
  rating: number | null;
  ratedAt: string | null;
  description: string;
  resolution: string | null;
  memberName: string;
  trainerName: string | null;
}

export interface EmergencyTicket {
  id: string;
  category: "harassment" | "injury" | "accident" | "incident";
  description: string;
  status: "open" | "resolved";
  reporterUserId: string;
  reporterName: string;
  resolvedByUserId: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
