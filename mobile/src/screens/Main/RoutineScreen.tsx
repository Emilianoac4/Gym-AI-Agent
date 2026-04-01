import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";

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
  const [openSession, setOpenSession] = useState<string | null>(null);

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
