import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  ExerciseStrengthProgress,
  GeneratedRoutine,
  RoutineCheckin,
  RoutineExercise,
  RoutineExerciseCheckin,
  StrengthProgressSummary,
  StrengthWeeklyHistoryPoint,
} from "../../types/api";

const DAY_TRANSLATIONS: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miercoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sabado",
  sunday: "Domingo",
};

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
      if (!openSession && data.routine.sessions.length > 0) {
        setOpenSession(data.routine.sessions[0].day);
      }
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

  const reloadAll = useCallback(async () => {
    if (!user || !token) {
      return;
    }

    try {
      await Promise.all([loadLatestRoutine(), loadCheckins(), loadStrengthProgress()]);
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

  const onGenerate = async () => {
    if (!user || !token) return;

    setLoadingRoutine(true);
    try {
      const data = await api.getRoutine(user.id, token);
      const raw = data.routine as string | GeneratedRoutine;
      const parsed: GeneratedRoutine = typeof raw === "string" ? JSON.parse(raw) : raw;
      setRoutine(parsed);
      setGeneratedAt(new Date().toISOString());
      setOpenSession(parsed.sessions[0]?.day ?? null);
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
            {routine ? "Regenerar rutina" : "Generar rutina personalizada"}
          </Text>
        )}
      </TouchableOpacity>

      {loadingRoutine && (
        <Text style={styles.loadingHint}>Consultando a tu coach personalizado. Esto puede tardar unos segundos.</Text>
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

          {routine.sessions.map((session) => {
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
                        (isDone || !canMarkCurrentWeek || !allExercisesCompleted) && styles.completeBtnDone,
                      ]}
                      disabled={isDone || isSaving || !canMarkCurrentWeek || !allExercisesCompleted}
                      onPress={() => onMarkCompleted(session.day)}
                    >
                      <Text
                        style={[
                          styles.completeBtnText,
                          (isDone || !canMarkCurrentWeek || !allExercisesCompleted) && styles.completeBtnTextDone,
                        ]}
                      >
                        {isDone
                          ? "Sesion completada"
                          : !canMarkCurrentWeek
                          ? "Solo puedes registrar la semana actual"
                          : !allExercisesCompleted
                          ? `Completa ${session.exercises.length - completedExercisesCount} ejercicio(s) para cerrar el dia`
                          : isSaving
                          ? "Guardando..."
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
                      const progress = strengthMap[exerciseKey];
                      const selectedWeekEntry = getWeeklyEntry(progress, selectedWeekStart);
                      const previousWeekEntry = getWeeklyEntry(progress, previousWeekStart);
                      const isLogOpen =
                        activeLog?.sessionDay === session.day && activeLog.exerciseName === exerciseKey;
                      const isExerciseDone = completedExercisesBySelectedWeek.has(sessionExerciseKey);
                      const actionKey = `${session.day}::${exercise.name}`;
                      const weeklyDelta =
                        selectedWeekEntry && previousWeekEntry
                          ? selectedWeekEntry.latestLoadKg - previousWeekEntry.latestLoadKg
                          : null;
                      const recentHistory = progress?.weeklyHistory.slice(-4).reverse() || [];

                      return (
                        <View key={`${session.day}-${exercise.name}`} style={styles.exerciseRow}>
                          <Text style={styles.exName}>
                            {exercise.name}
                            {isExerciseDone ? "  ✓" : ""}
                          </Text>
                          <View style={styles.exDetails}>
                            <Text style={styles.exTag}>{exercise.sets} series</Text>
                            <Text style={styles.exTag}>{exercise.reps} reps</Text>
                            <Text style={styles.exTag}>{exercise.rest_seconds}s descanso</Text>
                          </View>
                          {exercise.notes ? <Text style={styles.exNotes}>{exercise.notes}</Text> : null}

                          <View style={styles.exerciseProgressCard}>
                            <Text style={styles.exerciseProgressTitle}>Progreso del ejercicio</Text>
                            <Text style={styles.exerciseProgressLine}>
                              Semana seleccionada: {selectedWeekEntry ? `${selectedWeekEntry.latestLoadKg.toFixed(1)} kg` : "Sin registros"}
                            </Text>
                            <Text style={styles.exerciseProgressLine}>
                              Mejor historico: {progress ? `${progress.bestLoadKg.toFixed(1)} kg` : "Sin datos"}
                            </Text>
                            <Text style={styles.exerciseProgressLine}>
                              Ultima ejecucion: {progress ? formatDateTime(progress.lastPerformedAt) : "Sin datos"}
                            </Text>
                            {weeklyDelta !== null ? (
                              <Text style={[styles.exerciseProgressLine, weeklyDelta >= 0 ? styles.progressUp : styles.progressDown]}>
                                {weeklyDelta >= 0 ? "Subiste" : "Bajaste"} {Math.abs(weeklyDelta).toFixed(1)} kg vs semana anterior
                              </Text>
                            ) : (
                              <Text style={styles.exerciseProgressMuted}>
                                Registra al menos dos semanas para comparar este ejercicio.
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
                          </View>

                          <TouchableOpacity
                            style={styles.logToggleBtn}
                            disabled={isExerciseDone}
                            onPress={() => {
                              if (isLogOpen) {
                                setActiveLog(null);
                              } else {
                                openExerciseLog(session.day, exercise);
                              }
                            }}
                          >
                            <Text style={styles.logToggleText}>
                              {isExerciseDone
                                ? "Ejercicio completado"
                                : isLogOpen
                                ? "Cancelar"
                                : progress
                                ? "Actualizar carga"
                                : "Registrar carga"}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.completeExerciseBtn, isExerciseDone && styles.completeBtnDone]}
                            disabled={isExerciseDone || !canMarkCurrentWeek}
                            onPress={() => onMarkExerciseCompleted(session.day, exercise.name)}
                          >
                            <Text style={[styles.completeExerciseBtnText, isExerciseDone && styles.completeBtnTextDone]}>
                              {isExerciseDone
                                ? "Ejercicio realizado"
                                : !canMarkCurrentWeek
                                ? "Solo semana actual"
                                : "Marcar ejercicio realizado"}
                            </Text>
                          </TouchableOpacity>

                          <View style={styles.exerciseActionsRow}>
                            <TouchableOpacity
                              style={[
                                styles.exerciseActionBtn,
                                (isExerciseDone || replacingExerciseKey === actionKey) && styles.genBtnDisabled,
                              ]}
                              onPress={() => onReplaceExercise(session.day, exercise.name)}
                              disabled={isExerciseDone || replacingExerciseKey === actionKey}
                            >
                              <Text style={styles.exerciseActionBtnText}>
                                {replacingExerciseKey === actionKey
                                  ? "Recomendando..."
                                  : "Recomendar otro"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.exerciseActionBtn,
                                (isExerciseDone || optionsLoadingKey === actionKey || manualReplacingKey === actionKey) &&
                                  styles.genBtnDisabled,
                              ]}
                              onPress={() => onLoadReplacementOptions(session.day, exercise)}
                              disabled={isExerciseDone || optionsLoadingKey === actionKey || manualReplacingKey === actionKey}
                            >
                              <Text style={styles.exerciseActionBtnText}>
                                {optionsLoadingKey === actionKey
                                  ? "Buscando opciones..."
                                  : manualReplacingKey === actionKey
                                  ? "Aplicando opcion..."
                                  : "Elegir siguiente"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.exerciseActionBtnDanger,
                                (isExerciseDone || removingExerciseKey === actionKey) && styles.genBtnDisabled,
                              ]}
                              onPress={() => onRemoveExercise(session.day, exercise.name)}
                              disabled={isExerciseDone || removingExerciseKey === actionKey}
                            >
                              <Text style={styles.exerciseActionBtnDangerText}>
                                {removingExerciseKey === actionKey
                                  ? "Eliminando..."
                                  : "Eliminar"}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {openOptionsKey === actionKey ? (
                            <View style={styles.optionsPanel}>
                              <Text style={styles.optionsPanelTitle}>Opciones sugeridas para este ejercicio</Text>
                              {(replacementOptionsByKey[actionKey] || []).map((option) => (
                                <TouchableOpacity
                                  key={`${actionKey}-${option.name}`}
                                  style={styles.optionRow}
                                  onPress={() =>
                                    onSelectManualReplacement(session.day, exercise.name, option)
                                  }
                                  disabled={manualReplacingKey === actionKey}
                                >
                                  <Text style={styles.optionName}>{option.name}</Text>
                                  <Text style={styles.optionMeta}>
                                    {option.sets} series • {option.reps} reps • {option.rest_seconds}s
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ) : null}

                          {isLogOpen ? (
                            <View style={styles.logForm}>
                              <View style={styles.unitSelectorRow}>
                                <TouchableOpacity
                                  style={[styles.unitChip, logUnit === "kg" && styles.unitChipSelected]}
                                  onPress={() => setLogUnit("kg")}
                                >
                                  <Text style={[styles.unitChipText, logUnit === "kg" && styles.unitChipTextSelected]}>
                                    kg
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.unitChip, logUnit === "lb" && styles.unitChipSelected]}
                                  onPress={() => setLogUnit("lb")}
                                >
                                  <Text style={[styles.unitChipText, logUnit === "lb" && styles.unitChipTextSelected]}>
                                    lb
                                  </Text>
                                </TouchableOpacity>
                              </View>
                              <View style={styles.logFormRow}>
                                <TextInput
                                  placeholder={logUnit === "kg" ? "Carga (kg)" : "Carga (lb)"}
                                  placeholderTextColor={palette.textSoft}
                                  style={[styles.input, styles.inputKg]}
                                  keyboardType="decimal-pad"
                                  value={logKg}
                                  onChangeText={setLogKg}
                                />
                                <TextInput
                                  placeholder="Reps"
                                  placeholderTextColor={palette.textSoft}
                                  style={[styles.input, styles.inputSmall]}
                                  keyboardType="number-pad"
                                  value={logReps}
                                  onChangeText={setLogReps}
                                />
                                <TextInput
                                  placeholder="Series"
                                  placeholderTextColor={palette.textSoft}
                                  style={[styles.input, styles.inputSmall]}
                                  keyboardType="number-pad"
                                  value={logSets}
                                  onChangeText={setLogSets}
                                />
                              </View>
                              <Text style={styles.autoSaveHint}>
                                Guardado automatico al escribir una carga valida.
                              </Text>
                              {savingLog ? <Text style={styles.autoSaveStatus}>Guardando...</Text> : null}
                              {lastSavedExerciseKey?.startsWith(`${exerciseKey}::`) ? (
                                <Text style={styles.autoSaveStatusSuccess}>Ultimo registro guardado correctamente.</Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}

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
});