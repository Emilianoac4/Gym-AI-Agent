import React, { useCallback, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { AppButton } from "../../components/AppButton";
import { MemberHomeContent } from "../../components/MemberHomeContent";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";
import { getCostaRicaWeekStart, getCostaRicaWeekdayKey } from "../../utils/costaRicaTime";
import {
  AdminDashboardSummary,
  EmergencyTicket,
  GymAvailabilityDay,
  GeneralNotification,
  GeneratedRoutine,
  MessageThread,
  ProgressSummary,
  RoutineCheckin,
  StrengthProgressSummary,
} from "../../types/api";

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

  const todayKey = getCostaRicaWeekdayKey();
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
  const currentWeekStart = useMemo(() => getCostaRicaWeekStart(), []);

  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [strengthSummary, setStrengthSummary] = useState<StrengthProgressSummary | null>(null);
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);
  const [checkins, setCheckins] = useState<RoutineCheckin[]>([]);
  const [todayAvailability, setTodayAvailability] = useState<GymAvailabilityDay | null>(null);
  const [next30Days, setNext30Days] = useState<GymAvailabilityDay[]>([]);
  const [gymNotifications, setGymNotifications] = useState<GeneralNotification[]>([]);
  const [unreadThreads, setUnreadThreads] = useState<MessageThread[]>([]);
  const [activeTrainers, setActiveTrainers] = useState<string[]>([]);
  const [activeTrainerObjects, setActiveTrainerObjects] = useState<{ id: string; fullName: string; avatarUrl: string | null }[]>([]);
  const [emergencyTickets, setEmergencyTickets] = useState<EmergencyTicket[]>([]);
  const [pendingAssistanceCount, setPendingAssistanceCount] = useState(0);
  const [unassignedAssistanceCount, setUnassignedAssistanceCount] = useState(0);
  const [dashboardSummary, setDashboardSummary] = useState<AdminDashboardSummary | null>(null);
  const [dashboardLastUpdated, setDashboardLastUpdated] = useState<Date | null>(null);
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
          // ── Primary: unified dashboard summary ──────────────────────────
          const [summaryResult, availabilityData, ticketsData, activeTrainersData] = await Promise.all([
            api.getAdminDashboardSummary(token).catch(() => null),
            availabilityPromise,
            ticketsPromise,
            api.getActiveTrainers(token).catch(() => ({ trainers: [] as { id: string; fullName: string; avatarUrl: string | null }[] })),
          ]);

          if (summaryResult) {
            const now = new Date();
            if (!cancelled) {
              setDashboardSummary(summaryResult.summary);
              setDashboardLastUpdated(now);
              setTodayAvailability(availabilityData?.availability ?? null);
              setUnreadThreads([]);
              setActiveTrainers([]);
              setActiveTrainerObjects(activeTrainersData.trainers);
              setEmergencyTickets(ticketsData.tickets);
              setUnassignedAssistanceCount(
                summaryResult.summary.cards.assistancePending.status === "ok"
                  ? summaryResult.summary.cards.assistancePending.byStatus.CREATED
                  : 0,
              );
            }
            return;
          }

          // ── Fallback: original parallel calls ───────────────────────────
          const [presenceData, pendingRequestsData] = await Promise.all([
            api.getTrainerPresenceSummary(token, 1).catch(() => ({ days: [] as any[] })),
            api.listAssistanceRequests(token).catch(() => ({ requests: [] as any[], total: 0 })),
          ]);

          const todayPresence = presenceData.days[0];
          const activeTrainerNames = todayPresence
            ? todayPresence.trainers
                .filter((trainer: any) => trainer.sessions.some((session: any) => session.isActive))
                .map((trainer: any) => trainer.trainerName)
            : [];

          if (!cancelled) {
            setDashboardSummary(null);
            setDashboardLastUpdated(null);
            setSummary(null);
            setStrengthSummary(null);
            setRoutine(null);
            setCheckins([]);
            setTodayAvailability(availabilityData?.availability ?? null);
            setUnreadThreads(ticketsData.tickets.length > 0 ? [] : []);
            setActiveTrainers(activeTrainerNames);
            setActiveTrainerObjects(activeTrainersData.trainers);
            setEmergencyTickets(ticketsData.tickets);
            setUnassignedAssistanceCount(
              (pendingRequestsData.requests as any[]).filter((r) => r.status === "CREATED").length,
            );
          }
          return;
        }

        try {
        const [availabilityData, progress, strength, latestRoutine, checkinData, threadsData, ticketsData, assistanceData, presenceData, next30DaysData, notificationsData] = await Promise.all([
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
            isMember
              ? api.getAvailabilityNext30Days(token).catch(() => ({ days: [] as GymAvailabilityDay[] }))
              : Promise.resolve({ days: [] as GymAvailabilityDay[] }),
            isMember
              ? api.listGeneralNotifications(token).catch(() => ({ notifications: [] as GeneralNotification[] }))
              : Promise.resolve({ notifications: [] as GeneralNotification[] }),
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
          setActiveTrainerObjects(isMember ? activeTrainersList : []);
          setNext30Days(isMember ? (next30DaysData as { days: GymAvailabilityDay[] }).days : []);
          setGymNotifications(isMember ? (notificationsData as { notifications: GeneralNotification[] }).notifications : []);
        } catch {
          if (!cancelled) {
            setTodayAvailability(null);
            setSummary(null);
            setStrengthSummary(null);
            setRoutine(null);
            setCheckins([]);
            setUnreadThreads([]);
            setActiveTrainers([]);
            setActiveTrainerObjects([]);
            setEmergencyTickets([]);
            setNext30Days([]);
            setGymNotifications([]);
          }
        }
      };

      void load();

      return () => {
        cancelled = true;
      };
    }, [isAdmin, token, user, currentWeekStart])
  );

  const effectiveUnreadCount =
    isAdmin && dashboardSummary && dashboardSummary.cards.unreadThreadsForAdmin.status === "ok"
      ? dashboardSummary.cards.unreadThreadsForAdmin.value
      : unreadThreads.length;

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
      <>
        <MemberHomeContent
          userName={user?.fullName ?? "Atleta"}
          heroTitle={memberHeroTitle}
          heroMeta={memberHeroMeta}
          progressLabel={memberProgressLabel}
          progressValue={memberProgressValue}
          insight={memberInsight}
          onStartWorkout={() => navigation.navigate("Rutina")}
          activeTrainers={activeTrainerObjects}
          todayAvailability={todayAvailability}
          upcomingDays={next30Days}
          notifications={gymNotifications}
          onReportar={() => setTicketModalVisible(true)}
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

        <Modal visible={ticketModalVisible} transparent animationType="slide" onRequestClose={() => setTicketModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>Reportar emergencia</Text>
              <Text style={styles.featureDetail}>Categoría</Text>
              <View style={styles.quickGrid}>
                {([
                  { value: "harassment", label: "Acoso" },
                  { value: "injury",     label: "Lesión" },
                  { value: "accident",   label: "Accidente" },
                  { value: "incident",   label: "Incidente" },
                ] as const).map(({ value, label }) => (
                  <Pressable
                    key={value}
                    style={[
                      styles.quickButton,
                      ticketCategory === value ? styles.quickButtonActive : null,
                    ]}
                    onPress={() => setTicketCategory(value)}
                  >
                    <Text style={styles.quickButtonText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={ticketDescription}
                onChangeText={setTicketDescription}
                placeholder="Describe qué sucede y dónde"
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
      </>
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

        {(effectiveUnreadCount > 0 || urgentOpenTickets.length > 0 || (isAdmin && unassignedAssistanceCount > 0)) ? (
          <View style={styles.priorityCard}>
            <Text style={styles.priorityEyebrow}>Prioridad</Text>
            {effectiveUnreadCount > 0 ? (
              <Text style={styles.priorityTitle}>Tienes {effectiveUnreadCount} conversación(es) sin leer</Text>
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
              {effectiveUnreadCount > 0 ? (
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
              <Text style={styles.sectionTitle}>
                En este momento
                {dashboardSummary?.cards.trainersActiveNow.status === "ok"
                  ? ` · ${dashboardSummary.cards.trainersActiveNow.value}`
                  : ""}
              </Text>
              {activeTrainerObjects.length === 0 ? (
                <Text style={styles.featureDetail}>No hay entrenadores activos ahora.</Text>
              ) : (
                <View style={styles.trainersRow}>
                  {activeTrainerObjects.map((trainer) => {
                    const initials = trainer.fullName.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
                    return (
                      <View key={trainer.id} style={styles.trainerChip}>
                        {trainer.avatarUrl ? (
                          <Image source={{ uri: trainer.avatarUrl }} style={styles.trainerAvatarImg} />
                        ) : (
                          <View style={styles.trainerAvatarFallback}>
                            <Text style={styles.trainerAvatarInitials}>{initials}</Text>
                          </View>
                        )}
                        <Text style={styles.trainerChipName} numberOfLines={1}>{trainer.fullName.split(" ")[0]}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Indicadores del gimnasio</Text>
              <Text style={styles.sectionTitle}>Resumen operativo</Text>
              {dashboardLastUpdated ? (
                <Text style={styles.featureDetail}>
                  Actualizado a las{" "}
                  {dashboardLastUpdated.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              ) : null}

              {dashboardSummary ? (
                <>
                  {/* Alerts banner */}
                  {dashboardSummary.alerts.filter((a) => a.severity !== "info").map((alert) => (
                    <View key={alert.type} style={styles.dashAlertBanner}>
                      <Text style={styles.dashAlertText}>{alert.message}</Text>
                    </View>
                  ))}

                  {/* KPI two-column grid */}
                  <View style={styles.twoColumnRow}>
                    <View style={styles.miniCardWarm}>
                      <Text style={styles.miniLabel}>Miembros activos hoy</Text>
                      <Text style={styles.miniValue}>
                        {dashboardSummary.cards.usersActiveToday.status === "ok"
                          ? dashboardSummary.cards.usersActiveToday.value
                          : "—"}
                      </Text>
                      {dashboardSummary.cards.usersActiveToday.status === "ok" ? (
                        <Text style={styles.miniLabel}>
                          {dashboardSummary.cards.usersActiveToday.trend.direction === "up" ? "▲" :
                           dashboardSummary.cards.usersActiveToday.trend.direction === "down" ? "▼" : "="}{" "}
                          vs ayer ({dashboardSummary.cards.usersActiveToday.trend.previousValue})
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.miniCardDark}>
                      <Text style={styles.miniLabelDark}>Suscripciones activas</Text>
                      <Text style={styles.miniValueDark}>
                        {dashboardSummary.cards.subscriptionsActive.status === "ok"
                          ? dashboardSummary.cards.subscriptionsActive.value
                          : "—"}
                      </Text>
                      {dashboardSummary.cards.subscriptionsActive.status === "ok" ? (
                        <Text style={styles.miniLabelDark}>
                          {dashboardSummary.cards.subscriptionsActive.trend.direction === "up" ? "▲" :
                           dashboardSummary.cards.subscriptionsActive.trend.direction === "down" ? "▼" : "="}{" "}
                          vs ayer ({dashboardSummary.cards.subscriptionsActive.trend.previousValue})
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.twoColumnRow}>
                    <View style={styles.miniCardDark}>
                      <Text style={styles.miniLabelDark}>Renovaciones hoy</Text>
                      <Text style={styles.miniValueDark}>
                        {dashboardSummary.cards.renewalsToday.status === "ok"
                          ? dashboardSummary.cards.renewalsToday.count
                          : "—"}
                      </Text>
                      {dashboardSummary.cards.renewalsToday.status === "ok" ? (
                        <Text style={styles.miniLabelDark}>
                          {dashboardSummary.cards.renewalsToday.currency}{" "}
                          {dashboardSummary.cards.renewalsToday.amount.toFixed(2)}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.miniCardWarm}>
                      <Text style={styles.miniLabel}>Ingresos hoy</Text>
                      <Text style={styles.miniValue}>
                        {dashboardSummary.cards.incomesToday.status === "ok"
                          ? `${dashboardSummary.cards.incomesToday.currency} ${dashboardSummary.cards.incomesToday.value.toFixed(2)}`
                          : "—"}
                      </Text>
                      {dashboardSummary.cards.incomesToday.status === "ok" ? (
                        <Text style={styles.miniLabel}>
                          {dashboardSummary.cards.incomesToday.trend.direction === "up" ? "▲" :
                           dashboardSummary.cards.incomesToday.trend.direction === "down" ? "▼" : "="}{" "}
                          vs ayer
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.twoColumnRow}>
                    <View style={styles.miniCardWarm}>
                      <Text style={styles.miniLabel}>Membresías vencidas</Text>
                      <Text style={styles.miniValue}>
                        {dashboardSummary.cards.subscriptionsExpired.status === "ok"
                          ? dashboardSummary.cards.subscriptionsExpired.count
                          : "—"}
                      </Text>
                    </View>
                    <View style={styles.miniCardDark}>
                      <Text style={styles.miniLabelDark}>Riesgo abandono</Text>
                      <Text style={styles.miniValueDark}>
                        {dashboardSummary.cards.churnRisk.status === "ok"
                          ? dashboardSummary.cards.churnRisk.count
                          : "—"}
                      </Text>
                      {dashboardSummary.cards.churnRisk.status === "ok" ? (
                        <Text style={styles.miniLabelDark}>
                          {dashboardSummary.cards.churnRisk.trend.direction === "up" ? "▲" :
                           dashboardSummary.cards.churnRisk.trend.direction === "down" ? "▼" : "="}{" "}
                          vs 30 días previos
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.twoColumnRow}>
                    <View style={styles.miniCardWarm}>
                      <Text style={styles.miniLabel}>Asistencia pendiente</Text>
                      <Text style={styles.miniValue}>
                        {dashboardSummary.cards.assistancePending.status === "ok"
                          ? dashboardSummary.cards.assistancePending.total
                          : "—"}
                      </Text>
                      {dashboardSummary.cards.assistancePending.status === "ok" ? (
                        <Text style={styles.miniLabel}>
                          {dashboardSummary.cards.assistancePending.byStatus.CREATED} sin asignar
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.miniCardDark}>
                      <Text style={styles.miniLabelDark}>Mensajes sin leer</Text>
                      <Text style={styles.miniValueDark}>
                        {dashboardSummary.cards.unreadThreadsForAdmin.status === "ok"
                          ? dashboardSummary.cards.unreadThreadsForAdmin.value
                          : "—"}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                adminHighlights.map((item) => (
                  <View key={item} style={styles.featureItem}>
                    <View style={styles.featureDot} />
                    <Text style={styles.featureTitle}>{item}</Text>
                  </View>
                ))
              )}

              <View style={styles.inlineActionsRow}>
                <Pressable style={styles.inlineActionPrimary} onPress={() => navigation.navigate("Perfil")}>
                  <Text style={styles.inlineActionPrimaryText}>Ver reporte operativo</Text>
                </Pressable>
              </View>
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
            <Text style={styles.featureDetail}>Categoría</Text>
            <View style={styles.quickGrid}>
              {([
                { value: "harassment", label: "Acoso" },
                { value: "injury",     label: "Lesión" },
                { value: "accident",   label: "Accidente" },
                { value: "incident",   label: "Incidente" },
              ] as const).map(({ value, label }) => (
                <Pressable
                  key={value}
                  style={[
                    styles.quickButton,
                    ticketCategory === value ? styles.quickButtonActive : null,
                  ]}
                  onPress={() => setTicketCategory(value)}
                >
                  <Text style={styles.quickButtonText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={ticketDescription}
              onChangeText={setTicketDescription}
              placeholder="Describe qué sucede y dónde"
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
  trainersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  trainerChip: {
    alignItems: "center",
    gap: 4,
    minWidth: 60,
  },
  trainerAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: palette.gold,
  },
  trainerAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: palette.gold,
    backgroundColor: palette.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  trainerAvatarInitials: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 15,
  },
  trainerChipName: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
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
  dashAlertBanner: {
    marginTop: 10,
    backgroundColor: "#FFF1EA",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#F7C4AA",
  },
  dashAlertText: {
    color: "#7A3B1E",
    fontSize: 13,
    fontWeight: "700",
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