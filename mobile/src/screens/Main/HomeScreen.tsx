import React, { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { AppButton } from "../../components/AppButton";
import { MemberHomeContent } from "../../components/MemberHomeContent";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";
import {
  EmergencyTicket,
  GymAvailabilityDay,
  GeneratedRoutine,
  MessageThread,
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
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sábado",
    sunday: "Domingo",
  };

  return dayMap[normalize(value)] || value;
}

const adminHighlights = [
  "Picos de actividad del gimnasio",
  "Usuarios en riesgo de abandono",
  "Máquinas con mayor demanda",
  "Satisfacción del servicio de coach",
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

function getTodayRoutineSession(routine: GeneratedRoutine | null): GeneratedRoutine["sessions"][number] | null {
  if (!routine) {
    return null;
  }

  const todayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date().getDay()];
  return routine.sessions.find((session) => normalize(session.day) === todayKey) ?? null;
}

function getMemberInsight(
  summary: ProgressSummary | null,
  strengthSummary: StrengthProgressSummary | null
): string {
  if (strengthSummary && strengthSummary.improvingExercises > 0) {
    return `Mejoraste tu rendimiento en ${strengthSummary.improvingExercises} ejercicio(s). Aprovecha ese impulso en tu siguiente sesion.`;
  }

  if (summary && !summary.hasMeasurementThisWeek) {
    return "Registra tus medidas esta semana para que Tuco ajuste mejor tus recomendaciones.";
  }

  if (summary && summary.weeklyCheckInStreak > 0) {
    return `Llevas ${summary.weeklyCheckInStreak} semana(s) manteniendo constancia. Sigue con tu proxima sesion para no romper la racha.`;
  }

  return "Empieza tu entrenamiento de hoy para generar nuevas recomendaciones y mantener tu progreso activo.";
}

export function HomeScreen() {
  const { user, token, logout } = useAuth();
  const navigation = useNavigation<any>();
  const isAdmin = user?.role === "admin";
  const isTrainer = user?.role === "trainer";
  const isMember = user?.role === "member";
  const canManageAvailability = user?.role === "admin" || user?.role === "trainer";
  const currentWeekStart = useMemo(() => getWeekStart(new Date()), []);

  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [strengthSummary, setStrengthSummary] = useState<StrengthProgressSummary | null>(null);
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);
  const [checkins, setCheckins] = useState<RoutineCheckin[]>([]);
  const [todayAvailability, setTodayAvailability] = useState<GymAvailabilityDay | null>(null);
  const [unreadThreads, setUnreadThreads] = useState<MessageThread[]>([]);
  const [activeTrainers, setActiveTrainers] = useState<string[]>([]);
  const [emergencyTickets, setEmergencyTickets] = useState<EmergencyTicket[]>([]);
  const [pendingAssistanceCount, setPendingAssistanceCount] = useState(0);
  const [unassignedAssistanceCount, setUnassignedAssistanceCount] = useState(0);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<"harassment" | "injury" | "accident" | "incident">("incident");
  const [ticketDescription, setTicketDescription] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!user || !token) {
        return;
      }

      let cancelled = false;

      const load = async () => {
        const availabilityPromise = api.getAvailabilityToday(token).catch(() => null);
        const threadsPromise = api.getMyThreads(token).catch(() => ({ threads: [] as MessageThread[] }));
        const ticketsPromise = api.listEmergencyTickets(token).catch(() => ({ tickets: [] as EmergencyTicket[] }));

        if (isAdmin) {
          const [availabilityData, threadsData, presenceData, ticketsData, pendingRequestsData] = await Promise.all([
            availabilityPromise,
            threadsPromise,
            api.getTrainerPresenceSummary(token, 1).catch(() => ({ days: [] as any[] })),
            ticketsPromise,
            api.listAssistanceRequests(token).catch(() => ({ requests: [] as any[], total: 0 })),
          ]);

          const todayPresence = presenceData.days[0];
          const activeTrainerNames = todayPresence
            ? todayPresence.trainers
                .filter((trainer: any) => trainer.sessions.some((session: any) => session.isActive))
                .map((trainer: any) => trainer.trainerName)
            : [];

          if (!cancelled) {
            setSummary(null);
            setStrengthSummary(null);
            setRoutine(null);
            setCheckins([]);
            setTodayAvailability(availabilityData?.availability ?? null);
            setUnreadThreads(threadsData.threads.filter((thread) => thread.unreadCount > 0));
            setActiveTrainers(activeTrainerNames);
            setEmergencyTickets(ticketsData.tickets);
            setUnassignedAssistanceCount(
              (pendingRequestsData.requests as any[]).filter((r) => r.status === "CREATED").length,
            );
          }
          return;
        }

        try {
        const [availabilityData, progress, strength, latestRoutine, checkinData, threadsData, ticketsData, assistanceData, presenceData] = await Promise.all([
            availabilityPromise,
            api.getProgressSummary(user.id, token).catch(() => ({ summary: null as any })),
            api.getStrengthProgress(user.id, token, 120).catch(() => ({ summary: null as any })),
            api.getLatestRoutine(user.id, token).catch(() => null),
            api.getRoutineCheckins(user.id, token, 28).catch(() => ({ checkins: [] as RoutineCheckin[] })),
            threadsPromise,
            ticketsPromise,
            isTrainer
              ? api.listAssistanceRequests(token).catch(() => ({ requests: [], total: 0 }))
              : Promise.resolve({ requests: [], total: 0 }),
            isMember
              ? api.getActiveTrainers(token).catch(() => ({ trainers: [] as { id: string; fullName: string; avatarUrl: string | null }[] }))
              : Promise.resolve({ trainers: [] as { id: string; fullName: string; avatarUrl: string | null }[] }),
          ]);

          if (cancelled) {
            return;
          }

          setTodayAvailability(availabilityData?.availability ?? null);
          setSummary(progress.summary ?? null);
          setStrengthSummary(strength.summary ?? null);
          setRoutine(latestRoutine?.routine ?? null);
          setCheckins(checkinData.checkins);
          setUnreadThreads(threadsData.threads.filter((thread) => thread.unreadCount > 0));
          setEmergencyTickets(ticketsData.tickets);
          setPendingAssistanceCount(
            isTrainer
              ? (assistanceData as { requests: { status: string }[]; total: number }).requests.filter((r) => r.status === "CREATED").length
              : 0,
          );
          // Active trainers for members
          const activeTrainersList = (presenceData as { trainers: { id: string; fullName: string; avatarUrl: string | null }[] }).trainers;
          setActiveTrainers(
            isMember ? activeTrainersList.map((t) => t.fullName) : [],
          );
        } catch {
          if (!cancelled) {
            setTodayAvailability(null);
            setSummary(null);
            setStrengthSummary(null);
            setRoutine(null);
            setCheckins([]);
            setUnreadThreads([]);
            setActiveTrainers([]);
            setEmergencyTickets([]);
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

  const todayRoutineSession = useMemo(() => getTodayRoutineSession(routine), [routine]);

  const memberHeroTitle = todayRoutineSession?.focus ?? nextSession;

  const memberHeroMeta = useMemo(() => {
    if (todayRoutineSession) {
      return `${formatDayLabel(todayRoutineSession.day)} · ${todayRoutineSession.duration_minutes} min · ${todayRoutineSession.exercises.length} ejercicios`;
    }

    if (routine) {
      return `${routine.weekly_sessions} sesiones planificadas esta semana`;
    }

    return "Abre tu rutina y prepara tu primera sesion personalizada.";
  }, [routine, todayRoutineSession]);

  const memberProgressLabel = routine
    ? `${completedCount}/${routine.weekly_sessions} sesiones completadas esta semana`
    : "Aun no tienes una rutina activa";

  const memberProgressValue = routine ? completedCount / Math.max(routine.weekly_sessions, 1) : 0;

  const memberInsight = useMemo(() => getMemberInsight(summary, strengthSummary), [strengthSummary, summary]);

  const urgentOpenTickets = emergencyTickets.filter((ticket) => !ticket.resolvedAt);

  const submitEmergencyTicket = async () => {
    if (!token || !ticketDescription.trim()) {
      Alert.alert("Descripcion requerida", "Describe brevemente la situacion para enviar la alerta.");
      return;
    }

    try {
      await api.createEmergencyTicket(token, {
        category: ticketCategory,
        description: ticketDescription.trim(),
      });
      setTicketDescription("");
      setTicketCategory("incident");
      setTicketModalVisible(false);
      Alert.alert("Alerta enviada", "El equipo administrativo ya fue notificado.");
      const refreshed = await api.listEmergencyTickets(token);
      setEmergencyTickets(refreshed.tickets);
    } catch {
      Alert.alert("No se pudo enviar", "Intenta de nuevo en unos segundos.");
    }
  };

  if (isMember) {
    return (
      <MemberHomeContent
        userName={user?.fullName ?? "Atleta"}
        heroTitle={memberHeroTitle}
        heroMeta={memberHeroMeta}
        progressLabel={memberProgressLabel}
        progressValue={memberProgressValue}
        insight={memberInsight}
        onStartWorkout={() => navigation.navigate("Rutina")}
        secondaryActions={[
          {
            key: "routine",
            label: "Ver rutina completa",
            description: "Revisa ejercicios, series y progreso antes de entrenar.",
            onPress: () => navigation.navigate("Rutina"),
          },
          {
            key: "measurements",
            label: "Registrar medidas",
            description: "Actualiza tus metricas para seguir tu avance real.",
            onPress: () => navigation.navigate("Medidas"),
          },
          {
            key: "coach",
            label: "Hablar con Tuco",
            description: "Pide una recomendacion rapida sobre entrenamiento o recuperacion.",
            onPress: () => navigation.navigate("Coach"),
          },
        ]}
      />
    );
  }

  return (
    <LinearGradient colors={[palette.cream, palette.gold, palette.coral]} style={styles.shell}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.welcome}>Hola, {user?.fullName ?? "Atleta"}</Text>
          <Text style={styles.hero}>{isAdmin ? "Panel de gestion" : isTrainer ? "Panel del entrenador" : "Tu semana en GymAI"}</Text>
          <Text style={styles.heroSubtitle}>
            {isAdmin
              ? "Revisa el estado operativo del gimnasio y las prioridades del negocio."
              : isTrainer
                ? "Gestiona mensajes y atiende incidentes reportados por los miembros."
                : "Consulta tu progreso semanal, la siguiente sesion y el avance real de tus cargas."}
          </Text>
        </View>

        {(unreadThreads.length > 0 || urgentOpenTickets.length > 0 || (isAdmin && unassignedAssistanceCount > 0)) ? (
          <View style={styles.priorityCard}>
            <Text style={styles.priorityEyebrow}>Prioridad</Text>
            {unreadThreads.length > 0 ? (
              <Text style={styles.priorityTitle}>Tienes {unreadThreads.length} conversación(es) sin leer</Text>
            ) : null}
            {urgentOpenTickets.length > 0 ? (
              <Text style={styles.priorityTitle}>Hay {urgentOpenTickets.length} ticket(s) de emergencia abiertos</Text>
            ) : null}
            {isAdmin && unassignedAssistanceCount > 0 ? (
              <Text style={styles.priorityTitle}>
                {unassignedAssistanceCount} solicitud{unassignedAssistanceCount > 1 ? "es" : ""} de asistencia sin respuesta
              </Text>
            ) : null}
            <Text style={styles.priorityCopy}>
              Atiende primero los mensajes y emergencias para mantener la operacion segura.
            </Text>
            <View style={styles.inlineActionsRow}>
              {unreadThreads.length > 0 ? (
                <Pressable
                  style={styles.priorityButton}
                  onPress={() => navigation.navigate(user?.role === "member" ? "MyMessages" : "Mensajes")}
                >
                  <Text style={styles.priorityButtonText}>Ir a mensajes</Text>
                </Pressable>
              ) : null}
              {(isAdmin || isTrainer) && urgentOpenTickets.length > 0 ? (
                <Pressable style={styles.priorityButton} onPress={() => navigation.navigate("Mensajes") }>
                  <Text style={styles.priorityButtonText}>Abrir bandeja admin</Text>
                </Pressable>
              ) : null}
              {isAdmin && unassignedAssistanceCount > 0 ? (
                <Pressable style={styles.priorityButton} onPress={() => navigation.navigate("Perfil")}>
                  <Text style={styles.priorityButtonText}>Ver solicitudes</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Accesos rapidos</Text>
          <View style={styles.quickGrid}>
            <Pressable style={styles.quickButton} onPress={() => navigation.navigate("GymAvailability")}>
              <Text style={styles.quickButtonText}>Disponibilidad</Text>
            </Pressable>
            {canManageAvailability ? (
              <Pressable style={styles.quickButton} onPress={() => navigation.navigate("AvailabilityManagement")}>
                <Text style={styles.quickButtonText}>Operacion</Text>
              </Pressable>
            ) : null}
            {user?.role === "admin" ? (
              <Pressable style={styles.quickButton} onPress={() => navigation.navigate("Mensajes")}>
                <Text style={styles.quickButtonText}>Mensajes</Text>
              </Pressable>
            ) : null}
            {user?.role === "trainer" ? (
              <Pressable style={styles.quickButton} onPress={() => navigation.navigate("Mensajes")}>
                <Text style={styles.quickButtonText}>Mensajes</Text>
              </Pressable>
            ) : null}
            {user?.role === "member" ? (
              <Pressable style={styles.quickButton} onPress={() => navigation.navigate("MyMessages")}>
                <Text style={styles.quickButtonText}>Mis mensajes</Text>
              </Pressable>
            ) : null}
            {user?.role !== "admin" ? (
              <Pressable style={styles.quickButton} onPress={() => navigation.navigate("Perfil")}>
                <Text style={styles.quickButtonText}>Mi perfil</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Disponibilidad del gimnasio</Text>
          <Text style={styles.sectionTitle}>Hoy</Text>
          <Text style={styles.featureDetail}>{formatAvailabilityWindow(todayAvailability)}</Text>
          {todayAvailability?.note ? <Text style={styles.availabilityNote}>{todayAvailability.note}</Text> : null}
          <View style={styles.inlineActionsRow}>
            <Pressable style={styles.inlineActionPrimary} onPress={() => navigation.navigate("GymAvailability")}>
              <Text style={styles.inlineActionPrimaryText}>Ver próximos 7 días</Text>
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
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Entrenadores activos</Text>
              <Text style={styles.sectionTitle}>En este momento</Text>
              {activeTrainers.length === 0 ? (
                <Text style={styles.featureDetail}>No hay entrenadores activos ahora.</Text>
              ) : (
                activeTrainers.map((name) => (
                  <View key={name} style={styles.featureItem}>
                    <View style={styles.featureDot} />
                    <Text style={styles.featureTitle}>{name}</Text>
                  </View>
                ))
              )}
              <View style={styles.inlineActionsRow}>
                <Pressable style={styles.inlineActionPrimary} onPress={() => navigation.navigate("Perfil")}>
                  <Text style={styles.inlineActionPrimaryText}>Ver reporte operativo</Text>
                </Pressable>
              </View>
            </View>

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
          </>
        ) : (
          <>
            {isTrainer ? (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionEyebrow}>Solicitudes de asistencia</Text>
                  <Text style={styles.sectionTitle}>
                    {pendingAssistanceCount === 0
                      ? "Sin solicitudes pendientes"
                      : `${pendingAssistanceCount} solicitud${pendingAssistanceCount > 1 ? "es" : ""} pendiente${pendingAssistanceCount > 1 ? "s" : ""}`}
                  </Text>
                  <Text style={styles.featureDetail}>
                    {pendingAssistanceCount === 0
                      ? "No hay miembros esperando atención en este momento."
                      : "Miembros en el piso esperan tu asistencia."}
                  </Text>
                  <View style={styles.inlineActionsRow}>
                    <Pressable
                      style={styles.inlineActionPrimary}
                      onPress={() => navigation.navigate("Solicitudes")}
                    >
                      <Text style={styles.inlineActionPrimaryText}>Ver solicitudes</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionEyebrow}>Usuarios que necesitan ayuda</Text>
                  <Text style={styles.sectionTitle}>Tickets abiertos</Text>
                  {urgentOpenTickets.length === 0 ? (
                    <Text style={styles.featureDetail}>No hay tickets abiertos por ahora.</Text>
                  ) : (
                    urgentOpenTickets.slice(0, 5).map((ticket) => (
                      <View key={ticket.id} style={styles.featureItem}>
                        <View style={styles.featureDot} />
                        <View style={styles.featureCopy}>
                          <Text style={styles.featureTitle}>{ticket.category.toUpperCase()}</Text>
                          <Text style={styles.featureDetail}>{ticket.description}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            ) : null}

            {isMember ? null : null}
          </>
        )}

        <View style={styles.actions}>
          <AppButton label="Cerrar sesión" onPress={logout} />
        </View>
      </ScrollView>

      <Modal visible={ticketModalVisible} transparent animationType="slide" onRequestClose={() => setTicketModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Reportar emergencia</Text>
            <Text style={styles.featureDetail}>Categoria</Text>
            <View style={styles.quickGrid}>
              {(["harassment", "injury", "accident", "incident"] as const).map((category) => (
                <Pressable
                  key={category}
                  style={[
                    styles.quickButton,
                    ticketCategory === category ? styles.quickButtonActive : null,
                  ]}
                  onPress={() => setTicketCategory(category)}
                >
                  <Text style={styles.quickButtonText}>{category}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={ticketDescription}
              onChangeText={setTicketDescription}
              placeholder="Describe que sucede y donde"
              style={styles.ticketInput}
              multiline
            />
            <View style={styles.inlineActionsRow}>
              <Pressable style={styles.inlineActionSecondary} onPress={() => setTicketModalVisible(false)}>
                <Text style={styles.inlineActionSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.inlineActionPrimary} onPress={submitEmergencyTicket}>
                <Text style={styles.inlineActionPrimaryText}>Enviar alerta</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  priorityCard: {
    marginTop: 18,
    backgroundColor: "#FFF1EA",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F7C4AA",
  },
  priorityEyebrow: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  priorityTitle: {
    color: palette.cocoa,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6,
  },
  priorityCopy: {
    color: palette.textMuted,
    marginTop: 6,
    lineHeight: 19,
  },
  priorityButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: palette.cocoa,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  priorityButtonText: {
    color: palette.card,
    fontWeight: "700",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickButton: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  quickButtonActive: {
    backgroundColor: palette.gold,
    borderColor: palette.cocoa,
  },
  quickButtonText: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 13,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: palette.line,
  },
  ticketInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceMuted,
    borderRadius: 12,
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    color: palette.cocoa,
  },
});