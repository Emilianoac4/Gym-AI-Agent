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
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";
import { ExerciseCard } from "../../components/ExerciseCard";
import type { ExerciseReplacement } from "../../components/ExerciseCard";
import {
  ExerciseStrengthProgress,
  GeneratedRoutine,
  RoutineCheckin,
  RoutineExercise,
  RoutineExerciseCheckin,
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
  const offset = DAY_OFFSETS[normalize(dayName)];
  if (offset === undefined) return "";
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function getWeekStart(date: Date): string {
  const value = new Date(date);
  const day = value.getDay();
  const diff = (day + 6) % 7;
  value.setDate(value.getDate() - diff);
  value.setHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
}

function shiftWeek(weekStart: string, offset: number): string {
  const value = new Date(`${weekStart}T00:00:00`);
  value.setDate(value.getDate() + offset * 7);
  return getWeekStart(value);
}

function formatWeekLabel(weekStart: string): string {
  const value = new Date(`${weekStart}T00:00:00`);
  return value.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "Sin registro";
  }

  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function translateDay(value: string): string {
  const translated = DAY_TRANSLATIONS[normalize(value)];
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
  const [trainerRoutines, setTrainerRoutines] = useState<TrainerAssignedRoutine[]>([]);
  const [activeTab, setActiveTab] = useState<"ai" | string>("ai"); // "ai" or routineId
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null);
  const [trainerRoutineExpanded, setTrainerRoutineExpanded] = useState<Record<string, boolean>>({});
  const [showRoutineDropdown, setShowRoutineDropdown] = useState(false);
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

  const currentWeekStart = useMemo(() => getWeekStart(new Date()), []);
  const [selectedWeekStart, setSelectedWeekStart] = useState(currentWeekStart);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedRef = useRef<string>("");

  const strengthMap = useMemo(() => {
    const map: Record<string, ExerciseStrengthProgress> = {};
    strengthByExercise.forEach((item) => {
      map[normalize(item.exerciseName)] = item;
    });
    return map;
  }, [strengthByExercise]);

  const checkinDateSet = useMemo(() => {
    const set = new Set<string>();
    checkins.forEach((item) => {
      const d = new Date(item.completedAt);
      set.add(d.toISOString().slice(0, 10));
    });
    return set;
  }, [checkins]);

  const calendarMonths = useMemo(() => {
    const now = new Date();
    return [2, 1, 0].map((offset) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    );
  }, []);

  const [selectedCalendarMonthIdx, setSelectedCalendarMonthIdx] = useState(2); // 0=2mo ago, 1=last, 2=current

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
        value.add(normalize(item.sessionDay));
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
        value.add(`${normalize(item.sessionDay)}::${normalize(item.exerciseName)}`);
      }
    });

    if (selectedWeekStart === currentWeekStart) {
      localCompletedExercises.forEach((item) => value.add(item));
    }

    return value;
  }, [currentWeekStart, exerciseCheckins, localCompletedExercises, selectedWeekStart]);

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
        value.add(normalize(item.sessionDay));
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
        map[normalize(item.sessionDay)] = item.completedAt;
      }
    });
    return map;
  }, [checkins, selectedWeekStart]);

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

  const loadCheckins = async () => {
    if (!user || !token) return;
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
    }
  };

  const loadStrengthProgress = async () => {
    if (!user || !token) return;
    try {
      const data = await api.getStrengthProgress(user.id, token, 120);
      setStrengthSummary(data.summary);
      setStrengthByExercise(data.exercises);
    } catch {
      setStrengthSummary(null);
      setStrengthByExercise([]);
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

  const reloadAll = useCallback(async () => {
    if (!user || !token) {
      return;
    }

    try {
      await Promise.all([loadLatestRoutine(), loadCheckins(), loadStrengthProgress(), loadTrainerRoutine()]);
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
    const normalizedDay = normalize(sessionDay);
    setLocalCompleted((prev) => new Set([...prev, normalizedDay]));
    setSavingSessionDay(sessionDay);
    try {
      await api.createRoutineCheckin(user.id, token, { sessionDay });
      await loadCheckins();
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
    } finally {
      setSavingSessionDay(null);
    }
  };

  const openExerciseLog = (sessionDay: string, exercise: RoutineExercise) => {
    const exerciseName = normalize(exercise.name);
    setActiveLog({ sessionDay, exerciseName });
    setLogKg("");
    setLogUnit("kg");
    setLogReps(parseSuggestedReps(exercise.reps));
    setLogSets(String(exercise.sets || ""));
    setLastSavedExerciseKey(null);
  };

  const onSaveExerciseLog = async (exerciseName: string, loadText: string, unit: "kg" | "lb") => {
    if (!user || !token) return;
    const loadValue = Number.parseFloat(loadText);
    if (!Number.isFinite(loadValue) || loadValue <= 0) {
      return;
    }

    const reps = logReps.trim() ? Number.parseInt(logReps.trim(), 10) : undefined;
    const sets = logSets.trim() ? Number.parseInt(logSets.trim(), 10) : undefined;

    setSavingLog(true);
    try {
      await api.createStrengthLog(user.id, token, {
        exerciseName,
        loadValue,
        loadUnit: unit,
        reps,
        sets,
      });
      setLastSavedExerciseKey(`${normalize(exerciseName)}::${unit}::${loadValue}`);
      await loadStrengthProgress();
    } catch (error) {
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setSavingLog(false);
    }
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

    const exerciseKey = `${normalize(sessionDay)}::${normalize(exerciseName)}`;
    if (completedExercisesBySelectedWeek.has(exerciseKey)) {
      return;
    }

    setLocalCompletedExercises((prev) => new Set([...prev, exerciseKey]));
    try {
      await api.createExerciseCheckin(user.id, token, {
        sessionDay,
        exerciseName,
      });
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
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const value = logKg.trim();
    if (!value) {
      return;
    }

    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return;
    }

    const submitKey = `${activeLog.exerciseName}::${logUnit}::${numeric}`;
    if (lastSubmittedRef.current === submitKey) {
      return;
    }

    autoSaveTimerRef.current = setTimeout(() => {
      lastSubmittedRef.current = submitKey;
      void onSaveExerciseLog(activeLog.exerciseName, value, logUnit);
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [activeLog, logKg, logUnit, logReps, logSets]);

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Routine selector dropdown */}
      {trainerRoutines.length > 0 && (
        <TouchableOpacity
          style={styles.routineSelector}
          onPress={() => setShowRoutineDropdown(true)}
          activeOpacity={0.75}
        >
          <Text style={styles.routineSelectorLabel}>
            {activeTab === "ai"
              ? "Plan Tuco"
              : trainerRoutines.find((r) => r.id === activeTab)?.name ?? "Seleccionar plan"}
          </Text>
          <Text style={styles.routineSelectorChevron}>{showRoutineDropdown ? "▲" : "▾"}</Text>
        </TouchableOpacity>
      )}

      {/* Dropdown modal */}
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

      {/* Add Day Modal */}
      <Modal
        visible={showAddDayModal}
        transparent
        animationType="slide"
        onRequestClose={() => !addDayLoading && setShowAddDayModal(false)}
      >
        <TouchableOpacity
          style={styles.addDayBackdrop}
          activeOpacity={1}
          onPress={() => { if (!addDayLoading) setShowAddDayModal(false); }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.addDayPanel}>
            <Text style={styles.addDayTitle}>Agregar nuevo día</Text>
            <Text style={styles.addDayLabel}>Día de la semana</Text>
            <View style={styles.addDayDaysRow}>
              {(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.addDayDayChip, addDayDay === d && styles.addDayDayChipSelected]}
                  onPress={() => setAddDayDay(d)}
                >
                  <Text style={[styles.addDayDayChipText, addDayDay === d && styles.addDayDayChipTextSelected]}>
                    {DAY_LABELS[d]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.addDayLabel, { marginTop: 16 }]}>Enfoque</Text>
            <TextInput
              style={styles.addDayInput}
              placeholder="Ej: Piernas, Cardio, Espalda..."
              placeholderTextColor="#9CA3AF"
              value={addDayFocus}
              onChangeText={setAddDayFocus}
              editable={!addDayLoading}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addDaySubmitBtn, addDayLoading && { opacity: 0.6 }]}
              onPress={onAddDay}
              disabled={addDayLoading}
            >
              {addDayLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.addDaySubmitText}>Generar con Tuco</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addDayCancelBtn}
              onPress={() => setShowAddDayModal(false)}
              disabled={addDayLoading}
            >
              <Text style={styles.addDayCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add Exercise Modal */}
      <Modal
        visible={showAddExerciseModal}
        transparent
        animationType="slide"
        onRequestClose={() => !addingExercise && setShowAddExerciseModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.addDayBackdrop}
            activeOpacity={1}
            onPress={() => { if (!addingExercise) setShowAddExerciseModal(false); }}
          >
            <TouchableOpacity activeOpacity={1} style={styles.addDayPanel}>
            <Text style={styles.addDayTitle}>Agregar ejercicio</Text>
            {addExerciseMode === "choose" && (
              <>
                <TouchableOpacity
                  style={styles.addDaySubmitBtn}
                  onPress={() => onAddExercise("ai")}
                >
                  <Text style={styles.addDaySubmitText}>Generar con Tuco</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addDaySubmitBtn, { marginTop: 10, backgroundColor: "transparent", borderWidth: 1.5, borderColor: palette.moss }]}
                  onPress={() => setAddExerciseMode("manual")}
                >
                  <Text style={[styles.addDaySubmitText, { color: palette.moss }]}>Agregar manualmente</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addDayCancelBtn}
                  onPress={() => setShowAddExerciseModal(false)}
                >
                  <Text style={styles.addDayCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
            {addExerciseMode === "ai" && (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <ActivityIndicator color={palette.moss} size="large" />
                <Text style={[styles.addDayLabel, { marginTop: 16, textAlign: "center" }]}>
                  Tuco está eligiendo el mejor ejercicio para esta sesión...
                </Text>
              </View>
            )}
            {addExerciseMode === "manual" && (
              <>
                <Text style={styles.addDayLabel}>Nombre del ejercicio</Text>
                <TextInput
                  style={styles.addDayInput}
                  placeholder="Ej: Press de banca, Sentadillas..."
                  placeholderTextColor="#9CA3AF"
                  value={manualExName}
                  onChangeText={setManualExName}
                  editable={!addingExercise}
                  returnKeyType="next"
                />
                <Text style={[styles.addDayLabel, { marginTop: 14 }]}>Series</Text>
                <TextInput
                  style={styles.addDayInput}
                  placeholder="Ej: 3"
                  placeholderTextColor="#9CA3AF"
                  value={manualExSets}
                  onChangeText={setManualExSets}
                  editable={!addingExercise}
                  keyboardType="number-pad"
                  returnKeyType="next"
                />
                <Text style={[styles.addDayLabel, { marginTop: 14 }]}>Repeticiones</Text>
                <TextInput
                  style={styles.addDayInput}
                  placeholder="Ej: 10-12 o 8"
                  placeholderTextColor="#9CA3AF"
                  value={manualExReps}
                  onChangeText={setManualExReps}
                  editable={!addingExercise}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addDaySubmitBtn, addingExercise && { opacity: 0.6 }]}
                  onPress={() => onAddExercise("manual")}
                  disabled={addingExercise}
                >
                  {addingExercise
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.addDaySubmitText}>Agregar</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addDayCancelBtn}
                  onPress={() => setAddExerciseMode("choose")}
                  disabled={addingExercise}
                >
                  <Text style={styles.addDayCancelText}>Volver</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
      {activeTab !== "ai" && (() => {
        const r = trainerRoutines.find((tr) => tr.id === activeTab);
        if (!r) return null;
        const expanded = trainerRoutineExpanded[r.id] ?? true;
        return (
          <View style={styles.trainerRoutineCard}>
            <View style={styles.trainerRoutineHeader}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() =>
                  setTrainerRoutineExpanded((prev) => ({ ...prev, [r.id]: !expanded }))
                }
                activeOpacity={0.8}
              >
                <Text style={styles.trainerRoutineLabel}>
                  Rutina de {r.trainerName ?? "tu entrenador"}
                </Text>
                <Text style={styles.trainerRoutineName}>{r.name}</Text>
                <Text style={styles.trainerRoutineDays}>
                  📅 {formatScheduledDays(r.scheduledDays)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.trainerDeleteBtn}
                onPress={() => onDeleteTrainerRoutine(r.id, r.name)}
                disabled={deletingRoutineId === r.id}
              >
                <Text style={styles.trainerDeleteBtnText}>
                  {deletingRoutineId === r.id ? "..." : "🗑"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.trainerRoutineChevron}>
                {expanded ? "▲" : "▼"}
              </Text>
            </View>

            {expanded && (
              <View style={styles.trainerRoutineBody}>
                <Text style={styles.trainerRoutinePurpose}>{r.purpose}</Text>
                {r.aiWarnings && r.aiWarnings.length > 0 && (
                  <View style={styles.trainerWarningBox}>
                    <Text style={styles.trainerWarningTitle}>⚠️ Notas (revisión IA)</Text>
                    {r.aiWarnings.map((w, i) => (
                      <Text key={i} style={styles.trainerWarningItem}>• {w}</Text>
                    ))}
                  </View>
                )}
                {r.exercises.map((ex) => {
                  const trainerSessionDay = `trainer:${r.id}`;
                  const exerciseKey = normalize(ex.name);
                  const sessionExerciseKey = `${trainerSessionDay}::${exerciseKey}`;
                  const progressPanelKey = `${trainerSessionDay}::${ex.name}::progress`;
                  const progress = strengthMap[exerciseKey];
                  const selectedWeekEntry = getWeeklyEntry(progress, selectedWeekStart);
                  const previousWeekEntry = getWeeklyEntry(progress, previousWeekStart);
                  const isProgressOpen = openProgressKey === progressPanelKey;
                  const isLogOpen =
                    activeLog?.sessionDay === trainerSessionDay &&
                    activeLog.exerciseName === exerciseKey;
                  const isExerciseDone = completedExercisesBySelectedWeek.has(sessionExerciseKey);
                  const canMarkCurrentWeek = selectedWeekStart === currentWeekStart;
                  const weeklyDelta =
                    selectedWeekEntry && previousWeekEntry
                      ? selectedWeekEntry.latestLoadKg - previousWeekEntry.latestLoadKg
                      : null;
                  const recentHistory = progress?.weeklyHistory.slice(-4).reverse() || [];

                  const progressNode = (
                    <>
                      <Text style={styles.exerciseProgressTitle}>Progreso</Text>
                      <Text style={styles.exerciseProgressLine}>
                        Esta semana:{" "}
                        {selectedWeekEntry
                          ? `${selectedWeekEntry.latestLoadKg.toFixed(1)} kg`
                          : "Sin registros"}
                      </Text>
                      <Text style={styles.exerciseProgressLine}>
                        Mejor histórico:{" "}
                        {progress ? `${progress.bestLoadKg.toFixed(1)} kg` : "Sin datos"}
                      </Text>
                      <Text style={styles.exerciseProgressLine}>
                        Último día:{" "}
                        {progress ? formatDateTime(progress.lastPerformedAt) : "Sin datos"}
                      </Text>
                      {weeklyDelta !== null ? (
                        <Text
                          style={[
                            styles.exerciseProgressLine,
                            weeklyDelta >= 0 ? styles.progressUp : styles.progressDown,
                          ]}
                        >
                          {weeklyDelta >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(weeklyDelta).toFixed(1)} kg vs semana anterior
                        </Text>
                      ) : (
                        <Text style={styles.exerciseProgressMuted}>
                          Registra al menos dos semanas para comparar.
                        </Text>
                      )}
                      {recentHistory.length > 0 && (
                        <View style={styles.historyChips}>
                          {recentHistory.map((item) => (
                            <View
                              key={`${ex.name}-${item.weekStart}`}
                              style={styles.historyChip}
                            >
                              <Text style={styles.historyChipWeek}>
                                {formatWeekLabel(item.weekStart)}
                              </Text>
                              <Text style={styles.historyChipValue}>
                                {item.latestLoadKg.toFixed(1)} kg
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  );

                  return (
                    <ExerciseCard
                      key={`${r.id}-${ex.name}`}
                      name={ex.name}
                      sets={ex.sets}
                      reps={String(ex.reps)}
                      restSeconds={ex.restSeconds}
                      tip={ex.tips ?? undefined}
                      status={isExerciseDone ? "completed" : isLogOpen ? "active" : "default"}
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
                        } else {
                          setActiveLog({ sessionDay: trainerSessionDay, exerciseName: exerciseKey });
                          setLogKg("");
                          setLogUnit("kg");
                          setLogReps(parseSuggestedReps(String(ex.reps)));
                          setLogSets(String(ex.sets || ""));
                          setLastSavedExerciseKey(null);
                        }
                      }}
                      onLogChange={(vals) => {
                        if (vals.loadValue !== undefined) setLogKg(vals.loadValue);
                        if (vals.loadUnit !== undefined) setLogUnit(vals.loadUnit);
                        if (vals.reps !== undefined) setLogReps(vals.reps);
                        if (vals.sets !== undefined) setLogSets(vals.sets);
                      }}
                      onMarkDone={() => onMarkExerciseCompleted(trainerSessionDay, ex.name)}
                      canMarkDone={canMarkCurrentWeek}
                      hasProgress={!!progress}
                      progressOpen={isProgressOpen}
                      onToggleProgress={() =>
                        setOpenProgressKey((prev) =>
                          prev === progressPanelKey ? null : progressPanelKey
                        )
                      }
                      progressContent={progressNode}
                    />
                  );
                })}
              </View>
            )}
          </View>
        );
      })()}

      {/* AI plan panel — only shown when AI tab is active */}
      {activeTab === "ai" && (<>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Plan semanal</Text>
        <Text style={styles.title}>Rutina</Text>
        <Text style={styles.subtitle}>
          Visualiza tu semana, marca sesiones completadas y registra la carga dentro de cada ejercicio.
        </Text>
        {generatedAt ? (
          <Text style={styles.generatedAt}>Ultima generacion: {formatDateTime(generatedAt)}</Text>
        ) : null}
        {strengthSummary ? (
          <Text style={styles.summaryBadge}>
            {strengthSummary.activeExercises} ejercicios con historial • {strengthSummary.improvingExercises} mejorando
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.genBtn, loadingRoutine && styles.genBtnDisabled]}
        onPress={onGenerate}
        disabled={loadingRoutine}
      >
        {loadingRoutine ? (
          <ActivityIndicator color={palette.cocoa} />
        ) : (
          <Text style={styles.genBtnText}>
            {routine ? "Regenerar con Tuco" : "Crear plan con Tuco"}
          </Text>
        )}
      </TouchableOpacity>

      {loadingRoutine && (
        <Text style={styles.loadingHint}>Tuco está creando tu plan... Esto puede tardar unos segundos.</Text>
      )}

      {!routine ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Todavia no tienes una rutina guardada</Text>
          <Text style={styles.emptyCopy}>
            Genera tu primera rutina para empezar a registrar avance semanal y progreso de cargas.
          </Text>
        </View>
      ) : (
        <View style={styles.routineContainer}>
          <View style={styles.routineHeader}>
            <Text style={styles.routineName}>{routine.routine_name}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>{routine.duration_weeks} semanas</Text>
              </View>
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>{routine.weekly_sessions} sesiones por semana</Text>
              </View>
            </View>

            <Text style={styles.sectionCaption}>Selecciona una semana</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekSelector}
            >
              {availableWeeks.map((week) => {
                const selected = week === selectedWeekStart;
                const label = week === currentWeekStart ? "Actual" : formatWeekLabel(week);

                return (
                  <TouchableOpacity
                    key={week}
                    style={[styles.weekChip, selected && styles.weekChipSelected]}
                    onPress={() => setSelectedWeekStart(week)}
                  >
                    <Text style={[styles.weekChipText, selected && styles.weekChipTextSelected]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.weekSummaryGrid}>
              <View style={styles.weekSummaryCard}>
                <Text style={styles.weekSummaryLabel}>Sesiones completadas</Text>
                <Text style={styles.weekSummaryValue}>
                  {sessionsCompleted}/{routine.weekly_sessions}
                </Text>
              </View>
              <View style={styles.weekSummaryCard}>
                <Text style={styles.weekSummaryLabel}>Vs semana anterior</Text>
                <Text style={styles.weekSummaryValue}>
                  {sessionsCompleted - previousWeekCompleted >= 0 ? "+" : ""}
                  {sessionsCompleted - previousWeekCompleted}
                </Text>
              </View>
              <View style={styles.weekSummaryCard}>
                <Text style={styles.weekSummaryLabel}>Ejercicios al alza</Text>
                <Text style={styles.weekSummaryValue}>{improvingThisWeek}</Text>
              </View>
            </View>

            {syncingCheckins ? <Text style={styles.syncText}>Sincronizando progreso...</Text> : null}
          </View>

          {/* ─ 3-month progress calendar ─ */}
          <View style={styles.calendarSection}>
            <Text style={styles.calendarSectionTitle}>Progreso mensual</Text>
            <View style={styles.calendarNavRow}>
              <TouchableOpacity
                onPress={() => setSelectedCalendarMonthIdx((i) => Math.max(0, i - 1))}
                disabled={selectedCalendarMonthIdx === 0}
                style={[styles.calendarNavBtn, selectedCalendarMonthIdx === 0 && styles.calendarNavBtnDisabled]}
              >
                <Text style={styles.calendarNavBtnText}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.calendarMonthLabel}>
                {`${MONTH_LABELS[calendarMonths[selectedCalendarMonthIdx].getUTCMonth()]} ${calendarMonths[selectedCalendarMonthIdx].getUTCFullYear()}`}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedCalendarMonthIdx((i) => Math.min(2, i + 1))}
                disabled={selectedCalendarMonthIdx === 2}
                style={[styles.calendarNavBtn, selectedCalendarMonthIdx === 2 && styles.calendarNavBtnDisabled]}
              >
                <Text style={styles.calendarNavBtnText}>{'>'}</Text>
              </TouchableOpacity>
            </View>
            {(() => {
              const monthStart = calendarMonths[selectedCalendarMonthIdx];
              const cells = buildCalMonthMatrix(monthStart);
              return (
                <View>
                  <View style={styles.calendarWeekRow}>
                    {WEEK_HEADERS.map((h) => (
                      <Text key={h} style={styles.calendarWeekHeader}>{h}</Text>
                    ))}
                  </View>
                  {Array.from({ length: cells.length / 7 }, (_, row) => (
                    <View key={row} style={styles.calendarWeekRow}>
                      {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                        if (!day) return <View key={col} style={styles.calendarCell} />;
                        const key = day.toISOString().slice(0, 10);
                        const done = checkinDateSet.has(key);
                        return (
                          <View key={col} style={[styles.calendarCell, done && styles.calendarCellDone]}>
                            <Text style={[styles.calendarDayText, done && styles.calendarDayTextDone]}>
                              {day.getUTCDate()}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>

          {[...routine.sessions].sort((a, b) => {
            const JS_TO_DAY_NAME: Record<number, string> = { 0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday" };
            const todayOffset = DAY_OFFSETS[JS_TO_DAY_NAME[new Date().getDay()]] ?? 0;
            const aOffset = DAY_OFFSETS[normalize(a.day)] ?? 0;
            const bOffset = DAY_OFFSETS[normalize(b.day)] ?? 0;
            return ((aOffset - todayOffset + 7) % 7) - ((bOffset - todayOffset + 7) % 7);
          }).map((session) => {
            const normalizedDay = normalize(session.day);
            const isDone = completedBySelectedWeek.has(normalizedDay);
            const isSaving = savingSessionDay === session.day;
            const completedAt = selectedWeekCompletedAt[normalizedDay];
            const canMarkCurrentWeek = selectedWeekStart === currentWeekStart;
            const completedExercisesCount = session.exercises.filter((exercise) =>
              completedExercisesBySelectedWeek.has(`${normalizedDay}::${normalize(exercise.name)}`)
            ).length;
            const allExercisesCompleted =
              session.exercises.length > 0 && completedExercisesCount === session.exercises.length;
            const canRegenerateDay = canMarkCurrentWeek && !isDone && !allExercisesCompleted;

            return (
              <View key={session.day} style={[styles.sessionCard, isDone && styles.sessionCardDone]}>
                <TouchableOpacity
                  style={styles.sessionHeader}
                  onPress={() => setOpenSession(openSession === session.day ? null : session.day)}
                >
                  <View style={styles.sessionHeaderLeft}>
                    {isDone ? <Text style={styles.doneCheck}>✓ </Text> : null}
                    <View>
                      <Text style={[styles.sessionDay, isDone && styles.sessionDayDone]}>
                        {translateDay(session.day)}
                        {getDateForDay(session.day, selectedWeekStart) ? (
                          <Text style={{ fontSize: 13, fontWeight: "400", opacity: 0.65 }}>
                            {"  "}{getDateForDay(session.day, selectedWeekStart)}
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={styles.sessionFocus}>{session.focus}</Text>
                      <Text style={styles.sessionStatus}>
                        {completedAt
                          ? `Completada el ${formatDateTime(completedAt)}`
                          : canMarkCurrentWeek
                          ? "Pendiente esta semana"
                          : "Sin registro en esta semana"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionMeta}>
                    <Text style={styles.sessionDuration}>{session.duration_minutes} min</Text>
                    <Text style={styles.sessionArrow}>{openSession === session.day ? "▲" : "▼"}</Text>
                  </View>
                </TouchableOpacity>

                {openSession === session.day ? (
                  <View style={styles.exerciseList}>
                    <TouchableOpacity
                      style={[
                        styles.completeBtn,
                        (isDone || !canMarkCurrentWeek) && styles.completeBtnDone,
                      ]}
                      disabled={isDone || isSaving || !canMarkCurrentWeek}
                      onPress={() => onMarkCompleted(session.day)}
                    >
                      <Text
                        style={[
                          styles.completeBtnText,
                          (isDone || !canMarkCurrentWeek) && styles.completeBtnTextDone,
                        ]}
                      >
                        {isDone
                          ? "Sesion completada"
                          : !canMarkCurrentWeek
                          ? "Solo puedes registrar la semana actual"
                          : isSaving
                          ? "Guardando..."
                          : !allExercisesCompleted && completedExercisesCount > 0
                          ? `Cerrar sesion (${session.exercises.length - completedExercisesCount} ejercicio(s) pendiente(s))`
                          : !allExercisesCompleted
                          ? "Cerrar sesion sin registrar ejercicios"
                          : "Marcar sesion como completada"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.secondaryActionBtn,
                        (!canRegenerateDay || regeneratingSessionDay === session.day) && styles.genBtnDisabled,
                      ]}
                      onPress={() => onRegenerateDay(session.day)}
                      disabled={!canRegenerateDay || regeneratingSessionDay === session.day}
                    >
                      <Text style={styles.secondaryActionBtnText}>
                        {regeneratingSessionDay === session.day
                          ? "Regenerando dia..."
                          : !canRegenerateDay
                          ? "No disponible: dia con progreso"
                          : `Regenerar ${translateDay(session.day)}`}
                      </Text>
                    </TouchableOpacity>

                    {session.exercises.map((exercise) => {
                      const exerciseKey = normalize(exercise.name);
                      const sessionExerciseKey = `${normalize(session.day)}::${exerciseKey}`;
                      const progressPanelKey = `${session.day}::${exercise.name}::progress`;
                      const progress = strengthMap[exerciseKey];
                      const selectedWeekEntry = getWeeklyEntry(progress, selectedWeekStart);
                      const previousWeekEntry = getWeeklyEntry(progress, previousWeekStart);
                      const isProgressOpen = openProgressKey === progressPanelKey;
                      const isLogOpen =
                        activeLog?.sessionDay === session.day && activeLog.exerciseName === exerciseKey;
                      const isExerciseDone = completedExercisesBySelectedWeek.has(sessionExerciseKey);
                      const actionKey = `${session.day}::${exercise.name}`;
                      const weeklyDelta =
                        selectedWeekEntry && previousWeekEntry
                          ? selectedWeekEntry.latestLoadKg - previousWeekEntry.latestLoadKg
                          : null;
                      const recentHistory = progress?.weeklyHistory.slice(-4).reverse() || [];

                      const progressNode = (
                        <>
                          <Text style={styles.exerciseProgressTitle}>Progreso</Text>
                          <Text style={styles.exerciseProgressLine}>
                            Esta semana: {selectedWeekEntry ? `${selectedWeekEntry.latestLoadKg.toFixed(1)} kg` : "Sin registros"}
                          </Text>
                          <Text style={styles.exerciseProgressLine}>
                            Mejor histórico: {progress ? `${progress.bestLoadKg.toFixed(1)} kg` : "Sin datos"}
                          </Text>
                          <Text style={styles.exerciseProgressLine}>
                            Último día: {progress ? formatDateTime(progress.lastPerformedAt) : "Sin datos"}
                          </Text>
                          {weeklyDelta !== null ? (
                            <Text style={[styles.exerciseProgressLine, weeklyDelta >= 0 ? styles.progressUp : styles.progressDown]}>
                              {weeklyDelta >= 0 ? "▲" : "▼"} {Math.abs(weeklyDelta).toFixed(1)} kg vs semana anterior
                            </Text>
                          ) : (
                            <Text style={styles.exerciseProgressMuted}>
                              Registra al menos dos semanas para comparar.
                            </Text>
                          )}
                          {recentHistory.length > 0 && (
                            <View style={styles.historyChips}>
                              {recentHistory.map((item) => (
                                <View key={`${exercise.name}-${item.weekStart}`} style={styles.historyChip}>
                                  <Text style={styles.historyChipWeek}>{formatWeekLabel(item.weekStart)}</Text>
                                  <Text style={styles.historyChipValue}>{item.latestLoadKg.toFixed(1)} kg</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </>
                      );

                      return (
                        <ExerciseCard
                          key={`${session.day}-${exercise.name}`}
                          name={exercise.name}
                          sets={exercise.sets}
                          reps={exercise.reps}
                          restSeconds={exercise.rest_seconds}
                          tip={exercise.notes}
                          status={isExerciseDone ? "completed" : isLogOpen ? "active" : "default"}
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
                            } else {
                              openExerciseLog(session.day, exercise);
                            }
                          }}
                          onLogChange={(vals) => {
                            if (vals.loadValue !== undefined) setLogKg(vals.loadValue);
                            if (vals.loadUnit  !== undefined) setLogUnit(vals.loadUnit);
                            if (vals.reps      !== undefined) setLogReps(vals.reps);
                            if (vals.sets      !== undefined) setLogSets(vals.sets);
                          }}
                          onMarkDone={() => onMarkExerciseCompleted(session.day, exercise.name)}
                          canMarkDone={canMarkCurrentWeek}
                          hasProgress={!!progress}
                          progressOpen={isProgressOpen}
                          onToggleProgress={() =>
                            setOpenProgressKey((prev) =>
                              prev === progressPanelKey ? null : progressPanelKey
                            )
                          }
                          progressContent={progressNode}
                          replacements={
                            openOptionsKey === actionKey
                              ? (replacementOptionsByKey[actionKey] || []).map(
                                  (o): ExerciseReplacement => ({
                                    name: o.name,
                                    sets: o.sets,
                                    reps: o.reps,
                                    rest_seconds: o.rest_seconds,
                                  })
                                )
                              : undefined
                          }
                          replacementsLoading={optionsLoadingKey === actionKey}
                          onSelectReplacement={(opt) =>
                            onSelectManualReplacement(session.day, exercise.name, {
                              name: opt.name,
                              sets: opt.sets,
                              reps: opt.reps,
                              rest_seconds: opt.rest_seconds,
                            })
                          }
                          menuOptions={[
                            {
                              label: replacingExerciseKey === actionKey ? "Reemplazando..." : "Reemplazar con Tuco",
                              loading: replacingExerciseKey === actionKey,
                              onPress: () => onReplaceExercise(session.day, exercise.name),
                            },
                            {
                              label: optionsLoadingKey === actionKey ? "Buscando opciones..." : "Elegir alternativa",
                              loading: optionsLoadingKey === actionKey,
                              onPress: () => onLoadReplacementOptions(session.day, exercise),
                            },
                            {
                              label: removingExerciseKey === actionKey ? "Eliminando..." : "Eliminar ejercicio",
                              loading: removingExerciseKey === actionKey,
                              destructive: true,
                              onPress: () => onRemoveExercise(session.day, exercise.name),
                            },
                          ]}
                        />
                      );
                    })}
                    <TouchableOpacity
                      style={styles.addExerciseBtn}
                      onPress={() => handleOpenAddExercise(session.day)}
                    >
                      <Text style={styles.addExerciseBtnText}>＋ Agregar ejercicio</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.addDayBtn}
            onPress={() => {
              setAddDayDay("monday");
              setAddDayFocus("");
              setShowAddDayModal(true);
            }}
          >
            <Text style={styles.addDayBtnText}>+ Agregar nuevo día</Text>
          </TouchableOpacity>

          {routine.progression_tips?.length > 0 ? (
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Consejos de progresion</Text>
              {routine.progression_tips.map((tip, index) => (
                <Text key={`${tip}-${index}`} style={styles.tip}>
                  • {tip}
                </Text>
              ))}
            </View>
          ) : null}

          {routine.nutrition_notes ? (
            <View style={styles.nutritionCard}>
              <Text style={styles.tipsTitle}>Notas nutricionales</Text>
              <Text style={styles.nutritionText}>{routine.nutrition_notes}</Text>
            </View>
          ) : null}
        </View>
      )}
      </>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: palette.background,
    padding: 20,
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
  },
  calendarCellDone: {
    backgroundColor: "#22c55e",
  },
  calendarDayText: {
    fontSize: 11,
    color: palette.textSoft,
  },
  calendarDayTextDone: {
    color: "#fff",
    fontWeight: "700",
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