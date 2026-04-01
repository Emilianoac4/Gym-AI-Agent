import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  RoutineCheckin,
  StrengthProgressSummary,
} from "../../types/api";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
}

interface Session {
  day: string;
  focus: string;
  duration_minutes: number;
  exercises: Exercise[];
}

interface Routine {
  routine_name: string;
  duration_weeks: number;
  weekly_sessions: number;
  sessions: Session[];
  progression_tips: string[];
  nutrition_notes: string;
}

export function RoutineScreen() {
  const { user, token } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingCheckins, setSyncingCheckins] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<RoutineCheckin[]>([]);
  const [savingSessionDay, setSavingSessionDay] = useState<string | null>(null);
  // Per-exercise inline log form
  const [activeLog, setActiveLog] = useState<{ sessionDay: string; exerciseName: string } | null>(null);
  const [logKg, setLogKg] = useState("");
  const [logReps, setLogReps] = useState("");
  const [logSets, setLogSets] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  // Optimistic check-in (immediate visual feedback before API confirms)
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const [strengthSummary, setStrengthSummary] = useState<StrengthProgressSummary | null>(null);
  const [strengthByExercise, setStrengthByExercise] = useState<ExerciseStrengthProgress[]>([]);

  const currentWeekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day + 6) % 7;
    now.setDate(now.getDate() - diff);
    now.setHours(0, 0, 0, 0);
    return now.toISOString().slice(0, 10);
  }, []);

  const normalized = (value: string) => value.trim().toLowerCase();

  const completedThisWeek = useMemo(() => {
    const set = new Set<string>();
    checkins.forEach((item) => {
      if (item.weekStart === currentWeekStart) {
        set.add(normalized(item.sessionDay));
      }
    });
    // merge optimistic completions for immediate visual feedback
    localCompleted.forEach((d) => set.add(d));
    return set;
  }, [checkins, currentWeekStart, localCompleted]);

  // Lookup map: normalized exercise name → strength progress
  const strengthMap = useMemo(() => {
    const map: Record<string, ExerciseStrengthProgress> = {};
    strengthByExercise.forEach((e) => {
      map[e.exerciseName] = e;
    });
    return map;
  }, [strengthByExercise]);

  const loadCheckins = async () => {
    if (!user || !token) return;
    setSyncingCheckins(true);
    try {
      const data = await api.getRoutineCheckins(user.id, token, 56);
      setCheckins(data.checkins);
      // Once server confirms, clear optimistic set
      setLocalCompleted(new Set());
    } catch {
      // Keep the screen usable even when check-in sync fails.
    } finally {
      setSyncingCheckins(false);
    }
  };

  const loadStrengthProgress = async () => {
    if (!user || !token) return;
    try {
      const data = await api.getStrengthProgress(user.id, token, 90);
      setStrengthSummary(data.summary);
      setStrengthByExercise(data.exercises);
    } catch {
      setStrengthSummary(null);
      setStrengthByExercise([]);
    }
  };

  useEffect(() => {
    loadCheckins();
    loadStrengthProgress();
  }, [user?.id, token]);

  const onGenerate = async () => {
    if (!user || !token) return;

    setLoading(true);
    setRoutine(null);
    setOpenSession(null);
    try {
      const data = await api.getRoutine(user.id, token);
      const raw = data.routine as string | Routine;
      const parsed: Routine = typeof raw === "string" ? JSON.parse(raw) : raw;
      setRoutine(parsed);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo generar la rutina"
      );
    } finally {
      setLoading(false);
    }
  };

  const onMarkCompleted = async (sessionDay: string) => {
    if (!user || !token) return;
    const norm = normalized(sessionDay);
    // Optimistic: show as completed immediately
    setLocalCompleted((prev) => new Set([...prev, norm]));
    setSavingSessionDay(sessionDay);
    try {
      await api.createRoutineCheckin(user.id, token, { sessionDay });
      await loadCheckins();
    } catch (error) {
      // Revert optimistic on failure
      setLocalCompleted((prev) => {
        const next = new Set(prev);
        next.delete(norm);
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

  const onSaveExerciseLog = async (exerciseName: string) => {
    if (!user || !token) return;
    const loadKg = Number.parseFloat(logKg);
    if (!Number.isFinite(loadKg) || loadKg <= 0) {
      Alert.alert("Dato inválido", "Ingresa una carga válida en kg.");
      return;
    }
    const reps = logReps.trim() ? Number.parseInt(logReps.trim(), 10) : undefined;
    const sets = logSets.trim() ? Number.parseInt(logSets.trim(), 10) : undefined;
    setSavingLog(true);
    try {
      await api.createStrengthLog(user.id, token, { exerciseName, loadKg, reps, sets });
      setActiveLog(null);
      setLogKg("");
      setLogReps("");
      setLogSets("");
      await loadStrengthProgress();
      Alert.alert("Carga guardada", `Progreso de "${exerciseName}" actualizado.`);
    } catch (error) {
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setSavingLog(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Planificacion inteligente</Text>
        <Text style={styles.title}>Rutina IA</Text>
        <Text style={styles.subtitle}>
          Genera un plan de entrenamiento adaptado a tu perfil actual.
        </Text>
        {strengthSummary && (
          <Text style={styles.summaryBadge}>
            {strengthSummary.activeExercises} ejercicios • {strengthSummary.improvingExercises} en mejora
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.genBtn, loading && styles.genBtnDisabled]}
        onPress={onGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={palette.cocoa} />
        ) : (
          <Text style={styles.genBtnText}>
            {routine ? "Regenerar rutina" : "Generar rutina personalizada"}
          </Text>
        )}
      </TouchableOpacity>

      {loading && (
        <Text style={styles.loadingHint}>
          Consultando a GPT-4... esto puede tardar unos segundos.
        </Text>
      )}

      {routine && (
        <View style={styles.routineContainer}>
          {/* Header */}
          <View style={styles.routineHeader}>
            <Text style={styles.routineName}>{routine.routine_name}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>{routine.duration_weeks} semanas</Text>
              </View>
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>{routine.weekly_sessions} sesiones/semana</Text>
              </View>
            </View>
            <Text style={styles.progressText}>
              Esta semana: {Math.min(completedThisWeek.size, routine.weekly_sessions)}/
              {routine.weekly_sessions} sesiones completadas
            </Text>
            {syncingCheckins && (
              <Text style={styles.syncText}>Sincronizando...</Text>
            )}
          </View>

          {/* Sessions */}
          {routine.sessions?.map((session, i) => {
            const isDone = completedThisWeek.has(normalized(session.day));
            const isSaving = savingSessionDay === session.day;
            return (
              <View key={i} style={[styles.sessionCard, isDone && styles.sessionCardDone]}>
                <TouchableOpacity
                  style={styles.sessionHeader}
                  onPress={() =>
                    setOpenSession(openSession === session.day ? null : session.day)
                  }
                >
                  <View style={styles.sessionHeaderLeft}>
                    {isDone && <Text style={styles.doneCheck}>✓ </Text>}
                    <View>
                      <Text style={[styles.sessionDay, isDone && styles.sessionDayDone]}>
                        {session.day}
                      </Text>
                      <Text style={styles.sessionFocus}>{session.focus}</Text>
                    </View>
                  </View>
                  <View style={styles.sessionMeta}>
                    <Text style={styles.sessionDuration}>{session.duration_minutes} min</Text>
                    <Text style={styles.sessionArrow}>
                      {openSession === session.day ? "▲" : "▼"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {openSession === session.day && (
                  <View style={styles.exerciseList}>
                    {/* Mark complete button */}
                    <TouchableOpacity
                      style={[styles.completeBtn, isDone && styles.completeBtnDone]}
                      disabled={isDone || isSaving}
                      onPress={() => onMarkCompleted(session.day)}
                    >
                      <Text style={[styles.completeBtnText, isDone && styles.completeBtnTextDone]}>
                        {isDone
                          ? "✓ Sesión completada esta semana"
                          : isSaving
                          ? "Guardando..."
                          : "Marcar sesión como completada"}
                      </Text>
                    </TouchableOpacity>

                    {/* Exercises with inline log */}
                    {session.exercises?.map((ex, j) => {
                      const exKey = normalized(ex.name);
                      const progress = strengthMap[exKey];
                      const isLogOpen =
                        activeLog?.sessionDay === session.day &&
                        activeLog?.exerciseName === exKey;

                      return (
                        <View key={j} style={styles.exerciseRow}>
                          <Text style={styles.exName}>{ex.name}</Text>
                          <View style={styles.exDetails}>
                            <Text style={styles.exTag}>{ex.sets} series</Text>
                            <Text style={styles.exTag}>{ex.reps} reps</Text>
                            <Text style={styles.exTag}>{ex.rest_seconds}s descanso</Text>
                          </View>
                          {ex.notes ? (
                            <Text style={styles.exNotes}>{ex.notes}</Text>
                          ) : null}

                          {/* Inline strength progress for this exercise */}
                          {progress && (
                            <View style={styles.exProgress}>
                              <Text style={styles.exProgressText}>
                                Último: {progress.latestLoadKg.toFixed(1)} kg
                                {"  "}Mejor: {progress.bestLoadKg.toFixed(1)} kg
                                {progress.absoluteChangeKg !== 0 && (
                                  <Text
                                    style={
                                      progress.absoluteChangeKg > 0
                                        ? styles.progressUp
                                        : styles.progressDown
                                    }
                                  >
                                    {"  "}
                                    {progress.absoluteChangeKg > 0 ? "▲" : "▼"}{" "}
                                    {Math.abs(progress.absoluteChangeKg).toFixed(1)} kg
                                  </Text>
                                )}
                              </Text>
                              {progress.estimatedOneRM ? (
                                <Text style={styles.exProgressSub}>
                                  1RM estimado: {progress.estimatedOneRM.toFixed(1)} kg
                                </Text>
                              ) : null}
                            </View>
                          )}

                          {/* Toggle log form */}
                          <TouchableOpacity
                            style={styles.logToggleBtn}
                            onPress={() => {
                              if (isLogOpen) {
                                setActiveLog(null);
                              } else {
                                setActiveLog({ sessionDay: session.day, exerciseName: exKey });
                                setLogKg("");
                                setLogReps(String(ex.sets > 0 ? ex.reps : ""));
                                setLogSets(String(ex.sets > 0 ? ex.sets : ""));
                              }
                            }}
                          >
                            <Text style={styles.logToggleText}>
                              {isLogOpen ? "Cancelar" : progress ? "Actualizar carga" : "+ Registrar carga"}
                            </Text>
                          </TouchableOpacity>

                          {/* Inline log form */}
                          {isLogOpen && (
                            <View style={styles.logForm}>
                              <View style={styles.logFormRow}>
                                <TextInput
                                  placeholder="Kg"
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
                              <TouchableOpacity
                                style={[styles.logSaveBtn, savingLog && styles.genBtnDisabled]}
                                onPress={() => onSaveExerciseLog(ex.name)}
                                disabled={savingLog}
                              >
                                <Text style={styles.logSaveBtnText}>
                                  {savingLog ? "Guardando..." : "Guardar"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          {/* Progression tips */}
          {routine.progression_tips?.length > 0 && (
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Consejos de progresión</Text>
              {routine.progression_tips.map((tip, i) => (
                <Text key={i} style={styles.tip}>
                  • {tip}
                </Text>
              ))}
            </View>
          )}

          {/* Nutrition */}
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
  sessionCardDone: {
    borderColor: palette.moss,
    borderWidth: 2,
  },
  sessionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  doneCheck: {
    color: "#2E7D32",
    fontWeight: "800",
    fontSize: 16,
    marginRight: 4,
  },
  sessionDayDone: {
    color: "#2E7D32",
  },
  completeBtnTextDone: {
    color: palette.cocoa,
  },
  exProgress: {
    marginTop: 8,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 8,
    padding: 8,
  },
  exProgressText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  exProgressSub: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  progressUp: {
    color: "#2E7D32",
    fontWeight: "700",
  },
  progressDown: {
    color: "#B23A48",
    fontWeight: "700",
  },
  logToggleBtn: {
    marginTop: 8,
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
  logForm: {
    marginTop: 8,
    gap: 8,
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
  logSaveBtn: {
    backgroundColor: palette.cocoa,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  logSaveBtnText: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "700",
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
  progressText: {
    marginTop: 10,
    color: palette.cocoa,
    fontSize: 13,
    fontWeight: "700",
  },
  syncText: {
    marginTop: 4,
    color: palette.cocoa,
    fontSize: 12,
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
  sessionCard: {
    backgroundColor: palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: "hidden",
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  sessionDay: {
    fontWeight: "700",
    fontSize: 15,
    color: palette.ink,
  },
  sessionFocus: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  sessionMeta: {
    alignItems: "flex-end",
    gap: 4,
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
