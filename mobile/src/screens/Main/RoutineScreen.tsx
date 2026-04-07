import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AppCard } from "../../components/AppCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { ProgressBar } from "../../components/ProgressBar";
import { ScreenHeader } from "../../components/ScreenHeader";
import { palette } from "../../theme/palette";
import { ExerciseCard } from "../../components/ExerciseCard";
import type { ExerciseReplacement } from "../../components/ExerciseCard";
import { designSystem as ds } from "../../theme/designSystem";
import {
  formatCostaRicaDate,
  getCostaRicaDateKey,
  getCostaRicaMonthStart,
  getCostaRicaWeekStart,
  getCostaRicaWeekdayKey,
  shiftCostaRicaWeekStart,
} from "../../utils/costaRicaTime";
import {
  ExerciseStrengthProgress,
  GeneratedRoutine,
  RoutineCheckin,
  RoutineExercise,
  RoutineExerciseCheckin,
  RoutineHistorySnapshot,
  StrengthLog,
  StrengthProgressSummary,
  StrengthWeeklyHistoryPoint,
  TrainerAssignedRoutine,
} from "../../types/api";

const DAY_LABELS: Record<string, string> = {
  monday: "Lun", tuesday: "Mar", wednesday: "Mié",
  thursday: "Jue", friday: "Vie", saturday: "Sáb", sunday: "Dom",
};

function formatScheduledDays(days: string[] | null | undefined): string {
  if (!days || days.length === 0) return "Día A";
  return days.map((d) => DAY_LABELS[d] ?? d).join(" · ");
}

const DAY_TRANSLATIONS: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miercoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sabado",
  sunday: "Domingo",
};

const DAY_OFFSETS: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function getDateForDay(dayName: string, weekStart: string): string {
  const offset = DAY_OFFSETS[normalizeDayValue(dayName)];
  if (offset === undefined) return "";
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return formatCostaRicaDate(date, { day: "numeric", month: "short" }, true);
}

function shiftWeek(weekStart: string, offset: number): string {
  return shiftCostaRicaWeekStart(weekStart, offset);
}

function formatWeekLabel(weekStart: string): string {
  return formatCostaRicaDate(weekStart, {
    day: "2-digit",
    month: "short",
  }, true);
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "Sin registro";
  }

  return formatCostaRicaDate(value, {
    day: "2-digit",
    month: "short",
  });
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeExerciseValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeDayValue(value: string): string {
  const normalized = normalize(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aliases: Record<string, string> = {
    lun: "monday",
    lunes: "monday",
    mon: "monday",
    mar: "tuesday",
    martes: "tuesday",
    tue: "tuesday",
    mie: "wednesday",
    miercoles: "wednesday",
    wed: "wednesday",
    jue: "thursday",
    jueves: "thursday",
    thu: "thursday",
    vie: "friday",
    viernes: "friday",
    fri: "friday",
    sab: "saturday",
    sabado: "saturday",
    sat: "saturday",
    dom: "sunday",
    domingo: "sunday",
    sun: "sunday",
  };

  return aliases[normalized] ?? normalized;
}

function translateDay(value: string): string {
  const translated = DAY_TRANSLATIONS[normalizeDayValue(value)];
  return translated || value;
}

function parseSuggestedReps(value: string): string {
  const match = value.match(/\d+/);
  return match ? match[0] : "";
}

function getWeeklyEntry(
  progress: ExerciseStrengthProgress | undefined,
  weekStart: string
): StrengthWeeklyHistoryPoint | undefined {
  return progress?.weeklyHistory.find((item) => item.weekStart === weekStart);
}

const WEEK_HEADERS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const MONTH_LABELS = ["Jan","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const WEEK_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const AUTO_SAVE_DELAY_MS = 10000;

function buildCalMonthMatrix(monthStart: Date): Array<Date | null> {
  const start = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1));
  const firstWeekday = (start.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const result: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i++) result.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    result.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day)));
  }
  while (result.length % 7 !== 0) result.push(null);
  return result;
}

function estimateRoutineDuration(exerciseCount: number): number {
  return Math.max(exerciseCount * 8, 30);
}

function getDayKeyFromISODate(value: string): string {
  return getCostaRicaDateKey(value);
}

type LogDraft = {
  normalizedLoadText: string;
  repsValue: string;
  setsValue: string;
  submitKey: string;
};

export function RoutineScreen() {
  const { user, token } = useAuth();
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loadingRoutine, setLoadingRoutine] = useState(false);
  const [syncingCheckins, setSyncingCheckins] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<RoutineCheckin[]>([]);
  const [exerciseCheckins, setExerciseCheckins] = useState<RoutineExerciseCheckin[]>([]);
  const [savingSessionDay, setSavingSessionDay] = useState<string | null>(null);
  const [regeneratingSessionDay, setRegeneratingSessionDay] = useState<string | null>(null);
  const [removingExerciseKey, setRemovingExerciseKey] = useState<string | null>(null);
  const [replacingExerciseKey, setReplacingExerciseKey] = useState<string | null>(null);
  const [optionsLoadingKey, setOptionsLoadingKey] = useState<string | null>(null);
  const [manualReplacingKey, setManualReplacingKey] = useState<string | null>(null);
  const [openOptionsKey, setOpenOptionsKey] = useState<string | null>(null);
  const [openProgressKey, setOpenProgressKey] = useState<string | null>(null);
  const [replacementOptionsByKey, setReplacementOptionsByKey] = useState<
    Record<string, RoutineExercise[]>
  >({});
  const [activeLog, setActiveLog] = useState<{ sessionDay: string; exerciseName: string } | null>(null);
  const [logKg, setLogKg] = useState("");
  const [logUnit, setLogUnit] = useState<"kg" | "lb">("kg");
  const [logReps, setLogReps] = useState("");
  const [logSets, setLogSets] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  const [lastSavedExerciseKey, setLastSavedExerciseKey] = useState<string | null>(null);
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const [localCompletedExercises, setLocalCompletedExercises] = useState<Set<string>>(new Set());
  const [strengthSummary, setStrengthSummary] = useState<StrengthProgressSummary | null>(null);
  const [strengthByExercise, setStrengthByExercise] = useState<ExerciseStrengthProgress[]>([]);
  const [recentStrengthLogs, setRecentStrengthLogs] = useState<StrengthLog[]>([]);
  const [routineHistorySnapshots, setRoutineHistorySnapshots] = useState<RoutineHistorySnapshot[]>([]);
  const [trainerRoutines, setTrainerRoutines] = useState<TrainerAssignedRoutine[]>([]);
  const [activeTab, setActiveTab] = useState<"ai" | string>("ai"); // "ai" or routineId
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null);
  const [trainerRoutineExpanded, setTrainerRoutineExpanded] = useState<Record<string, boolean>>({});
  const [showRoutineDropdown, setShowRoutineDropdown] = useState(false);
  const [showFeatureMenu, setShowFeatureMenu] = useState(false);
  const [visibleModules, setVisibleModules] = useState({
    planSelector: true,
    weekSelector: false,
    weekSummary: true,
    calendar: false,
    addDay: false,
    notes: true,
    deleteAssigned: false,
  });
  const [showAddDayModal, setShowAddDayModal] = useState(false);
  const [addDayLoading, setAddDayLoading] = useState(false);
  const [addDayDay, setAddDayDay] = useState("monday");
  const [addDayFocus, setAddDayFocus] = useState("");
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [addExerciseSessionDay, setAddExerciseSessionDay] = useState<string | null>(null);
  const [addExerciseMode, setAddExerciseMode] = useState<"choose" | "ai" | "manual">("choose");
  const [addingExercise, setAddingExercise] = useState(false);
  const [manualExName, setManualExName] = useState("");
  const [manualExSets, setManualExSets] = useState("");
  const [manualExReps, setManualExReps] = useState("");
  const [selectedCalendarMonthIdx, setSelectedCalendarMonthIdx] = useState(1);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [showDayMarksModal, setShowDayMarksModal] = useState(false);
  const [dayDetailTab, setDayDetailTab] = useState<"summary" | "marks">("summary");

  const currentWeekStart = useMemo(() => getCostaRicaWeekStart(), []);
  const [selectedWeekStart, setSelectedWeekStart] = useState(currentWeekStart);
  const calendarMonths = useMemo(() => {
    return [
      getCostaRicaMonthStart(new Date(), -1),
      getCostaRicaMonthStart(),
      getCostaRicaMonthStart(new Date(), 1),
    ];
  }, []);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSubmittedRef = useRef<string>("");
  const autoCompleteAttemptRef = useRef<string | null>(null);
  const checkinsSyncInFlightRef = useRef<Promise<void> | null>(null);
  const [autoSaveRemainingSeconds, setAutoSaveRemainingSeconds] = useState<number | null>(null);

  const strengthMap = useMemo(() => {
    const map: Record<string, ExerciseStrengthProgress> = {};
    strengthByExercise.forEach((item) => {
      map[normalizeExerciseValue(item.exerciseName)] = item;
    });
    return map;
  }, [strengthByExercise]);

  const exerciseCompletedDateSet = useMemo(() => {
    const set = new Set<string>();
    exerciseCheckins.forEach((item) => {
      if (item.completedAt) {
        set.add(getDayKeyFromISODate(item.completedAt));
      }
    });

    recentStrengthLogs.forEach((log) => {
      if (log.performedAt) {
        set.add(getDayKeyFromISODate(log.performedAt));
      }
    });

    return set;
  }, [exerciseCheckins, recentStrengthLogs]);

  const dayExerciseCheckins = useMemo(() => {
    if (!selectedCalendarDate) {
      return [] as RoutineExerciseCheckin[];
    }

    return exerciseCheckins.filter((item) => {
      return item.completedAt ? getDayKeyFromISODate(item.completedAt) === selectedCalendarDate : false;
    });
  }, [exerciseCheckins, selectedCalendarDate]);

  const dayStrengthLogs = useMemo(() => {
    if (!selectedCalendarDate) {
      return [] as StrengthLog[];
    }

    return recentStrengthLogs.filter((log) => getDayKeyFromISODate(log.performedAt) === selectedCalendarDate);
  }, [recentStrengthLogs, selectedCalendarDate]);

  const completedExerciseNamesForSelectedDate = useMemo(() => {
    const completed = new Set<string>();

    dayExerciseCheckins.forEach((entry) => {
      completed.add(normalizeExerciseValue(entry.exerciseName));
    });

    dayStrengthLogs.forEach((entry) => {
      completed.add(normalizeExerciseValue(entry.exerciseName));
    });

    return completed;
  }, [dayExerciseCheckins, dayStrengthLogs]);

  const hasRecordedTrainingForSelectedDate = useMemo(
    () => dayExerciseCheckins.length > 0 || dayStrengthLogs.length > 0,
    [dayExerciseCheckins.length, dayStrengthLogs.length]
  );

  const completedAssignedCount = useMemo(
    () => completedExerciseNamesForSelectedDate.size,
    [completedExerciseNamesForSelectedDate]
  );

  const registeredMarksCount = useMemo(
    () => dayExerciseCheckins.length,
    [dayExerciseCheckins.length]
  );

  const todayDateKey = useMemo(() => getCostaRicaDateKey(), []);

  const todayStrengthLogBySessionExercise = useMemo(() => {
    const map: Record<string, StrengthLog> = {};

    recentStrengthLogs.forEach((log) => {
      if (getCostaRicaDateKey(log.performedAt) !== todayDateKey) {
        return;
      }

      const sessionDay = normalizeDayValue(getCostaRicaWeekdayKey(log.performedAt));
      const exerciseName = normalizeExerciseValue(log.exerciseName);
      const key = `${sessionDay}::${exerciseName}`;
      const current = map[key];

      if (!current || new Date(log.performedAt).getTime() > new Date(current.performedAt).getTime()) {
        map[key] = log;
      }
    });

    return map;
  }, [recentStrengthLogs, todayDateKey]);

  const todayDayKey = useMemo(
    () => normalizeDayValue(getCostaRicaWeekdayKey()),
    []
  );

  const todayHeaderDateLabel = useMemo(
    () => formatCostaRicaDate(new Date(), { day: "2-digit", month: "short" }, true),
    []
  );

  const buildValidLogDraft = useCallback(
    (
      exerciseName: string,
      unit: "kg" | "lb",
      loadValueRaw: string,
      repsValueRaw: string,
      setsValueRaw: string
    ): LogDraft | null => {
      const normalizedLoadText = loadValueRaw.trim();
      if (!normalizedLoadText) {
        return null;
      }

      const numeric = Number.parseFloat(normalizedLoadText);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
      }

      const repsValue = repsValueRaw.trim();
      const setsValue = setsValueRaw.trim();
      if (!repsValue || !setsValue) {
        return null;
      }

      const repsNumeric = Number.parseInt(repsValue, 10);
      const setsNumeric = Number.parseInt(setsValue, 10);
      if (
        !Number.isFinite(repsNumeric) ||
        repsNumeric <= 0 ||
        !Number.isFinite(setsNumeric) ||
        setsNumeric <= 0
      ) {
        return null;
      }

      return {
        normalizedLoadText,
        repsValue,
        setsValue,
        submitKey: `${exerciseName}::${unit}::${numeric}::${repsNumeric}::${setsNumeric}`,
      };
    },
    []
  );

  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    weeks.add(currentWeekStart);

    for (let index = 0; index < 8; index += 1) {
      weeks.add(shiftWeek(currentWeekStart, -index));
    }

    checkins.forEach((item) => weeks.add(item.weekStart));
    strengthByExercise.forEach((exercise) => {
      exercise.weeklyHistory.forEach((item) => weeks.add(item.weekStart));
    });

    return Array.from(weeks).sort((a, b) => b.localeCompare(a));
  }, [checkins, currentWeekStart, strengthByExercise]);

  useEffect(() => {
    if (!availableWeeks.includes(selectedWeekStart)) {
      setSelectedWeekStart(currentWeekStart);
    }
  }, [availableWeeks, currentWeekStart, selectedWeekStart]);

  const completedBySelectedWeek = useMemo(() => {
    const value = new Set<string>();
    checkins.forEach((item) => {
      if (item.weekStart === selectedWeekStart) {
        value.add(normalizeDayValue(item.sessionDay));
      }
    });

    if (selectedWeekStart === currentWeekStart) {
      localCompleted.forEach((item) => value.add(item));
    }

    return value;
  }, [checkins, currentWeekStart, localCompleted, selectedWeekStart]);

  const completedExercisesBySelectedWeek = useMemo(() => {
    const value = new Set<string>();

    exerciseCheckins.forEach((item) => {
      if (item.weekStart === selectedWeekStart) {
        value.add(`${normalizeDayValue(item.sessionDay)}::${normalizeExerciseValue(item.exerciseName)}`);
      }
    });

    if (selectedWeekStart === currentWeekStart) {
      localCompletedExercises.forEach((item) => value.add(item));
    }

    recentStrengthLogs.forEach((log) => {
      const weekStart = getCostaRicaWeekStart(log.performedAt);
      if (weekStart !== selectedWeekStart) {
        return;
      }

      const sessionDay = normalizeDayValue(getCostaRicaWeekdayKey(log.performedAt));
      const exerciseName = normalizeExerciseValue(log.exerciseName);
      value.add(`${sessionDay}::${exerciseName}`);
    });

    return value;
  }, [
    currentWeekStart,
    exerciseCheckins,
    localCompletedExercises,
    recentStrengthLogs,
    selectedWeekStart,
  ]);

  const previousWeekStart = useMemo(
    () => shiftWeek(selectedWeekStart, -1),
    [selectedWeekStart]
  );

  const sessionsCompleted = routine
    ? Math.min(completedBySelectedWeek.size, routine.weekly_sessions)
    : 0;

  const previousWeekCompleted = useMemo(() => {
    if (!routine) {
      return 0;
    }

    const value = new Set<string>();
    checkins.forEach((item) => {
      if (item.weekStart === previousWeekStart) {
        value.add(normalizeDayValue(item.sessionDay));
      }
    });

    return Math.min(value.size, routine.weekly_sessions);
  }, [checkins, previousWeekStart, routine]);

  const improvingThisWeek = useMemo(() => {
    return strengthByExercise.filter((exercise) => {
      const current = getWeeklyEntry(exercise, selectedWeekStart);
      const previous = getWeeklyEntry(exercise, previousWeekStart);
      return Boolean(current && previous && current.latestLoadKg > previous.latestLoadKg);
    }).length;
  }, [previousWeekStart, selectedWeekStart, strengthByExercise]);

  const selectedWeekCompletedAt = useMemo(() => {
    const map: Record<string, string> = {};
    checkins.forEach((item) => {
      if (item.weekStart === selectedWeekStart) {
        map[normalizeDayValue(item.sessionDay)] = item.completedAt;
      }
    });
    return map;
  }, [checkins, selectedWeekStart]);

  const selectedTrainerRoutine = useMemo(
    () => trainerRoutines.find((item) => item.id === activeTab) ?? null,
    [activeTab, trainerRoutines]
  );

  const routineToDelete = useMemo(() => {
    if (activeTab !== "ai" && selectedTrainerRoutine) {
      return selectedTrainerRoutine;
    }

    return trainerRoutines[0] ?? null;
  }, [activeTab, selectedTrainerRoutine, trainerRoutines]);

  const selectedAiSession = useMemo(() => {
    if (!routine) {
      return null;
    }

    const orderedSessions = [...routine.sessions].sort((a, b) => {
      const todayOffset = DAY_OFFSETS[todayDayKey] ?? 0;
      const aOffset = DAY_OFFSETS[normalizeDayValue(a.day)] ?? 0;
      const bOffset = DAY_OFFSETS[normalizeDayValue(b.day)] ?? 0;
      return ((aOffset - todayOffset + 7) % 7) - ((bOffset - todayOffset + 7) % 7);
    });

    const todaySession = orderedSessions.find(
      (session) => normalizeDayValue(session.day) === todayDayKey
    );
    if (todaySession) {
      return todaySession;
    }

    const pendingSession = orderedSessions.find(
      (session) => !completedBySelectedWeek.has(normalizeDayValue(session.day))
    );

    return pendingSession ?? orderedSessions[0] ?? null;
  }, [completedBySelectedWeek, routine, todayDayKey]);

  const executionPlan = useMemo(() => {
    if (activeTab === "ai") {
      if (!routine || !selectedAiSession) {
        return null;
      }

      return {
        key: "ai",
        sourceLabel: "Plan TUCO",
        title: "Rutina de hoy",
        subtitle: `${selectedAiSession.focus} · ${selectedAiSession.duration_minutes} min`,
        auxiliary: routine.routine_name,
        sessionDay: selectedAiSession.day,
        exercises: selectedAiSession.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          restSeconds: exercise.rest_seconds,
          tip: exercise.notes,
        })),
        allowEditing: true,
      };
    }

    if (!selectedTrainerRoutine) {
      return null;
    }

    return {
      key: selectedTrainerRoutine.id,
      sourceLabel: selectedTrainerRoutine.trainerName
        ? `Asignada por ${selectedTrainerRoutine.trainerName}`
        : "Rutina asignada",
      title: "Rutina de hoy",
      subtitle: `${selectedTrainerRoutine.name} · ${estimateRoutineDuration(selectedTrainerRoutine.exercises.length)} min`,
      auxiliary: selectedTrainerRoutine.purpose,
      sessionDay: `trainer:${selectedTrainerRoutine.id}`,
      exercises: selectedTrainerRoutine.exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: String(exercise.reps),
        restSeconds: exercise.restSeconds,
        tip: exercise.tips ?? undefined,
      })),
      allowEditing: false,
    };
  }, [activeTab, routine, selectedAiSession, selectedTrainerRoutine]);

  const executionCompletedCount = useMemo(() => {
    if (!executionPlan) {
      return 0;
    }

    return executionPlan.exercises.filter((exercise) =>
      completedExercisesBySelectedWeek.has(
        `${normalizeDayValue(executionPlan.sessionDay)}::${normalizeExerciseValue(exercise.name)}`
      )
    ).length;
  }, [completedExercisesBySelectedWeek, executionPlan]);

  const executionProgressValue = executionPlan
    ? executionCompletedCount / Math.max(executionPlan.exercises.length, 1)
    : 0;

  const executionSessionCompleted = executionPlan && activeTab === "ai"
    ? completedBySelectedWeek.has(normalizeDayValue(executionPlan.sessionDay))
    : false;

  const loadLatestRoutine = async () => {
    if (!user || !token) {
      return;
    }

    try {
      const data = await api.getLatestRoutine(user.id, token);
      setRoutine(data.routine);
      setGeneratedAt(data.generatedAt);
    } catch {
      setRoutine(null);
      setGeneratedAt(null);
    }
  };

  const loadCheckins = useCallback(async () => {
    if (!user || !token) return;

    if (checkinsSyncInFlightRef.current) {
      return checkinsSyncInFlightRef.current;
    }

    const syncPromise = (async () => {
      setSyncingCheckins(true);
      try {
        const data = await api.getRoutineCheckins(user.id, token, 84);
        setCheckins(data.checkins);
        setExerciseCheckins(data.exerciseCheckins || []);
        setLocalCompleted(new Set());
        setLocalCompletedExercises(new Set());
      } catch (error) {
        setCheckins([]);
        setExerciseCheckins([]);
        setLocalCompleted(new Set());
        setLocalCompletedExercises(new Set());
        throw error;
      } finally {
        setSyncingCheckins(false);
        checkinsSyncInFlightRef.current = null;
      }
    })();

    checkinsSyncInFlightRef.current = syncPromise;
    return syncPromise;
  }, [token, user]);

  const loadStrengthProgress = async () => {
    if (!user || !token) return;
    try {
      const data = await api.getStrengthProgress(user.id, token, 120);
      setStrengthSummary(data.summary);
      setStrengthByExercise(data.exercises);
      setRecentStrengthLogs(data.recentLogs || []);
    } catch {
      setStrengthSummary(null);
      setStrengthByExercise([]);
      setRecentStrengthLogs([]);
    }
  };

  const loadTrainerRoutine = async () => {
    if (!token) return;
    try {
      const res = await api.getMyAllTrainerRoutines(token);
      setTrainerRoutines(res.routines);
    } catch {
      setTrainerRoutines([]);
    }
  };

  const loadRoutineHistory = async () => {
    if (!user || !token) {
      return;
    }

    try {
      const data = await api.getRoutineHistory(user.id, token, 180);
      setRoutineHistorySnapshots(data.snapshots || []);
    } catch {
      setRoutineHistorySnapshots([]);
    }
  };

  const reloadAll = useCallback(async () => {
    if (!user || !token) {
      return;
    }

    try {
      await Promise.all([
        loadLatestRoutine(),
        loadRoutineHistory(),
        loadCheckins(),
        loadStrengthProgress(),
        loadTrainerRoutine(),
      ]);
    } catch (error) {
      Alert.alert(
        "No se pudo cargar la rutina",
        error instanceof Error ? error.message : "Intenta de nuevo en unos segundos."
      );
    }
  }, [token, user]);

  useFocusEffect(
    useCallback(() => {
      void reloadAll();
    }, [reloadAll])
  );

  const onDeleteTrainerRoutine = (routineId: string, routineName: string) => {
    Alert.alert(
      "Eliminar rutina",
      `¿Eliminar la rutina "${routineName}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setDeletingRoutineId(routineId);
            try {
              await api.deleteMyTrainerRoutine(token, routineId);
              setTrainerRoutines((prev) => prev.filter((r) => r.id !== routineId));
              setActiveTab("ai");
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "No se pudo eliminar la rutina.");
            } finally {
              setDeletingRoutineId(null);
            }
          },
        },
      ],
    );
  };

  const onGenerate = async () => {
    if (!user || !token) return;

    setLoadingRoutine(true);
    try {
      const data = await api.getRoutine(user.id, token);
      const raw = data.routine as string | GeneratedRoutine;
      const parsed: GeneratedRoutine = typeof raw === "string" ? JSON.parse(raw) : raw;
      setRoutine(parsed);
      setGeneratedAt(new Date().toISOString());
      await loadCheckins();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo generar la rutina"
      );
    } finally {
      setLoadingRoutine(false);
    }
  };

  const onRegenerateDay = async (sessionDay: string) => {
    if (!user || !token) return;

    setRegeneratingSessionDay(sessionDay);
    try {
      const data = await api.regenerateRoutineDay(user.id, token, { sessionDay });
      setRoutine(data.routine);
      setGeneratedAt(new Date().toISOString());
      await Promise.all([loadCheckins(), loadStrengthProgress()]);
    } catch (error) {
      Alert.alert(
        "No se pudo regenerar el dia",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setRegeneratingSessionDay(null);
    }
  };

  const handleOpenAddExercise = (sessionDay: string) => {
    setAddExerciseSessionDay(sessionDay);
    setAddExerciseMode("choose");
    setManualExName("");
    setManualExSets("");
    setManualExReps("");
    setShowAddExerciseModal(true);
  };

  const onAddExercise = async (mode: "ai" | "manual") => {
    if (!user || !token || !addExerciseSessionDay) return;
    if (mode === "manual") {
      if (!manualExName.trim()) {
        Alert.alert("Campo requerido", "Escribe el nombre del ejercicio.");
        return;
      }
      const s = parseInt(manualExSets, 10);
      if (isNaN(s) || s < 1) {
        Alert.alert("Series inválidas", "Escribe un número de series entre 1 y 20.");
        return;
      }
      if (!manualExReps.trim()) {
        Alert.alert("Campo requerido", "Escribe las repeticiones.");
        return;
      }
    }
    setAddExerciseMode(mode);
    setAddingExercise(true);
    try {
      const body: { sessionDay: string; manual?: { name: string; sets: number; reps: string } } = {
        sessionDay: addExerciseSessionDay,
      };
      if (mode === "manual") {
        body.manual = {
          name: manualExName.trim(),
          sets: parseInt(manualExSets, 10),
          reps: manualExReps.trim(),
        };
      }
      const data = await api.addExerciseToRoutine(user.id, token, body);
      setRoutine(data.routine);
      setGeneratedAt(new Date().toISOString());
      setShowAddExerciseModal(false);
      setManualExName("");
      setManualExSets("");
      setManualExReps("");
      setAddExerciseMode("choose");
    } catch (error) {
      Alert.alert(
        "No se pudo agregar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
      setAddExerciseMode(mode === "manual" ? "manual" : "choose");
    } finally {
      setAddingExercise(false);
    }
  };

  const onAddDay = async () => {
    if (!user || !token) return;
    if (!addDayFocus.trim()) {
      Alert.alert("Campo requerido", "Escribe el enfoque del nuevo día.");
      return;
    }
    setAddDayLoading(true);
    try {
      const data = await api.addRoutineDay(user.id, token, { day: addDayDay, focus: addDayFocus.trim() });
      setRoutine(data.routine);
      setGeneratedAt(new Date().toISOString());
      setShowAddDayModal(false);
      setAddDayFocus("");
      Alert.alert("Día agregado", "Tuco generó un nuevo día de entrenamiento.");
    } catch (error) {
      Alert.alert(
        "No se pudo agregar el día",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setAddDayLoading(false);
    }
  };

  const onMarkCompleted = async (sessionDay: string) => {
    if (!user || !token) return;
    const normalizedDay = normalizeDayValue(sessionDay);
    setLocalCompleted((prev) => new Set([...prev, normalizedDay]));
    setSavingSessionDay(sessionDay);
    try {
      await api.createRoutineCheckin(user.id, token, { sessionDay });
      await loadCheckins();
      return true;
    } catch (error) {
      setLocalCompleted((prev) => {
        const next = new Set(prev);
        next.delete(normalizedDay);
        return next;
      });
      Alert.alert(
        "No se pudo registrar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
      return false;
    } finally {
      setSavingSessionDay(null);
    }
  };

  const openExerciseLog = (
    sessionDay: string,
    exercise: RoutineExercise,
    existingTodayLog?: StrengthLog
  ) => {
    const exerciseName = normalizeExerciseValue(exercise.name);
    setActiveLog({ sessionDay, exerciseName });

    const defaultKg = existingTodayLog ? existingTodayLog.loadKg.toFixed(1) : "";
    const defaultReps =
      typeof existingTodayLog?.reps === "number"
        ? String(existingTodayLog.reps)
        : parseSuggestedReps(exercise.reps);
    const defaultSets =
      typeof existingTodayLog?.sets === "number"
        ? String(existingTodayLog.sets)
        : String(exercise.sets || "");

    setLogKg(defaultKg);
    setLogUnit("kg");
    setLogReps(defaultReps);
    setLogSets(defaultSets);

    if (defaultKg && defaultReps && defaultSets) {
      const numeric = Number.parseFloat(defaultKg);
      const repsNumeric = Number.parseInt(defaultReps, 10);
      const setsNumeric = Number.parseInt(defaultSets, 10);
      if (
        Number.isFinite(numeric) &&
        numeric > 0 &&
        Number.isFinite(repsNumeric) &&
        repsNumeric > 0 &&
        Number.isFinite(setsNumeric) &&
        setsNumeric > 0
      ) {
        lastSubmittedRef.current = `${exerciseName}::kg::${numeric}::${repsNumeric}::${setsNumeric}`;
      }
    }

    setLastSavedExerciseKey(null);
  };

  const onSaveExerciseLog = async (
    sessionDay: string,
    exerciseName: string,
    loadText: string,
    unit: "kg" | "lb",
    repsText: string,
    setsText: string,
    submitKey?: string
  ) => {
    if (!user || !token) return;
    setAutoSaveRemainingSeconds(null);
    const loadValue = Number.parseFloat(loadText);
    if (!Number.isFinite(loadValue) || loadValue <= 0) {
      return;
    }

    const reps = repsText.trim() ? Number.parseInt(repsText.trim(), 10) : undefined;
    const sets = setsText.trim() ? Number.parseInt(setsText.trim(), 10) : undefined;

    const optimisticExerciseKey = `${normalizeDayValue(sessionDay)}::${normalizeExerciseValue(exerciseName)}`;
    setLocalCompletedExercises((prev) => new Set([...prev, optimisticExerciseKey]));

    setSavingLog(true);
    try {
      await api.createStrengthLog(user.id, token, {
        exerciseName,
        loadValue,
        loadUnit: unit,
        reps,
        sets,
      });
      if (submitKey) {
        lastSubmittedRef.current = submitKey;
      }
      setLastSavedExerciseKey(`${normalizeExerciseValue(exerciseName)}::${unit}::${loadValue}`);
      await loadStrengthProgress();
    } catch (error) {
      setLocalCompletedExercises((prev) => {
        const next = new Set(prev);
        next.delete(optimisticExerciseKey);
        return next;
      });
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setSavingLog(false);
    }
  };

  const onSaveExerciseLogNow = async () => {
    if (!activeLog) {
      return;
    }

    const draft = buildValidLogDraft(
      activeLog.exerciseName,
      logUnit,
      logKg,
      logReps,
      logSets
    );

    if (!draft) {
      Alert.alert(
        "Faltan datos",
        "Completa peso, repeticiones y series con valores validos antes de guardar."
      );
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (autoSaveCountdownIntervalRef.current) {
      clearInterval(autoSaveCountdownIntervalRef.current);
      autoSaveCountdownIntervalRef.current = null;
    }
    setAutoSaveRemainingSeconds(null);

    await onSaveExerciseLog(
      activeLog.sessionDay,
      activeLog.exerciseName,
      draft.normalizedLoadText,
      logUnit,
      draft.repsValue,
      draft.setsValue,
      draft.submitKey
    );
  };

  const onReplaceExercise = async (sessionDay: string, exerciseName: string) => {
    if (!user || !token) return;

    const key = `${sessionDay}::${exerciseName}`;
    setReplacingExerciseKey(key);
    try {
      const data = await api.replaceRoutineExercise(user.id, token, {
        sessionDay,
        exerciseName,
      });
      setRoutine(data.routine);
      setActiveLog(null);
    } catch (error) {
      Alert.alert(
        "No se pudo reemplazar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setReplacingExerciseKey(null);
    }
  };

  const onLoadReplacementOptions = async (sessionDay: string, exercise: RoutineExercise) => {
    if (!user || !token) return;

    const key = `${sessionDay}::${exercise.name}`;
    if (!replacementOptionsByKey[key]) {
      setOptionsLoadingKey(key);
      try {
        const data = await api.getExerciseReplacementOptions(user.id, token, {
          sessionDay,
          exerciseName: exercise.name,
          count: 5,
        });
        setReplacementOptionsByKey((prev) => ({
          ...prev,
          [key]: data.options,
        }));
      } catch (error) {
        Alert.alert(
          "No se pudieron cargar opciones",
          error instanceof Error ? error.message : "Intenta de nuevo"
        );
      } finally {
        setOptionsLoadingKey(null);
      }
    }

    setOpenOptionsKey((prev) => (prev === key ? null : key));
  };

  const onSelectManualReplacement = async (
    sessionDay: string,
    exerciseName: string,
    replacementExercise: RoutineExercise
  ) => {
    if (!user || !token) return;

    const key = `${sessionDay}::${exerciseName}`;
    setManualReplacingKey(key);
    try {
      const data = await api.replaceRoutineExercise(user.id, token, {
        sessionDay,
        exerciseName,
        replacementExercise,
      });
      setRoutine(data.routine);
      setOpenOptionsKey(null);
      setActiveLog(null);
    } catch (error) {
      Alert.alert(
        "No se pudo aplicar la opcion",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setManualReplacingKey(null);
    }
  };

  const onMarkExerciseCompleted = async (sessionDay: string, exerciseName: string) => {
    if (!user || !token) return;

    const exerciseKey = `${normalizeDayValue(sessionDay)}::${normalizeExerciseValue(exerciseName)}`;
    if (completedExercisesBySelectedWeek.has(exerciseKey)) {
      return;
    }

    setLocalCompletedExercises((prev) => new Set([...prev, exerciseKey]));
    try {
      await api.createExerciseCheckin(user.id, token, {
        sessionDay,
        exerciseName,
      });
      setActiveLog(null);
      await loadCheckins();
    } catch (error) {
      setLocalCompletedExercises((prev) => {
        const next = new Set(prev);
        next.delete(exerciseKey);
        return next;
      });
      Alert.alert(
        "No se pudo registrar el ejercicio",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    }
  };

  const onReorderExercise = (exerciseName: string) => {
    Alert.alert(
      "Reordenar ejercicio",
      `La opcion para mover ${exerciseName} se habilitara en una siguiente iteracion.`
    );
  };

  const onRemoveExercise = async (sessionDay: string, exerciseName: string) => {
    if (!user || !token) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Eliminar ejercicio",
        `Se eliminara ${exerciseName} de ${translateDay(sessionDay)}.`,
        [
          { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
          { text: "Eliminar", style: "destructive", onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) {
      return;
    }

    const key = `${sessionDay}::${exerciseName}`;
    setRemovingExerciseKey(key);
    try {
      const data = await api.removeRoutineExercise(user.id, token, {
        sessionDay,
        exerciseName,
      });
      setRoutine(data.routine);
      setActiveLog(null);
    } catch (error) {
      Alert.alert(
        "No se pudo eliminar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setRemovingExerciseKey(null);
    }
  };

  useEffect(() => {
    if (!activeLog) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (autoSaveCountdownIntervalRef.current) {
        clearInterval(autoSaveCountdownIntervalRef.current);
        autoSaveCountdownIntervalRef.current = null;
      }
      setAutoSaveRemainingSeconds(null);
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (autoSaveCountdownIntervalRef.current) {
      clearInterval(autoSaveCountdownIntervalRef.current);
      autoSaveCountdownIntervalRef.current = null;
    }

    const draft = buildValidLogDraft(
      activeLog.exerciseName,
      logUnit,
      logKg,
      logReps,
      logSets
    );
    if (!draft) {
      setAutoSaveRemainingSeconds(null);
      return;
    }

    const submitKey = draft.submitKey;
    if (lastSubmittedRef.current === submitKey) {
      setAutoSaveRemainingSeconds(null);
      return;
    }

    const deadline = Date.now() + AUTO_SAVE_DELAY_MS;
    setAutoSaveRemainingSeconds(Math.ceil(AUTO_SAVE_DELAY_MS / 1000));

    autoSaveCountdownIntervalRef.current = setInterval(() => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        if (autoSaveCountdownIntervalRef.current) {
          clearInterval(autoSaveCountdownIntervalRef.current);
          autoSaveCountdownIntervalRef.current = null;
        }
        setAutoSaveRemainingSeconds(0);
        return;
      }

      setAutoSaveRemainingSeconds(Math.ceil(remainingMs / 1000));
    }, 250);

    autoSaveTimerRef.current = setTimeout(() => {
      if (autoSaveCountdownIntervalRef.current) {
        clearInterval(autoSaveCountdownIntervalRef.current);
        autoSaveCountdownIntervalRef.current = null;
      }
      setAutoSaveRemainingSeconds(null);
      void onSaveExerciseLog(
        activeLog.sessionDay,
        activeLog.exerciseName,
        draft.normalizedLoadText,
        logUnit,
        draft.repsValue,
        draft.setsValue,
        submitKey
      );
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (autoSaveCountdownIntervalRef.current) {
        clearInterval(autoSaveCountdownIntervalRef.current);
        autoSaveCountdownIntervalRef.current = null;
      }
      setAutoSaveRemainingSeconds(null);
    };
  }, [activeLog, buildValidLogDraft, logKg, logUnit, logReps, logSets]);

  useEffect(() => {
    if (!executionPlan || activeTab !== "ai") {
      autoCompleteAttemptRef.current = null;
      return;
    }

    const normalizedSessionDay = normalizeDayValue(executionPlan.sessionDay);
    const attemptKey = `${selectedWeekStart}::${normalizedSessionDay}`;

    if (executionSessionCompleted) {
      return;
    }

    if (
      syncingCheckins ||
      savingSessionDay === executionPlan.sessionDay ||
      executionPlan.exercises.length === 0 ||
      executionCompletedCount !== executionPlan.exercises.length
    ) {
      return;
    }

    if (autoCompleteAttemptRef.current === attemptKey) {
      return;
    }

    autoCompleteAttemptRef.current = attemptKey;

    void (async () => {
      const success = await onMarkCompleted(executionPlan.sessionDay);
      if (!success && autoCompleteAttemptRef.current === attemptKey) {
        autoCompleteAttemptRef.current = null;
      }
    })();
  }, [
    activeTab,
    executionCompletedCount,
    executionPlan,
    executionSessionCompleted,
    selectedWeekStart,
    savingSessionDay,
    syncingCheckins,
  ]);

  const toggleModule = (
    key: "planSelector" | "weekSelector" | "weekSummary" | "calendar" | "addDay" | "notes" | "deleteAssigned"
  ) => {
    setVisibleModules((prev) => ({ ...prev, [key]: !prev[key] }));
    setShowFeatureMenu(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topHeaderRow}>
        <TouchableOpacity
          style={styles.menuTrigger}
          onPress={() => setShowFeatureMenu(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.menuTriggerIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showFeatureMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeatureMenu(false)}
      >
        <View style={styles.featureMenuRoot}>
          <View style={styles.featureMenuPanel}>
            <Text style={styles.featureMenuTitle}>Funciones de rutina</Text>

            <TouchableOpacity style={styles.featureMenuItem} onPress={() => toggleModule("planSelector")}>
              <Text style={styles.featureMenuItemText}>Selector de plan</Text>
              <Text style={styles.featureMenuItemState}>{visibleModules.planSelector ? "Visible" : "Oculta"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureMenuItem} onPress={() => toggleModule("weekSelector")}>
              <Text style={styles.featureMenuItemText}>Seleccionar semana</Text>
              <Text style={styles.featureMenuItemState}>{visibleModules.weekSelector ? "Visible" : "Oculta"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureMenuItem} onPress={() => toggleModule("weekSummary")}>
              <Text style={styles.featureMenuItemText}>Resumen semanal</Text>
              <Text style={styles.featureMenuItemState}>{visibleModules.weekSummary ? "Visible" : "Oculta"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureMenuItem} onPress={() => toggleModule("calendar")}>
              <Text style={styles.featureMenuItemText}>Calendario mensual</Text>
              <Text style={styles.featureMenuItemState}>{visibleModules.calendar ? "Visible" : "Oculta"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureMenuItem} onPress={() => toggleModule("addDay")}>
              <Text style={styles.featureMenuItemText}>Agregar nuevo día</Text>
              <Text style={styles.featureMenuItemState}>{visibleModules.addDay ? "Visible" : "Oculta"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureMenuItem} onPress={() => toggleModule("notes")}>
              <Text style={styles.featureMenuItemText}>Notas nutricionales</Text>
              <Text style={styles.featureMenuItemState}>{visibleModules.notes ? "Visible" : "Oculta"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureMenuItem} onPress={() => toggleModule("deleteAssigned")}>
              <Text style={styles.featureMenuItemText}>Eliminar rutina asignada</Text>
              <Text style={styles.featureMenuItemState}>{visibleModules.deleteAssigned ? "Visible" : "Oculta"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureMenuClose} onPress={() => setShowFeatureMenu(false)}>
              <Text style={styles.featureMenuCloseText}>Cerrar menú</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.featureMenuBackdrop}
            activeOpacity={1}
            onPress={() => setShowFeatureMenu(false)}
          />
        </View>
      </Modal>

      {visibleModules.planSelector && trainerRoutines.length > 0 ? (
        <TouchableOpacity
          style={styles.planSelector}
          onPress={() => setShowRoutineDropdown(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.planSelectorLabel}>
            {activeTab === "ai" ? "Plan TUCO" : selectedTrainerRoutine?.name ?? "Seleccionar plan"}
          </Text>
          <Text style={styles.planSelectorChevron}>{showRoutineDropdown ? "▲" : "▾"}</Text>
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={showRoutineDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoutineDropdown(false)}
      >
        <TouchableOpacity
          style={styles.dropdownBackdrop}
          activeOpacity={1}
          onPress={() => setShowRoutineDropdown(false)}
        >
          <View style={styles.dropdownPanel}>
            <Text style={styles.dropdownTitle}>Seleccionar plan</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, activeTab === "ai" && styles.dropdownItemActive]}
              onPress={() => { setActiveTab("ai"); setShowRoutineDropdown(false); }}
            >
              <Text style={[styles.dropdownItemText, activeTab === "ai" && styles.dropdownItemTextActive]}>
                Plan Tuco
              </Text>
              {activeTab === "ai" ? <Text style={styles.dropdownItemCheck}>✓</Text> : null}
            </TouchableOpacity>
            {trainerRoutines.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.dropdownItem, activeTab === r.id && styles.dropdownItemActive]}
                onPress={() => { setActiveTab(r.id); setShowRoutineDropdown(false); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownItemText, activeTab === r.id && styles.dropdownItemTextActive]}>
                    {r.name}
                  </Text>
                  {r.trainerName ? (
                    <Text style={styles.dropdownItemMeta}>Entrenador: {r.trainerName}</Text>
                  ) : null}
                </View>
                {activeTab === r.id ? <Text style={styles.dropdownItemCheck}>✓</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showAddDayModal}
        transparent
        animationType="slide"
        onRequestClose={() => !addDayLoading && setShowAddDayModal(false)}
      >
        <TouchableOpacity
          style={styles.addDayBackdrop}
          activeOpacity={1}
          onPress={() => {
            if (!addDayLoading) {
              setShowAddDayModal(false);
            }
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.addDayPanel}>
            <Text style={styles.addDayTitle}>Agregar nuevo día</Text>
            <Text style={styles.addDayLabel}>Día de la semana</Text>
            <View style={styles.addDayDaysRow}>
              {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.addDayDayChip, addDayDay === day && styles.addDayDayChipSelected]}
                  onPress={() => setAddDayDay(day)}
                >
                  <Text style={[styles.addDayDayChipText, addDayDay === day && styles.addDayDayChipTextSelected]}>
                    {DAY_LABELS[day]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.addDayLabel, { marginTop: 16 }]}>Enfoque</Text>
            <TextInput
              style={styles.addDayInput}
              placeholder="Ej: Empuje, Piernas, Cardio..."
              placeholderTextColor={ds.colors.textSecondary}
              value={addDayFocus}
              onChangeText={setAddDayFocus}
              editable={!addDayLoading}
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.addDaySubmitBtn, addDayLoading && styles.refreshButtonDisabled]}
              onPress={onAddDay}
              disabled={addDayLoading}
            >
              {addDayLoading ? (
                <ActivityIndicator size="small" color={ds.colors.textPrimary} />
              ) : (
                <Text style={styles.addDaySubmitText}>Generar con TUCO</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.addDayCancelBtn} onPress={() => setShowAddDayModal(false)}>
              <Text style={styles.addDayCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showDayMarksModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDayMarksModal(false)}
      >
        <TouchableOpacity
          style={styles.dayMarksBackdrop}
          activeOpacity={1}
          onPress={() => setShowDayMarksModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.dayMarksPanel}>
            <Text style={styles.dayMarksTitle}>Marcas del día</Text>
            <Text style={styles.dayMarksDate}>
              {selectedCalendarDate
                ? formatCostaRicaDate(selectedCalendarDate, {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                  }, true)
                : "Sin fecha"}
            </Text>

            <View style={styles.dayTabsRow}>
              <TouchableOpacity
                style={[styles.dayTabButton, dayDetailTab === "summary" && styles.dayTabButtonActive]}
                onPress={() => setDayDetailTab("summary")}
              >
                <Text style={[styles.dayTabText, dayDetailTab === "summary" && styles.dayTabTextActive]}>
                  Resumen del día
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dayTabButton, dayDetailTab === "marks" && styles.dayTabButtonActive]}
                onPress={() => setDayDetailTab("marks")}
              >
                <Text style={[styles.dayTabText, dayDetailTab === "marks" && styles.dayTabTextActive]}>
                  Marcas completadas
                </Text>
              </TouchableOpacity>
            </View>

            {!hasRecordedTrainingForSelectedDate ? (
              <Text style={styles.dayMarksEmpty}>Sin registros de entrenamiento para esta fecha.</Text>
            ) : dayDetailTab === "summary" ? (
              <>
                <View style={styles.dayResumeGrid}>
                  <View style={styles.dayResumeCard}>
                    <Text style={styles.dayResumeLabel}>Ejercicios completados</Text>
                    <Text style={styles.dayResumeValue}>{completedAssignedCount}</Text>
                  </View>
                  <View style={styles.dayResumeCard}>
                    <Text style={styles.dayResumeLabel}>Marcas registradas</Text>
                    <Text style={styles.dayResumeValue}>{registeredMarksCount}</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                {dayExerciseCheckins.length === 0 && dayStrengthLogs.length === 0 ? (
                  <Text style={styles.dayMarksEmpty}>No hay marcas completadas para esta fecha.</Text>
                ) : (
                  <>
                    {dayExerciseCheckins.length > 0 ? (
                      <View style={styles.dayMarksSection}>
                        <Text style={styles.dayMarksSectionTitle}>Check-ins de ejercicios</Text>
                        {dayExerciseCheckins.map((entry) => (
                          <Text key={entry.id} style={styles.dayMarksItem}>
                            • {entry.exerciseName} ({translateDay(entry.sessionDay)})
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {dayStrengthLogs.length > 0 ? (
                      <View style={styles.dayMarksSection}>
                        <Text style={styles.dayMarksSectionTitle}>Marcas de carga</Text>
                        {dayStrengthLogs.map((log) => (
                          <Text key={log.id} style={styles.dayMarksItem}>
                            • {log.exerciseName}: {log.loadKg.toFixed(1)} kg{log.reps ? ` · ${log.reps} reps` : ""}{log.sets ? ` · ${log.sets} series` : ""}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </>
                )}
              </>
            )}

            <TouchableOpacity style={styles.dayMarksCloseButton} onPress={() => setShowDayMarksModal(false)}>
              <Text style={styles.dayMarksCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={styles.executionStack}>
        <ScreenHeader
          title="Rutina de hoy"
          subtitle={executionPlan?.subtitle ?? "Plan pendiente · 0 min"}
          auxiliary={executionPlan?.sourceLabel ?? "Genera tu rutina para comenzar"}
          trailing={
            <View style={styles.todayDateChip}>
              <Text style={styles.todayDateChipText}>{todayHeaderDateLabel}</Text>
            </View>
          }
        />

        {visibleModules.weekSelector ? (
          <AppCard variant="flat">
            <Text style={styles.moduleTitle}>Seleccionar semana</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekSelector}>
              {availableWeeks.map((week) => {
                const selected = week === selectedWeekStart;
                const label = week === currentWeekStart ? "Actual" : formatWeekLabel(week);

                return (
                  <TouchableOpacity
                    key={week}
                    style={[styles.weekChip, selected && styles.weekChipSelected]}
                    onPress={() => setSelectedWeekStart(week)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.weekChipText, selected && styles.weekChipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.weekSummaryCard}>
                <Text style={styles.weekSummaryLabel}>Ejercicios al alza</Text>
                <Text style={styles.weekSummaryValue}>{improvingThisWeek}</Text>
              </View>
            </ScrollView>
          </AppCard>
        ) : null}

        {visibleModules.calendar ? (
          <AppCard variant="flat" style={styles.calendarSection}>
            <Text style={styles.calendarSectionTitle}>Calendario mensual de progreso</Text>
            <View style={styles.calendarNavRow}>
              <TouchableOpacity
                onPress={() => setSelectedCalendarMonthIdx((index) => Math.max(0, index - 1))}
                disabled={selectedCalendarMonthIdx === 0}
                style={[styles.calendarNavBtn, selectedCalendarMonthIdx === 0 && styles.calendarNavBtnDisabled]}
              >
                <Text style={styles.calendarNavBtnText}>{"<"}</Text>
              </TouchableOpacity>

              <Text style={styles.calendarMonthLabel}>
                {`${MONTH_LABELS[calendarMonths[selectedCalendarMonthIdx].getUTCMonth()]} ${calendarMonths[selectedCalendarMonthIdx].getUTCFullYear()}`}
              </Text>

              <TouchableOpacity
                onPress={() => setSelectedCalendarMonthIdx((index) => Math.min(2, index + 1))}
                disabled={selectedCalendarMonthIdx === 2}
                style={[styles.calendarNavBtn, selectedCalendarMonthIdx === 2 && styles.calendarNavBtnDisabled]}
              >
                <Text style={styles.calendarNavBtnText}>{">"}</Text>
              </TouchableOpacity>
            </View>

            {(() => {
              const monthStart = calendarMonths[selectedCalendarMonthIdx];
              const cells = buildCalMonthMatrix(monthStart);

              return (
                <View>
                  <View style={styles.calendarWeekRow}>
                    {WEEK_HEADERS.map((header) => (
                      <Text key={header} style={styles.calendarWeekHeader}>{header}</Text>
                    ))}
                  </View>

                  {Array.from({ length: cells.length / 7 }, (_, row) => (
                    <View key={row} style={styles.calendarWeekRow}>
                      {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                        if (!day) {
                          return <View key={col} style={styles.calendarCell} />;
                        }

                        const dayKey = day.toISOString().slice(0, 10);
                        const done = exerciseCompletedDateSet.has(dayKey);

                        return (
                          <TouchableOpacity
                            key={col}
                            style={[styles.calendarCell, done && styles.calendarCellDone]}
                            onPress={() => {
                              setSelectedCalendarDate(dayKey);
                              setDayDetailTab("summary");
                              setShowDayMarksModal(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.calendarDayText, done && styles.calendarDayTextDone]}>{day.getUTCDate()}</Text>
                            {done ? <View style={styles.calendarCompletionDot} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            })()}
          </AppCard>
        ) : null}

        {visibleModules.addDay && executionPlan?.allowEditing ? (
          <TouchableOpacity
            style={styles.addDayModuleButton}
            onPress={() => {
              setAddDayDay("monday");
              setAddDayFocus("");
              setShowAddDayModal(true);
            }}
          >
            <Text style={styles.addDayModuleButtonText}>Agregar nuevo día</Text>
          </TouchableOpacity>
        ) : null}

        {visibleModules.deleteAssigned ? (
          <TouchableOpacity
            style={[styles.deleteAssignedButton, !routineToDelete && styles.deleteAssignedButtonDisabled]}
            onPress={() => {
              if (!routineToDelete) {
                Alert.alert("Sin rutinas asignadas", "No hay rutinas asignadas para eliminar en este momento.");
                return;
              }

              onDeleteTrainerRoutine(routineToDelete.id, routineToDelete.name);
            }}
            disabled={routineToDelete ? deletingRoutineId === routineToDelete.id : false}
          >
            <Text style={styles.deleteAssignedButtonText}>
              {!routineToDelete
                ? "Eliminar rutina asignada"
                : deletingRoutineId === routineToDelete.id
                ? "Eliminando rutina..."
                : "Eliminar rutina asignada"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {activeTab === "ai" ? (
          <TouchableOpacity
            style={[styles.refreshButton, loadingRoutine && styles.refreshButtonDisabled]}
            onPress={onGenerate}
            disabled={loadingRoutine}
          >
            {loadingRoutine ? (
              <ActivityIndicator color={ds.colors.textPrimary} size="small" />
            ) : (
              <Text style={styles.refreshButtonText}>{routine ? "Generar nueva rutina" : "Generar rutina"}</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {executionPlan ? (
          <AppCard variant="default" style={styles.progressCard}>
            <Text style={styles.progressText}>
              {executionCompletedCount} de {executionPlan.exercises.length} ejercicios completados
            </Text>
            <ProgressBar progress={executionProgressValue} style={styles.progressBar} />
            {syncingCheckins ? <Text style={styles.progressHint}>Sincronizando progreso…</Text> : null}
            {activeTab === "ai" && executionSessionCompleted ? (
              <Text style={styles.progressSuccess}>Rutina marcada como completada para esta semana.</Text>
            ) : null}
          </AppCard>
        ) : null}

        {!executionPlan ? (
          <AppCard variant="default" style={styles.emptyStateCard}>
            <Text style={styles.emptyTitle}>Todavia no tienes una rutina activa</Text>
            <Text style={styles.emptyCopy}>
              Genera tu rutina para empezar un flujo guiado de entrenamiento con registro claro por ejercicio.
            </Text>
          </AppCard>
        ) : (
          executionPlan.exercises.map((exercise) => {
            const exerciseKey = normalizeExerciseValue(exercise.name);
            const sessionExerciseKey = `${normalizeDayValue(executionPlan.sessionDay)}::${exerciseKey}`;
            const actionKey = `${executionPlan.sessionDay}::${exercise.name}`;
            const progressPanelKey = `${executionPlan.sessionDay}::${exercise.name}::progress`;
            const progress = strengthMap[exerciseKey];
            const selectedWeekEntry = getWeeklyEntry(progress, selectedWeekStart);
            const previousWeekEntry = getWeeklyEntry(progress, previousWeekStart);
            const weeklyDelta =
              selectedWeekEntry && previousWeekEntry
                ? selectedWeekEntry.latestLoadKg - previousWeekEntry.latestLoadKg
                : null;
            const recentHistory = progress?.weeklyHistory.slice(-4).reverse() || [];
            const isProgressOpen = openProgressKey === progressPanelKey;
            const isLogOpen =
              activeLog?.sessionDay === executionPlan.sessionDay && activeLog.exerciseName === exerciseKey;
            const isExerciseDone = completedExercisesBySelectedWeek.has(sessionExerciseKey);
            const hasTodayLogForExercise = Boolean(todayStrengthLogBySessionExercise[sessionExerciseKey]);
            const currentDraft = isLogOpen
              ? buildValidLogDraft(exerciseKey, logUnit, logKg, logReps, logSets)
              : null;
            const canSaveNow = Boolean(currentDraft) && !savingLog;
            const logStateLabel = currentDraft
              ? currentDraft.submitKey === lastSubmittedRef.current
                ? "Registro al dia."
                : `Pendiente de guardar${
                    typeof autoSaveRemainingSeconds === "number"
                      ? ` (${Math.max(autoSaveRemainingSeconds, 0)}s)`
                      : ""
                  }...`
              : "Editando... completa peso, reps y series.";
            const status = isExerciseDone ? "completed" : isLogOpen ? "in_progress" : "pending";

            const progressNode = (
              <>
                <Text style={styles.exerciseProgressTitle}>Progreso del ejercicio</Text>
                <Text style={styles.exerciseProgressLine}>
                  Esta semana: {selectedWeekEntry ? `${selectedWeekEntry.latestLoadKg.toFixed(1)} kg` : "Sin registros"}
                </Text>
                <Text style={styles.exerciseProgressLine}>
                  Mejor historico: {progress ? `${progress.bestLoadKg.toFixed(1)} kg` : "Sin datos"}
                </Text>
                <Text style={styles.exerciseProgressLine}>
                  Ultimo registro: {progress ? formatDateTime(progress.lastPerformedAt) : "Sin datos"}
                </Text>
                {weeklyDelta !== null ? (
                  <Text style={[styles.exerciseProgressLine, weeklyDelta >= 0 ? styles.progressUp : styles.progressDown]}>
                    {weeklyDelta >= 0 ? "▲" : "▼"} {Math.abs(weeklyDelta).toFixed(1)} kg vs semana anterior
                  </Text>
                ) : (
                  <Text style={styles.exerciseProgressMuted}>
                    Aun no hay suficiente historial para comparar semanas.
                  </Text>
                )}
                {recentHistory.length > 0 ? (
                  <View style={styles.historyChips}>
                    {recentHistory.map((item) => (
                      <View key={`${exercise.name}-${item.weekStart}`} style={styles.historyChip}>
                        <Text style={styles.historyChipWeek}>{formatWeekLabel(item.weekStart)}</Text>
                        <Text style={styles.historyChipValue}>{item.latestLoadKg.toFixed(1)} kg</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            );

            return (
              <ExerciseCard
                key={`${executionPlan.sessionDay}-${exercise.name}`}
                name={exercise.name}
                sets={exercise.sets}
                reps={exercise.reps}
                restSeconds={exercise.restSeconds}
                tip={exercise.tip}
                lastPerformance={progress ? `Ultimo: ${progress.latestLoadKg.toFixed(1)} kg` : undefined}
                status={status}
                exerciseKey={exerciseKey}
                logOpen={isLogOpen}
                logValues={{
                  loadValue: logKg,
                  loadUnit: logUnit,
                  reps: logReps,
                  sets: logSets,
                }}
                savingLog={savingLog}
                lastSavedKey={lastSavedExerciseKey}
                onToggleLog={() => {
                  if (isLogOpen) {
                    setActiveLog(null);
                    return;
                  }

                  openExerciseLog(
                    executionPlan.sessionDay,
                    {
                      name: exercise.name,
                      sets: exercise.sets,
                      reps: exercise.reps,
                      rest_seconds: exercise.restSeconds,
                      notes: exercise.tip,
                    },
                    todayStrengthLogBySessionExercise[sessionExerciseKey]
                  );
                }}
                onLogChange={(vals) => {
                  if (vals.loadValue !== undefined) setLogKg(vals.loadValue);
                  if (vals.loadUnit !== undefined) setLogUnit(vals.loadUnit);
                  if (vals.reps !== undefined) setLogReps(vals.reps);
                  if (vals.sets !== undefined) setLogSets(vals.sets);
                }}
                onSaveNow={onSaveExerciseLogNow}
                canSaveNow={canSaveNow}
                logStateLabel={isLogOpen ? logStateLabel : undefined}
                allowEditWhenCompleted={hasTodayLogForExercise}
                hasProgress={!!progress}
                progressOpen={isProgressOpen}
                onToggleProgress={() =>
                  setOpenProgressKey((prev) => (prev === progressPanelKey ? null : progressPanelKey))
                }
                progressContent={progressNode}
                replacements={
                  openOptionsKey === actionKey
                    ? (replacementOptionsByKey[actionKey] || []).map(
                        (option): ExerciseReplacement => ({
                          name: option.name,
                          sets: option.sets,
                          reps: option.reps,
                          rest_seconds: option.rest_seconds,
                        })
                      )
                    : undefined
                }
                replacementsLoading={optionsLoadingKey === actionKey}
                onSelectReplacement={(option) =>
                  executionPlan.allowEditing
                    ? onSelectManualReplacement(executionPlan.sessionDay, exercise.name, {
                        name: option.name,
                        sets: option.sets,
                        reps: option.reps,
                        rest_seconds: option.rest_seconds,
                      })
                    : Alert.alert("No disponible", "Esta rutina fue asignada y no puede editarse desde la app.")
                }
                menuOptions={[
                  {
                    label: "Editar",
                    onPress: () => {
                      if (isExerciseDone && !hasTodayLogForExercise) {
                        Alert.alert("No disponible", "Solo puedes editar marcas registradas hoy.");
                        return;
                      }

                      openExerciseLog(
                        executionPlan.sessionDay,
                        {
                          name: exercise.name,
                          sets: exercise.sets,
                          reps: exercise.reps,
                          rest_seconds: exercise.restSeconds,
                          notes: exercise.tip,
                        },
                        todayStrengthLogBySessionExercise[sessionExerciseKey]
                      );
                    },
                  },
                  ...(!isExerciseDone
                    ? [
                        {
                          label: executionPlan.allowEditing
                            ? replacingExerciseKey === actionKey
                              ? "Reemplazando..."
                              : "Reemplazar ejercicio"
                            : "Reemplazo no disponible",
                          loading: executionPlan.allowEditing && replacingExerciseKey === actionKey,
                          onPress: () =>
                            executionPlan.allowEditing
                              ? onReplaceExercise(executionPlan.sessionDay, exercise.name)
                              : Alert.alert("No disponible", "Esta rutina fue asignada y no puede editarse desde la app."),
                        },
                        {
                          label: executionPlan.allowEditing
                            ? optionsLoadingKey === actionKey
                              ? "Buscando alternativas..."
                              : "Elegir alternativa"
                            : "Alternativas no disponibles",
                          loading: executionPlan.allowEditing && optionsLoadingKey === actionKey,
                          onPress: () =>
                            executionPlan.allowEditing
                              ? onLoadReplacementOptions(executionPlan.sessionDay, {
                                  name: exercise.name,
                                  sets: exercise.sets,
                                  reps: exercise.reps,
                                  rest_seconds: exercise.restSeconds,
                                  notes: exercise.tip,
                                })
                              : Alert.alert("No disponible", "Esta rutina fue asignada y no puede editarse desde la app."),
                        },
                      ]
                    : []),
                  {
                    label: executionPlan.allowEditing
                      ? removingExerciseKey === actionKey
                        ? "Eliminando..."
                        : "Eliminar"
                      : "Eliminacion no disponible",
                    loading: executionPlan.allowEditing && removingExerciseKey === actionKey,
                    destructive: executionPlan.allowEditing,
                    onPress: () =>
                      executionPlan.allowEditing
                        ? onRemoveExercise(executionPlan.sessionDay, exercise.name)
                        : Alert.alert("No disponible", "Esta rutina fue asignada y no puede editarse desde la app."),
                  },
                  {
                    label: "Reordenar",
                    onPress: () => onReorderExercise(exercise.name),
                  },
                ]}
              />
            );
          })
        )}

        {visibleModules.notes && executionPlan?.allowEditing && activeTab === "ai" && routine?.nutrition_notes ? (
          <AppCard variant="flat" style={styles.noteCard}>
            <Text style={styles.noteTitle}>Nota operativa</Text>
            <Text style={styles.noteCopy}>{routine.nutrition_notes}</Text>
          </AppCard>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: ds.colors.backgroundDeep,
    paddingHorizontal: ds.spacing.x3,
    paddingTop: 56,
    paddingBottom: ds.spacing.x4,
  },
  executionStack: {
    gap: ds.spacing.x3,
  },
  todayDateChip: {
    alignSelf: "flex-start",
    borderRadius: ds.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: ds.colors.surface,
    borderWidth: 1,
    borderColor: ds.colors.borderSubtle,
  },
  todayDateChipText: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
    textTransform: "capitalize",
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: ds.spacing.x2,
  },
  menuTrigger: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ds.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTriggerIcon: {
    color: ds.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  featureMenuRoot: {
    flex: 1,
    flexDirection: "row",
  },
  featureMenuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.62)",
  },
  featureMenuPanel: {
    width: "75%",
    height: "100%",
    backgroundColor: ds.colors.surfaceElevated,
    paddingTop: 56,
    paddingHorizontal: ds.spacing.x2,
    paddingBottom: ds.spacing.x3,
    gap: ds.spacing.x1,
    ...ds.shadows.card,
  },
  featureMenuTitle: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.titleMD,
    fontWeight: "700",
    fontFamily: ds.typography.fontFamily,
    marginBottom: ds.spacing.x1,
  },
  featureMenuItem: {
    paddingVertical: ds.spacing.x2,
    paddingHorizontal: ds.spacing.x1,
    borderRadius: ds.radius.sm,
    backgroundColor: ds.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: ds.colors.borderSubtle,
  },
  featureMenuItemText: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "500",
    fontFamily: ds.typography.fontFamily,
  },
  featureMenuItemState: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodySM,
    marginTop: 2,
    fontFamily: ds.typography.fontFamily,
  },
  featureMenuClose: {
    marginTop: ds.spacing.x2,
    backgroundColor: ds.colors.actionPrimary,
    borderRadius: ds.radius.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  featureMenuCloseText: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  moduleTitle: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
    marginBottom: ds.spacing.x1,
  },
  addDayModuleButton: {
    alignSelf: "flex-start",
    backgroundColor: ds.colors.surfaceElevated,
    borderRadius: ds.radius.md,
    paddingHorizontal: ds.spacing.x2,
    paddingVertical: 12,
  },
  addDayModuleButtonText: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  deleteAssignedButton: {
    alignSelf: "flex-start",
    borderRadius: ds.radius.md,
    backgroundColor: ds.colors.accent + "22",
    paddingHorizontal: ds.spacing.x2,
    paddingVertical: 12,
  },
  deleteAssignedButtonDisabled: {
    opacity: 0.7,
  },
  deleteAssignedButtonText: {
    color: ds.colors.accent,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  planSelector: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: ds.spacing.x1,
    backgroundColor: ds.colors.surface,
    borderRadius: ds.radius.pill,
    paddingHorizontal: ds.spacing.x2,
    paddingVertical: ds.spacing.x1,
  },
  planSelectorLabel: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  planSelectorChevron: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodySM,
    fontWeight: "700",
  },
  refreshButton: {
    alignSelf: "flex-start",
    backgroundColor: ds.colors.actionPrimary,
    borderRadius: ds.radius.md,
    paddingHorizontal: ds.spacing.x2,
    paddingVertical: 12,
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  progressCard: {
    gap: ds.spacing.x2,
  },
  progressText: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyLG,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  progressBar: {
    marginTop: ds.spacing.x0_5,
  },
  progressHint: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodySM,
    fontFamily: ds.typography.fontFamily,
  },
  progressSuccess: {
    color: ds.colors.success,
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  noteCard: {
    gap: ds.spacing.x1,
  },
  noteTitle: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  noteCopy: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodyMD,
    lineHeight: 20,
    fontFamily: ds.typography.fontFamily,
  },
  emptyStateCard: {
    gap: ds.spacing.x1,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 20,
  },
  eyebrow: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.ink,
    marginTop: 8,
  },
  subtitle: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  generatedAt: {
    marginTop: 10,
    color: palette.textSoft,
    fontSize: 12,
  },
  summaryBadge: {
    marginTop: 10,
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  genBtn: {
    backgroundColor: palette.gold,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.cocoa,
  },
  genBtnDisabled: {
    opacity: 0.6,
  },
  genBtnText: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 15,
  },
  loadingHint: {
    marginTop: 12,
    textAlign: "center",
    color: palette.textSoft,
    fontSize: 13,
  },
  emptyCard: {
    marginTop: 20,
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 18,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyCopy: {
    marginTop: 8,
    color: palette.textMuted,
    lineHeight: 20,
  },
  routineContainer: {
    marginTop: 20,
    gap: 12,
  },
  routineHeader: {
    backgroundColor: palette.moss,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  routineName: {
    color: palette.cocoa,
    fontSize: 18,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
    flexWrap: "wrap",
  },
  metaBadge: {
    backgroundColor: palette.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionCaption: {
    marginTop: 14,
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "700",
  },
  weekSelector: {
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  weekChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
  },
  weekChipSelected: {
    backgroundColor: palette.cocoa,
  },
  weekChipText: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "700",
  },
  weekChipTextSelected: {
    color: palette.gold,
  },
  weekSummaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
  },
  weekSummaryCard: {
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 10,
  },
  weekSummaryLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  weekSummaryValue: {
    color: palette.cocoa,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  syncText: {
    marginTop: 8,
    color: palette.cocoa,
    fontSize: 12,
  },
  sessionCard: {
    backgroundColor: palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: "hidden",
  },
  sessionCardDone: {
    borderColor: palette.moss,
    borderWidth: 2,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  sessionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  doneCheck: {
    color: "#2E7D32",
    fontWeight: "800",
    fontSize: 16,
    marginRight: 4,
  },
  sessionDay: {
    fontWeight: "700",
    fontSize: 15,
    color: palette.ink,
  },
  sessionDayDone: {
    color: "#2E7D32",
  },
  sessionFocus: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  sessionStatus: {
    color: palette.textSoft,
    fontSize: 12,
    marginTop: 4,
  },
  sessionMeta: {
    alignItems: "flex-end",
    gap: 4,
    marginLeft: 12,
  },
  sessionDuration: {
    color: palette.coral,
    fontWeight: "600",
    fontSize: 13,
  },
  sessionArrow: {
    color: palette.textSoft,
    fontSize: 11,
  },
  exerciseList: {
    borderTopWidth: 1,
    borderTopColor: palette.line,
    padding: 12,
    gap: 10,
  },
  completeBtn: {
    backgroundColor: palette.gold,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.cocoa,
  },
  completeBtnDone: {
    backgroundColor: palette.moss,
    borderColor: palette.line,
  },
  completeBtnText: {
    color: palette.cocoa,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  completeBtnTextDone: {
    color: palette.cocoa,
  },
  secondaryActionBtn: {
    marginTop: 8,
    backgroundColor: palette.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  secondaryActionBtnText: {
    color: palette.cocoa,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  exerciseRow: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    padding: 10,
  },
  exName: {
    fontWeight: "700",
    color: palette.ink,
    fontSize: 14,
  },
  exDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  exTag: {
    backgroundColor: palette.surfaceMuted,
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "600",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  exNotes: {
    marginTop: 6,
    color: palette.textMuted,
    fontSize: 12,
    fontStyle: "italic",
  },
  progressToggleBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  progressToggleText: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "700",
  },
  exerciseProgressCard: {
    marginTop: 8,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 10,
    padding: 10,
  },
  exerciseProgressTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  exerciseProgressLine: {
    color: palette.ink,
    fontSize: 12,
    marginTop: 3,
  },
  exerciseProgressMuted: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  progressUp: {
    color: "#2E7D32",
    fontWeight: "700",
  },
  progressDown: {
    color: "#B23A48",
    fontWeight: "700",
  },
  historyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  historyChip: {
    backgroundColor: palette.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  historyChipWeek: {
    color: palette.textSoft,
    fontSize: 11,
  },
  historyChipValue: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 2,
  },
  logToggleBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.coral,
  },
  logToggleText: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: "700",
  },
  completeExerciseBtn: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.moss,
    backgroundColor: palette.surface,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  completeExerciseBtnText: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "700",
  },
  exerciseActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  exerciseActionBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.moss,
    backgroundColor: palette.surface,
    paddingVertical: 8,
    alignItems: "center",
  },
  exerciseActionBtnText: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "700",
  },
  exerciseActionBtnDanger: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#B23A48",
    backgroundColor: "#FCEBEC",
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  exerciseActionBtnDangerText: {
    color: "#B23A48",
    fontSize: 12,
    fontWeight: "700",
  },
  optionsPanel: {
    marginTop: 10,
    backgroundColor: palette.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 10,
    gap: 8,
  },
  optionsPanelTitle: {
    color: palette.ink,
    fontWeight: "700",
    fontSize: 12,
  },
  optionRow: {
    backgroundColor: palette.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionName: {
    color: palette.cocoa,
    fontSize: 13,
    fontWeight: "700",
  },
  optionMeta: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  logForm: {
    marginTop: 8,
    gap: 8,
  },
  unitSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  unitChip: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unitChipSelected: {
    backgroundColor: palette.cocoa,
    borderColor: palette.cocoa,
  },
  unitChipText: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "700",
  },
  unitChipTextSelected: {
    color: palette.gold,
  },
  logFormRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.ink,
    flex: 1,
    fontSize: 13,
  },
  inputKg: {
    flex: 2,
  },
  inputSmall: {
    flex: 1,
  },
  autoSaveHint: {
    color: palette.textMuted,
    fontSize: 12,
  },
  autoSaveStatus: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: "700",
  },
  autoSaveStatusSuccess: {
    color: "#2E7D32",
    fontSize: 12,
    fontWeight: "700",
  },
  tipsCard: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  tipsTitle: {
    fontWeight: "700",
    color: palette.ink,
    fontSize: 15,
    marginBottom: 8,
  },
  tip: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  nutritionCard: {
    backgroundColor: palette.gold,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.cocoa,
  },
  nutritionText: {
    color: palette.cocoa,
    fontSize: 13,
    lineHeight: 20,
  },
  calendarSection: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 16,
  },
  calendarSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 12,
  },
  calendarNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calendarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarNavBtnDisabled: {
    opacity: 0.3,
  },
  calendarNavBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.ink,
  },
  calendarMonthBlock: {
    marginBottom: 16,
  },
  calendarMonthLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  calendarWeekHeader: {
    width: "13%",
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: palette.textMuted,
    paddingBottom: 4,
  },
  calendarCell: {
    width: "13%",
    aspectRatio: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  calendarCellDone: {
    borderWidth: 1,
    borderColor: ds.colors.success,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  calendarDayText: {
    fontSize: 11,
    color: palette.textSoft,
  },
  calendarDayTextDone: {
    color: palette.textSoft,
    fontWeight: "700",
  },
  calendarCompletionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ds.colors.success,
    position: "absolute",
    bottom: 6,
    alignSelf: "center",
  },
  dayMarksBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.62)",
    justifyContent: "center",
    paddingHorizontal: ds.spacing.x3,
  },
  dayMarksPanel: {
    backgroundColor: ds.colors.surfaceElevated,
    borderRadius: ds.radius.lg,
    padding: ds.spacing.x3,
    gap: ds.spacing.x2,
    ...ds.shadows.card,
  },
  dayMarksTitle: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.titleMD,
    fontWeight: "700",
    fontFamily: ds.typography.fontFamily,
  },
  dayMarksDate: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodyMD,
    fontFamily: ds.typography.fontFamily,
    textTransform: "capitalize",
  },
  dayMarksEmpty: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodyMD,
    fontFamily: ds.typography.fontFamily,
  },
  dayTabsRow: {
    flexDirection: "row",
    gap: ds.spacing.x1,
  },
  dayTabButton: {
    flex: 1,
    borderRadius: ds.radius.sm,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: ds.colors.surface,
  },
  dayTabButtonActive: {
    backgroundColor: ds.colors.actionPrimary,
  },
  dayTabText: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  dayTabTextActive: {
    color: ds.colors.textPrimary,
  },
  dayResumeGrid: {
    flexDirection: "row",
    gap: ds.spacing.x1,
    flexWrap: "wrap",
  },
  dayResumeCard: {
    minWidth: "31%",
    flexGrow: 1,
    borderRadius: ds.radius.sm,
    backgroundColor: ds.colors.surface,
    padding: ds.spacing.x2,
  },
  dayResumeLabel: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodySM,
    fontFamily: ds.typography.fontFamily,
  },
  dayResumeValue: {
    marginTop: 4,
    color: ds.colors.textPrimary,
    fontSize: ds.typography.titleMD,
    fontWeight: "700",
    fontFamily: ds.typography.fontFamily,
  },
  dayMarksSection: {
    gap: ds.spacing.x1,
  },
  dayMarksSectionTitle: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  dayMarksItem: {
    color: ds.colors.textSecondary,
    fontSize: ds.typography.bodySM,
    fontFamily: ds.typography.fontFamily,
    lineHeight: 19,
  },
  dayMarksCloseButton: {
    marginTop: ds.spacing.x1,
    alignSelf: "flex-end",
    backgroundColor: ds.colors.actionPrimary,
    borderRadius: ds.radius.md,
    paddingHorizontal: ds.spacing.x2,
    paddingVertical: 10,
  },
  dayMarksCloseText: {
    color: ds.colors.textPrimary,
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },

  // Trainer-assigned routine card
  routineSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.moss + "80",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  routineSelectorLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.moss,
    flex: 1,
  },
  routineSelectorChevron: {
    fontSize: 16,
    color: palette.moss,
    marginLeft: 8,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dropdownPanel: {
    backgroundColor: palette.card,
    borderRadius: 16,
    paddingVertical: 8,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.textSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    marginBottom: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dropdownItemActive: {
    backgroundColor: palette.moss + "12",
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: palette.ink,
  },
  dropdownItemTextActive: {
    color: palette.moss,
  },
  dropdownItemMeta: {
    fontSize: 12,
    color: palette.textSoft,
    marginTop: 2,
  },
  dropdownItemCheck: {
    fontSize: 16,
    color: palette.moss,
    fontWeight: "700",
    marginLeft: 8,
  },

  trainerRoutineCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.moss + "55",
  },
  trainerRoutineHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: palette.moss + "18",
  },
  trainerRoutineLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.moss,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  trainerRoutineName: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.cocoa,
  },
  trainerRoutineDays: {
    fontSize: 12,
    color: palette.textSoft,
    marginTop: 3,
  },
  trainerDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trainerDeleteBtnText: {
    fontSize: 18,
  },
  trainerRoutineChevron: {
    fontSize: 14,
    color: palette.moss,
    marginLeft: 8,
  },
  trainerRoutineBody: {
    padding: 16,
  },
  trainerRoutinePurpose: {
    fontSize: 13,
    color: palette.textSoft,
    marginBottom: 12,
    lineHeight: 18,
  },
  trainerWarningBox: {
    backgroundColor: "#FFF3CD",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  trainerWarningTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#856404",
    marginBottom: 4,
  },
  trainerWarningItem: {
    fontSize: 12,
    color: "#856404",
    lineHeight: 18,
  },
  trainerExerciseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.moss + "22",
  },
  trainerExerciseNum: {
    width: 24,
    fontSize: 13,
    fontWeight: "700",
    color: palette.moss,
    marginTop: 1,
  },
  trainerExerciseName: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.cocoa,
  },
  trainerExerciseMeta: {
    fontSize: 12,
    color: palette.textSoft,
    marginTop: 2,
  },
  trainerExerciseTips: {
    fontSize: 12,
    color: palette.textSoft,
    fontStyle: "italic",
    marginTop: 3,
  },
  addDayBtn: {
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.moss,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: palette.moss + "18",
  },
  addDayBtnText: {
    color: palette.moss,
    fontWeight: "700",
    fontSize: 14,
  },
  addDayBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  addDayPanel: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  addDayTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 20,
    textAlign: "center",
  },
  addDayLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.textSoft,
    marginBottom: 10,
  },
  addDayDaysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  addDayDayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  addDayDayChipSelected: {
    borderColor: palette.moss,
    backgroundColor: palette.moss + "20",
  },
  addDayDayChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.textMuted,
  },
  addDayDayChipTextSelected: {
    color: palette.moss,
  },
  addDayInput: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.ink,
  },
  addDaySubmitBtn: {
    marginTop: 20,
    backgroundColor: palette.moss,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  addDaySubmitText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  addDayCancelBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  addDayCancelText: {
    color: palette.textSoft,
    fontSize: 14,
    fontWeight: "600",
  },
  addExerciseBtn: {
    marginTop: 10,
    marginHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.moss,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: palette.moss + "12",
  },
  addExerciseBtnText: {
    color: palette.moss,
    fontWeight: "700",
    fontSize: 13,
  },
});