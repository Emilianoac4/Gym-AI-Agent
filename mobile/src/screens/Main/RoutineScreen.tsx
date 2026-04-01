import React, { useEffect, useMemo, useState } from "react";
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
  const [exerciseNameInput, setExerciseNameInput] = useState("");
  const [loadKgInput, setLoadKgInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [setsInput, setSetsInput] = useState("");
  const [savingStrengthLog, setSavingStrengthLog] = useState(false);
  const [syncingStrengthProgress, setSyncingStrengthProgress] = useState(false);
  const [strengthSummary, setStrengthSummary] = useState<StrengthProgressSummary | null>(
    null
  );
  const [strengthByExercise, setStrengthByExercise] = useState<
    ExerciseStrengthProgress[]
  >([]);

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
    return set;
  }, [checkins, currentWeekStart]);

  const loadCheckins = async () => {
    if (!user || !token) return;
    setSyncingCheckins(true);
    try {
      const data = await api.getRoutineCheckins(user.id, token, 56);
      setCheckins(data.checkins);
    } catch {
      // Keep the screen usable even when check-in sync fails.
    } finally {
      setSyncingCheckins(false);
    }
  };

  const loadStrengthProgress = async () => {
    if (!user || !token) return;

    setSyncingStrengthProgress(true);
    try {
      const data = await api.getStrengthProgress(user.id, token, 90);
      setStrengthSummary(data.summary);
      setStrengthByExercise(data.exercises);
    } catch {
      setStrengthSummary(null);
      setStrengthByExercise([]);
    } finally {
      setSyncingStrengthProgress(false);
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

    setSavingSessionDay(sessionDay);
    try {
      await api.createRoutineCheckin(user.id, token, { sessionDay });
      await loadCheckins();
      Alert.alert("Sesion registrada", `Marcaste ${sessionDay} como completada.`);
    } catch (error) {
      Alert.alert(
        "No se pudo registrar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setSavingSessionDay(null);
    }
  };

  const onSaveStrengthLog = async () => {
    if (!user || !token) return;

    const exerciseName = exerciseNameInput.trim();
    const loadKg = Number.parseFloat(loadKgInput);

    if (!exerciseName) {
      Alert.alert("Dato faltante", "Escribe el nombre del ejercicio.");
      return;
    }

    if (!Number.isFinite(loadKg) || loadKg <= 0) {
      Alert.alert("Dato invalido", "Ingresa una carga valida en kg.");
      return;
    }

    const reps = repsInput.trim() ? Number.parseInt(repsInput.trim(), 10) : undefined;
    const sets = setsInput.trim() ? Number.parseInt(setsInput.trim(), 10) : undefined;

    if (typeof reps === "number" && (!Number.isFinite(reps) || reps <= 0)) {
      Alert.alert("Dato invalido", "Las repeticiones deben ser mayores a 0.");
      return;
    }

    if (typeof sets === "number" && (!Number.isFinite(sets) || sets <= 0)) {
      Alert.alert("Dato invalido", "Las series deben ser mayores a 0.");
      return;
    }

    setSavingStrengthLog(true);
    try {
      await api.createStrengthLog(user.id, token, {
        exerciseName,
        loadKg,
        reps,
        sets,
      });
      setLoadKgInput("");
      setRepsInput("");
      setSetsInput("");
      await loadStrengthProgress();
      Alert.alert("Carga guardada", "Tu progreso de fuerza se actualizo.");
    } catch (error) {
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "Intenta de nuevo"
      );
    } finally {
      setSavingStrengthLog(false);
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

      <View style={styles.strengthCard}>
        <Text style={styles.strengthTitle}>Progreso de cargas</Text>
        <Text style={styles.strengthSubtitle}>
          Registra tu ultima serie pesada para medir mejora semanal y mensual.
        </Text>

        <View style={styles.inputGroup}>
          <TextInput
            placeholder="Ejercicio (ej: curl de biceps)"
            placeholderTextColor={palette.textSoft}
            style={styles.input}
            value={exerciseNameInput}
            onChangeText={setExerciseNameInput}
          />
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Kg"
              placeholderTextColor={palette.textSoft}
              style={[styles.input, styles.inputHalf]}
              keyboardType="decimal-pad"
              value={loadKgInput}
              onChangeText={setLoadKgInput}
            />
            <TextInput
              placeholder="Reps"
              placeholderTextColor={palette.textSoft}
              style={[styles.input, styles.inputHalf]}
              keyboardType="number-pad"
              value={repsInput}
              onChangeText={setRepsInput}
            />
            <TextInput
              placeholder="Series"
              placeholderTextColor={palette.textSoft}
              style={[styles.input, styles.inputHalf]}
              keyboardType="number-pad"
              value={setsInput}
              onChangeText={setSetsInput}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logBtn, savingStrengthLog && styles.genBtnDisabled]}
          onPress={onSaveStrengthLog}
          disabled={savingStrengthLog}
        >
          <Text style={styles.logBtnText}>
            {savingStrengthLog ? "Guardando carga..." : "Guardar carga"}
          </Text>
        </TouchableOpacity>

        {strengthSummary ? (
          <Text style={styles.strengthMeta}>
            {strengthSummary.totalLogs} registros totales, {strengthSummary.activeExercises} ejercicios
            activos, {strengthSummary.improvingExercises} en mejora.
          </Text>
        ) : null}
        {syncingStrengthProgress && (
          <Text style={styles.syncText}>Sincronizando progreso de cargas...</Text>
        )}

        {strengthByExercise.slice(0, 4).map((exercise) => (
          <View key={exercise.exerciseName} style={styles.strengthRow}>
            <View style={styles.strengthRowTop}>
              <Text style={styles.strengthExerciseName}>{exercise.exerciseName}</Text>
              <Text
                style={[
                  styles.strengthChange,
                  exercise.absoluteChangeKg >= 0
                    ? styles.strengthPositive
                    : styles.strengthNegative,
                ]}
              >
                {exercise.absoluteChangeKg >= 0 ? "+" : ""}
                {exercise.absoluteChangeKg.toFixed(1)} kg
              </Text>
            </View>
            <Text style={styles.strengthStats}>
              Ultimo {exercise.latestLoadKg.toFixed(1)} kg | Mejor {exercise.bestLoadKg.toFixed(1)} kg
              {exercise.estimatedOneRM ? ` | 1RM est. ${exercise.estimatedOneRM.toFixed(1)} kg` : ""}
            </Text>
          </View>
        ))}
      </View>

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
              Progreso semanal: {Math.min(completedThisWeek.size, routine.weekly_sessions)}/
              {routine.weekly_sessions} sesiones completadas
            </Text>
            {syncingCheckins && (
              <Text style={styles.syncText}>Sincronizando check-ins...</Text>
            )}
          </View>

          {/* Sessions */}
          {routine.sessions?.map((session, i) => (
            <View key={i} style={styles.sessionCard}>
              <TouchableOpacity
                style={styles.sessionHeader}
                onPress={() =>
                  setOpenSession(openSession === session.day ? null : session.day)
                }
              >
                <View>
                  <Text style={styles.sessionDay}>{session.day}</Text>
                  <Text style={styles.sessionFocus}>{session.focus}</Text>
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
                  <TouchableOpacity
                    style={[
                      styles.completeBtn,
                      completedThisWeek.has(normalized(session.day)) && styles.completeBtnDone,
                    ]}
                    disabled={
                      completedThisWeek.has(normalized(session.day)) ||
                      savingSessionDay === session.day
                    }
                    onPress={() => onMarkCompleted(session.day)}
                  >
                    <Text style={styles.completeBtnText}>
                      {completedThisWeek.has(normalized(session.day))
                        ? "Sesion completada esta semana"
                        : savingSessionDay === session.day
                        ? "Guardando..."
                        : "Marcar como completada"}
                    </Text>
                  </TouchableOpacity>

                  {session.exercises?.map((ex, j) => (
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
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Progression tips */}
          {routine.progression_tips?.length > 0 && (
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Consejos de progresion</Text>
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
  strengthCard: {
    marginTop: 16,
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    gap: 10,
  },
  strengthTitle: {
    color: palette.ink,
    fontWeight: "800",
    fontSize: 17,
  },
  strengthSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
  },
  inputGroup: {
    gap: 8,
  },
  inputRow: {
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
  inputHalf: {
    flex: 1,
  },
  logBtn: {
    backgroundColor: palette.cocoa,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  logBtnText: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: "700",
  },
  strengthMeta: {
    color: palette.textSoft,
    fontSize: 12,
  },
  strengthRow: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 10,
    gap: 4,
  },
  strengthRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  strengthExerciseName: {
    color: palette.ink,
    fontWeight: "700",
    fontSize: 13,
    flex: 1,
  },
  strengthChange: {
    fontWeight: "700",
    fontSize: 12,
  },
  strengthPositive: {
    color: "#2E7D32",
  },
  strengthNegative: {
    color: "#B23A48",
  },
  strengthStats: {
    color: palette.textMuted,
    fontSize: 12,
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
