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
      <Text style={styles.title}>Rutina IA</Text>
      <Text style={styles.subtitle}>
        Genera un plan de entrenamiento adaptado a tu perfil actual.
      </Text>

      <TouchableOpacity
        style={[styles.genBtn, loading && styles.genBtnDisabled]}
        onPress={onGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
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
    backgroundColor: palette.snow,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.ink,
  },
  subtitle: {
    marginTop: 8,
    color: "#556977",
    marginBottom: 20,
    fontSize: 14,
  },
  genBtn: {
    backgroundColor: palette.ocean,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  genBtnDisabled: {
    backgroundColor: "#B0C4CF",
  },
  genBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  loadingHint: {
    marginTop: 12,
    textAlign: "center",
    color: "#8FA0AE",
    fontSize: 13,
  },
  routineContainer: {
    marginTop: 20,
    gap: 12,
  },
  routineHeader: {
    backgroundColor: palette.ocean,
    borderRadius: 16,
    padding: 16,
  },
  routineName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
  },
  metaBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  sessionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2ECF2",
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
    color: "#556977",
    fontSize: 13,
    marginTop: 2,
  },
  sessionMeta: {
    alignItems: "flex-end",
    gap: 4,
  },
  sessionDuration: {
    color: palette.ocean,
    fontWeight: "600",
    fontSize: 13,
  },
  sessionArrow: {
    color: "#8FA0AE",
    fontSize: 11,
  },
  exerciseList: {
    borderTopWidth: 1,
    borderTopColor: "#E2ECF2",
    padding: 12,
    gap: 10,
  },
  exerciseRow: {
    backgroundColor: "#F7FAFC",
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
    backgroundColor: "#E8F4FF",
    color: palette.ocean,
    fontSize: 12,
    fontWeight: "600",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  exNotes: {
    marginTop: 6,
    color: "#556977",
    fontSize: 12,
    fontStyle: "italic",
  },
  tipsCard: {
    backgroundColor: "#F0FFF4",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#C6F6D5",
  },
  tipsTitle: {
    fontWeight: "700",
    color: palette.ink,
    fontSize: 15,
    marginBottom: 8,
  },
  tip: {
    color: "#276749",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  nutritionCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FBD38D",
  },
  nutritionText: {
    color: "#744210",
    fontSize: 13,
    lineHeight: 20,
  },
});
