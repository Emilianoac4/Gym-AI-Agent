import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";
import {
  GymAvailabilityDay,
  GeneratedRoutine,
  ProgressSummary,
  RoutineCheckin,
  StrengthProgressSummary,
} from "../../types/api";

function getWeekStart(date: Date): string {
  const value = new Date(date);
  const day = value.getDay();
  const diff = (day + 6) % 7;
  value.setDate(value.getDate() - diff);
  value.setHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function formatDayLabel(value: string): string {
  const dayMap: Record<string, string> = {
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miercoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sabado",
    sunday: "Domingo",
  };

  return dayMap[normalize(value)] || value;
}

const adminHighlights = [
  "Picos de actividad del gimnasio",
  "Usuarios en riesgo de abandono",
  "Maquinas con mayor demanda",
  "Satisfaccion del servicio de coach",
];

function formatAvailabilityWindow(day: GymAvailabilityDay | null): string {
  if (!day) {
    return "Sin horario publicado para hoy";
  }

  if (day.status === "closed") {
    return day.source === "default_closed" ? "Sin horario publicado para hoy" : "Gimnasio cerrado hoy";
  }

  if (day.opensAt && day.closesAt) {
    if (day.opensAtSecondary && day.closesAtSecondary) {
      return `${day.opensAt} - ${day.closesAt} | ${day.opensAtSecondary} - ${day.closesAtSecondary}`;
    }

    return `${day.opensAt} - ${day.closesAt}`;
  }

  return "Horario publicado para hoy";
}

export function HomeScreen() {
  const { user, token, logout } = useAuth();
  const navigation = useNavigation<any>();
  const isAdmin = user?.role === "admin";
  const canManageAvailability = user?.role === "admin" || user?.role === "trainer";
  const currentWeekStart = useMemo(() => getWeekStart(new Date()), []);

  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [strengthSummary, setStrengthSummary] = useState<StrengthProgressSummary | null>(null);
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);
  const [checkins, setCheckins] = useState<RoutineCheckin[]>([]);
  const [todayAvailability, setTodayAvailability] = useState<GymAvailabilityDay | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user || !token) {
        return;
      }

      let cancelled = false;

      const load = async () => {
        const availabilityPromise = api.getAvailabilityToday(token).catch(() => null);

        if (isAdmin) {
          const availabilityData = await availabilityPromise;

          if (!cancelled) {
            setSummary(null);
            setStrengthSummary(null);
            setRoutine(null);
            setCheckins([]);
            setTodayAvailability(availabilityData?.availability ?? null);
          }
          return;
        }

        try {
          const [availabilityData, progress, strength, latestRoutine, checkinData] = await Promise.all([
            availabilityPromise,
            api.getProgressSummary(user.id, token),
            api.getStrengthProgress(user.id, token, 120),
            api.getLatestRoutine(user.id, token).catch(() => null),
            api.getRoutineCheckins(user.id, token, 28),
          ]);

          if (cancelled) {
            return;
          }

          setTodayAvailability(availabilityData?.availability ?? null);
          setSummary(progress.summary);
          setStrengthSummary(strength.summary);
          setRoutine(latestRoutine?.routine ?? null);
          setCheckins(checkinData.checkins);
        } catch {
          if (!cancelled) {
            setTodayAvailability(null);
            setSummary(null);
            setStrengthSummary(null);
            setRoutine(null);
            setCheckins([]);
          }
        }
      };

      void load();

      return () => {
        cancelled = true;
      };
    }, [isAdmin, token, user, currentWeekStart])
  );

  const completedThisWeek = useMemo(() => {
    const value = new Set<string>();
    checkins.forEach((item) => {
      if (item.weekStart === currentWeekStart) {
        value.add(normalize(item.sessionDay));
      }
    });
    return value;
  }, [checkins, currentWeekStart]);

  const completedCount = routine
    ? Math.min(completedThisWeek.size, routine.weekly_sessions)
    : 0;

  const nextSession = useMemo(() => {
    if (!routine) {
      return "Genera tu primera rutina personalizada";
    }

    const pending = routine.sessions.find(
      (session) => !completedThisWeek.has(normalize(session.day))
    );

    return pending ? `${formatDayLabel(pending.day)} · ${pending.focus}` : "Semana completada";
  }, [completedThisWeek, routine]);

  return (
    <LinearGradient colors={[palette.cream, palette.gold, palette.coral]} style={styles.shell}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.welcome}>Hola, {user?.fullName ?? "Atleta"}</Text>
          <Text style={styles.hero}>{isAdmin ? "Panel de gestion" : "Tu semana en GymAI"}</Text>
          <Text style={styles.heroSubtitle}>
            {isAdmin
              ? "Revisa el estado operativo del gimnasio y las prioridades del negocio."
              : "Consulta tu progreso semanal, la siguiente sesion y el avance real de tus cargas."}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Disponibilidad del gimnasio</Text>
          <Text style={styles.sectionTitle}>Hoy</Text>
          <Text style={styles.featureDetail}>{formatAvailabilityWindow(todayAvailability)}</Text>
          {todayAvailability?.note ? <Text style={styles.availabilityNote}>{todayAvailability.note}</Text> : null}
          <View style={styles.inlineActionsRow}>
            <Pressable style={styles.inlineActionPrimary} onPress={() => navigation.navigate("GymAvailability")}>
              <Text style={styles.inlineActionPrimaryText}>Ver proximos 7 dias</Text>
            </Pressable>
            {canManageAvailability ? (
              <Pressable
                style={styles.inlineActionSecondary}
                onPress={() => navigation.navigate("AvailabilityManagement")}
              >
                <Text style={styles.inlineActionSecondaryText}>Gestionar horarios</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {isAdmin ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Vision del administrador</Text>
            <Text style={styles.sectionTitle}>Indicadores a validar</Text>
            {adminHighlights.map((item) => (
              <View key={item} style={styles.featureItem}>
                <View style={styles.featureDot} />
                <Text style={styles.featureTitle}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.kpiRow}>
              <View style={styles.kpiCardPrimary}>
                <Text style={styles.kpiLabelDark}>Sesiones completadas</Text>
                <Text style={styles.kpiValueDark}>
                  {routine ? `${completedCount}/${routine.weekly_sessions}` : "Sin rutina"}
                </Text>
                <Text style={styles.kpiHintDark}>Semana actual</Text>
              </View>
              <View style={styles.kpiCardSecondary}>
                <Text style={styles.kpiLabelLight}>Ejercicios en mejora</Text>
                <Text style={styles.kpiValueLight}>{strengthSummary?.improvingExercises ?? 0}</Text>
                <Text style={styles.kpiHintLight}>Ultimos 120 dias</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Siguiente paso</Text>
              <Text style={styles.sectionTitle}>{nextSession}</Text>
              <Text style={styles.featureDetail}>{summary?.nextAction ?? "Completa tu perfil, genera una rutina y registra tu primera sesion."}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Resumen del miembro</Text>
              <Text style={styles.sectionTitle}>Estado actual</Text>
              <View style={styles.featureItem}>
                <View style={styles.featureDot} />
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>Racha semanal</Text>
                  <Text style={styles.featureDetail}>{summary ? `${summary.weeklyCheckInStreak} semana(s) con check-in` : "Aun no hay check-ins registrados"}</Text>
                </View>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureDot} />
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>Mediciones</Text>
                  <Text style={styles.featureDetail}>{summary ? `${summary.measurementsCount} registros guardados` : "Sin mediciones registradas"}</Text>
                </View>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureDot} />
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>Carga de trabajo</Text>
                  <Text style={styles.featureDetail}>{strengthSummary ? `${strengthSummary.activeExercises} ejercicios con historial de carga` : "Aun no hay progreso de cargas registrado"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.miniCardWarm}>
                <Text style={styles.miniLabel}>Rutina</Text>
                <Text style={styles.miniValue}>{routine ? `${routine.sessions.length} dias planificados` : "Pendiente de generar"}</Text>
              </View>
              <View style={styles.miniCardDark}>
                <Text style={styles.miniLabelDark}>Coach IA</Text>
                <Text style={styles.miniValueDark}>Memoria conversacional y contexto del perfil activos</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.actions}>
          <AppButton label="Cerrar sesion" onPress={logout} />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.cocoa,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  welcome: {
    color: palette.coral,
    fontWeight: "700",
    fontSize: 14,
  },
  hero: {
    color: palette.cocoa,
    fontSize: 30,
    lineHeight: 36,
    marginTop: 8,
    fontWeight: "800",
  },
  heroSubtitle: {
    marginTop: 12,
    color: "#6B5B4B",
    lineHeight: 21,
    fontSize: 14,
  },
  kpiRow: {
    flexDirection: "column",
    marginTop: 24,
    gap: 12,
  },
  kpiCardPrimary: {
    backgroundColor: palette.moss,
    borderRadius: 24,
    padding: 18,
  },
  kpiCardSecondary: {
    backgroundColor: palette.cocoa,
    borderRadius: 24,
    padding: 18,
  },
  kpiLabelDark: {
    color: "#5A4C40",
    fontSize: 12,
    fontWeight: "700",
  },
  kpiValueDark: {
    color: palette.cocoa,
    marginTop: 6,
    fontWeight: "800",
    fontSize: 22,
  },
  kpiHintDark: {
    color: "#5A4C40",
    marginTop: 4,
    fontSize: 12,
  },
  kpiLabelLight: {
    color: "#EEDDB6",
    fontSize: 12,
    fontWeight: "700",
  },
  kpiValueLight: {
    color: palette.cream,
    marginTop: 6,
    fontWeight: "800",
    fontSize: 22,
  },
  kpiHintLight: {
    color: "#EEDDB6",
    marginTop: 4,
    fontSize: 12,
  },
  sectionCard: {
    marginTop: 18,
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
  },
  sectionEyebrow: {
    color: palette.coral,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionTitle: {
    color: palette.cocoa,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 10,
  },
  featureItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.sand,
  },
  featureDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: palette.gold,
    marginTop: 4,
  },
  featureCopy: {
    flex: 1,
  },
  featureTitle: {
    color: palette.cocoa,
    fontWeight: "800",
    fontSize: 15,
  },
  featureDetail: {
    color: "#6B5B4B",
    marginTop: 4,
    lineHeight: 20,
  },
  availabilityNote: {
    marginTop: 8,
    color: palette.textMuted,
    lineHeight: 20,
  },
  inlineActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  inlineActionPrimary: {
    backgroundColor: palette.cocoa,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineActionPrimaryText: {
    color: palette.gold,
    fontWeight: "800",
  },
  inlineActionSecondary: {
    backgroundColor: palette.sand,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  inlineActionSecondaryText: {
    color: palette.cocoa,
    fontWeight: "800",
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  miniCardWarm: {
    flex: 1,
    backgroundColor: palette.gold,
    borderRadius: 20,
    padding: 16,
  },
  miniCardDark: {
    flex: 1,
    backgroundColor: palette.cocoa,
    borderRadius: 20,
    padding: 16,
  },
  miniLabel: {
    color: "#72552E",
    fontWeight: "700",
    fontSize: 12,
  },
  miniValue: {
    color: palette.cocoa,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  miniLabelDark: {
    color: "#EEDDB6",
    fontWeight: "700",
    fontSize: 12,
  },
  miniValueDark: {
    color: palette.cream,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  actions: {
    marginTop: 24,
    marginBottom: 12,
  },
});