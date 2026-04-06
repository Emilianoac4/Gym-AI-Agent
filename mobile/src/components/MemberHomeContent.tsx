import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "./AppButton";
import { AppCard } from "./AppCard";
import { AppProgressBar } from "./AppProgressBar";
import { AppScreen } from "./AppScreen";
import { designSystem } from "../theme/designSystem";
import { palette } from "../theme/palette";
import type { GymAvailabilityDay, GeneralNotification } from "../types/api";
import { palette } from "../theme/palette";
import type { GymAvailabilityDay, GeneralNotification } from "../types/api";

type SecondaryAction = {
  key: string;
  label: string;
  description: string;
  onPress: () => void;
};

type ActiveTrainer = { id: string; fullName: string; avatarUrl: string | null };

const DAY_LABELS: Record<string, string> = {
  monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles",
  thursday: "Jueves", friday: "Viernes", saturday: "Sábado", sunday: "Domingo",
};

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function formatWindow(day: GymAvailabilityDay): string {
  if (day.status !== "open" || !day.opensAt || !day.closesAt) return "";
  if (day.opensAtSecondary && day.closesAtSecondary) {
    return `${day.opensAt}–${day.closesAt}  ·  ${day.opensAtSecondary}–${day.closesAtSecondary}`;
  }
  return `${day.opensAt}–${day.closesAt}`;
}

const NOTIF_CATEGORY_LABEL: Record<string, string> = {
  emergency: "Emergencia",
  maintenance: "Mantenimiento",
  schedule: "Horario",
  promo: "Promoción",
  general: "General",
};

function notifCategoryColor(category: string): string {
  switch (category) {
    case "emergency": return "#EF4444";
    case "maintenance": return "#F59E0B";
    case "schedule": return palette.moss;
    default: return palette.gold;
  }
}

type Props = {
  userName: string;
  heroTitle: string;
  heroMeta: string;
  progressLabel: string;
  progressValue: number;
  insight: string;
  onStartWorkout: () => void;
  secondaryActions: SecondaryAction[];
  activeTrainers?: ActiveTrainer[];
  todayAvailability?: GymAvailabilityDay | null;
  upcomingDays?: GymAvailabilityDay[];
  notifications?: GeneralNotification[];
  onReportar?: () => void;
};

export function MemberHomeContent({
  userName,
  heroTitle,
  heroMeta,
  progressLabel,
  progressValue,
  insight,
  onStartWorkout,
  secondaryActions,
  activeTrainers = [],
  todayAvailability,
  upcomingDays = [],
  notifications = [],
  onReportar,
}: Props) {
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const futureDays = upcomingDays.slice(1); // skip today (shown above)
  return (
    <AppScreen scrollable contentStyle={styles.content}>
      <AppCard variant="hero" style={styles.heroCard}>
        <Text style={styles.eyebrow}>Hola, {userName}</Text>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.heroMeta}>{heroMeta}</Text>
        <AppButton label="Iniciar entrenamiento" onPress={onStartWorkout} />
      </AppCard>

      <AppCard variant="default">
        <Text style={styles.sectionEyebrow}>Progreso semanal</Text>
        <Text style={styles.sectionTitle}>{progressLabel}</Text>
        <AppProgressBar progress={progressValue} style={styles.progressBar} />
      </AppCard>

      <AppCard variant="default">
        <Text style={styles.sectionEyebrow}>Insight de Tuco</Text>
        <Text style={styles.insightText}>{insight}</Text>
      </AppCard>

      {activeTrainers.length > 0 && (
        <AppCard variant="default">
          <Text style={styles.sectionEyebrow}>Entrenadores disponibles</Text>
          <Text style={styles.sectionTitle}>En el gimnasio ahora</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.trainersScroll}
            contentContainerStyle={styles.trainersRow}
          >
            {activeTrainers.map((trainer) => {
              const initials = trainer.fullName
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("");
              return (
                <View key={trainer.id} style={styles.trainerChip}>
                  <View style={styles.trainerAvatar}>
                    <Text style={styles.trainerAvatarText}>{initials}</Text>
                  </View>
                  <Text style={styles.trainerName} numberOfLines={1}>{trainer.fullName.split(" ")[0]}</Text>
                </View>
              );
            })}
          </ScrollView>
        </AppCard>
      )}

      <AppCard variant="flat">
        <Text style={styles.sectionEyebrow}>Siguientes pasos</Text>
        <View style={styles.secondaryList}>
          {secondaryActions.map((action) => (
            <Pressable key={action.key} style={styles.secondaryAction} onPress={action.onPress}>
              <Text style={styles.secondaryActionLabel}>{action.label}</Text>
              <Text style={styles.secondaryActionDescription}>{action.description}</Text>
            </Pressable>
          ))}
        </View>
      </AppCard>

      {/* ── Disponibilidad del gimnasio ── */}
      <AppCard variant="default">
        <Text style={styles.sectionEyebrow}>Disponibilidad del gimnasio</Text>

        {/* Hoy */}
        <View style={styles.todayRow}>
          <View style={styles.todayLeft}>
            <Text style={styles.todayLabel}>Hoy</Text>
            {todayAvailability?.status === "open" && todayAvailability.opensAt ? (
              <Text style={styles.todayHours}>{formatWindow(todayAvailability)}</Text>
            ) : (
              <Text style={styles.todayClosed}>
                {todayAvailability?.status === "closed" ? "Cerrado hoy" : "Sin horario publicado"}
              </Text>
            )}
            {todayAvailability?.note ? (
              <Text style={styles.todayNote}>{todayAvailability.note}</Text>
            ) : null}
          </View>
          <View style={[
            styles.todayBadge,
            todayAvailability?.status === "open" ? styles.todayBadgeOpen : styles.todayBadgeClosed,
          ]}>
            <Text style={styles.todayBadgeText}>
              {todayAvailability?.status === "open" ? "Abierto" : "Cerrado"}
            </Text>
          </View>
        </View>

        {/* Próximos 30 días — desplegable */}
        {futureDays.length > 0 ? (
          <>
            <Pressable style={styles.expandRow} onPress={() => setScheduleExpanded((v) => !v)}>
              <Text style={styles.expandLabel}>Próximos 30 días</Text>
              <Text style={styles.expandChevron}>{scheduleExpanded ? "▲" : "▼"}</Text>
            </Pressable>

            {scheduleExpanded ? (
              <View style={styles.upcomingList}>
                {futureDays.map((day) => {
                  const isOpen = day.status === "open";
                  const window = formatWindow(day);
                  return (
                    <View key={day.date} style={styles.upcomingRow}>
                      <View style={styles.upcomingLeft}>
                        <Text style={styles.upcomingDayName}>
                          {DAY_LABELS[day.dayOfWeek] ?? day.dayOfWeek}
                        </Text>
                        <Text style={styles.upcomingDate}>{formatDateShort(day.date)}</Text>
                      </View>
                      <View style={styles.upcomingRight}>
                        {isOpen && window ? (
                          <Text style={styles.upcomingHours}>{window}</Text>
                        ) : (
                          <Text style={styles.upcomingClosed}>Cerrado</Text>
                        )}
                        {day.note ? (
                          <Text style={styles.upcomingNote}>{day.note}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}
      </AppCard>

      {/* ── Notificaciones del gimnasio ── */}
      {notifications.length > 0 ? (
        <AppCard variant="default">
          <Text style={styles.sectionEyebrow}>Notificaciones</Text>
          <View style={styles.notifList}>
            {notifications.map((notif) => (
              <View key={notif.id} style={styles.notifItem}>
                <View style={[styles.notifDot, { backgroundColor: notifCategoryColor(notif.category) }]} />
                <View style={styles.notifBody}>
                  <View style={styles.notifTopRow}>
                    <Text style={styles.notifTitle}>{notif.title}</Text>
                    <Text style={styles.notifCategory}>
                      {NOTIF_CATEGORY_LABEL[notif.category] ?? notif.category}
                    </Text>
                  </View>
                  <Text style={styles.notifMessage}>{notif.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </AppCard>
      ) : null}

      {onReportar ? (
        <Pressable style={styles.reportBtn} onPress={onReportar}>
          <Text style={styles.reportBtnText}>⚠ Reportar emergencia</Text>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: designSystem.spacing.x2,
  },
  heroCard: {
    gap: designSystem.spacing.x2,
  },
  eyebrow: {
    color: designSystem.colors.textSecondary,
    fontSize: designSystem.typography.bodySM,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  heroTitle: {
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.titleXL,
    lineHeight: 36,
    fontWeight: "700",
    fontFamily: designSystem.typography.fontFamily,
  },
  heroMeta: {
    color: designSystem.colors.textSecondary,
    fontSize: designSystem.typography.bodyMD,
    lineHeight: 21,
    fontWeight: "500",
    fontFamily: designSystem.typography.fontFamily,
  },
  sectionEyebrow: {
    color: designSystem.colors.textSecondary,
    fontSize: designSystem.typography.bodySM,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  sectionTitle: {
    marginTop: designSystem.spacing.x1,
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.titleMD,
    lineHeight: 28,
    fontWeight: "700",
    fontFamily: designSystem.typography.fontFamily,
  },
  progressBar: {
    marginTop: designSystem.spacing.x2,
  },
  insightText: {
    marginTop: designSystem.spacing.x1,
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.bodyLG,
    lineHeight: 24,
    fontWeight: "500",
    fontFamily: designSystem.typography.fontFamily,
  },
  secondaryList: {
    marginTop: designSystem.spacing.x2,
    gap: designSystem.spacing.x1,
  },
  secondaryAction: {
    backgroundColor: designSystem.colors.surfaceElevated,
    borderRadius: designSystem.radius.md,
    paddingHorizontal: designSystem.spacing.x2,
    paddingVertical: designSystem.spacing.x2,
  },
  secondaryActionLabel: {
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.bodyLG,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  secondaryActionDescription: {
    marginTop: designSystem.spacing.x0_5,
    color: designSystem.colors.textSecondary,
    fontSize: designSystem.typography.bodyMD,
    lineHeight: 20,
    fontWeight: "500",
    fontFamily: designSystem.typography.fontFamily,
  },
  trainersScroll: {
    marginTop: designSystem.spacing.x2,
  },
  trainersRow: {
    gap: designSystem.spacing.x2,
    paddingBottom: 4,
  },
  trainerChip: {
    alignItems: "center",
    gap: designSystem.spacing.x1,
    minWidth: 60,
  },
  trainerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: designSystem.colors.surfaceElevated,
    borderWidth: 2,
    borderColor: designSystem.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  trainerAvatarText: {
    color: designSystem.colors.primary,
    fontWeight: "700",
    fontSize: 15,
    fontFamily: designSystem.typography.fontFamily,
  },
  trainerName: {
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.bodySM,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
    textAlign: "center",
    maxWidth: 64,
  },
  // ── Disponibilidad ──────────────────────
  todayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: designSystem.spacing.x1,
    gap: 12,
  },
  todayLeft: {
    flex: 1,
    gap: 4,
  },
  todayLabel: {
    color: palette.cocoa,
    fontSize: designSystem.typography.titleMD,
    fontWeight: "800",
    fontFamily: designSystem.typography.fontFamily,
  },
  todayHours: {
    color: palette.cocoa,
    fontSize: designSystem.typography.bodyLG,
    fontWeight: "700",
    fontFamily: designSystem.typography.fontFamily,
  },
  todayClosed: {
    color: palette.textMuted,
    fontSize: designSystem.typography.bodyMD,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  todayNote: {
    color: palette.textMuted,
    fontSize: designSystem.typography.bodySM,
    lineHeight: 18,
    fontFamily: designSystem.typography.fontFamily,
  },
  todayBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  todayBadgeOpen: {
    backgroundColor: palette.moss,
  },
  todayBadgeClosed: {
    backgroundColor: palette.cocoa,
  },
  todayBadgeText: {
    color: "#fff",
    fontSize: designSystem.typography.bodySM,
    fontWeight: "800",
    fontFamily: designSystem.typography.fontFamily,
  },
  expandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: designSystem.spacing.x2,
    paddingTop: designSystem.spacing.x2,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  expandLabel: {
    color: palette.cocoa,
    fontSize: designSystem.typography.bodyMD,
    fontWeight: "700",
    fontFamily: designSystem.typography.fontFamily,
  },
  expandChevron: {
    color: palette.textMuted,
    fontSize: 13,
  },
  upcomingList: {
    marginTop: designSystem.spacing.x1,
    gap: 8,
  },
  upcomingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  upcomingLeft: {
    gap: 2,
  },
  upcomingDayName: {
    color: palette.cocoa,
    fontSize: designSystem.typography.bodyMD,
    fontWeight: "700",
    fontFamily: designSystem.typography.fontFamily,
  },
  upcomingDate: {
    color: palette.textMuted,
    fontSize: designSystem.typography.bodySM,
    fontFamily: designSystem.typography.fontFamily,
  },
  upcomingRight: {
    alignItems: "flex-end",
    gap: 2,
    flex: 1,
    paddingLeft: 12,
  },
  upcomingHours: {
    color: palette.cocoa,
    fontSize: designSystem.typography.bodyMD,
    fontWeight: "600",
    textAlign: "right",
    fontFamily: designSystem.typography.fontFamily,
  },
  upcomingClosed: {
    color: palette.textMuted,
    fontSize: designSystem.typography.bodyMD,
    fontFamily: designSystem.typography.fontFamily,
  },
  upcomingNote: {
    color: palette.textMuted,
    fontSize: designSystem.typography.bodySM,
    textAlign: "right",
    fontFamily: designSystem.typography.fontFamily,
  },
  // ── Notificaciones ──────────────────────
  notifList: {
    marginTop: designSystem.spacing.x1,
    gap: 12,
  },
  notifItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  notifDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    flexShrink: 0,
  },
  notifBody: {
    flex: 1,
    gap: 4,
  },
  notifTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  notifTitle: {
    color: palette.cocoa,
    fontSize: designSystem.typography.bodyMD,
    fontWeight: "700",
    flex: 1,
    fontFamily: designSystem.typography.fontFamily,
  },
  notifCategory: {
    color: palette.textMuted,
    fontSize: designSystem.typography.bodySM,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  notifMessage: {
    color: palette.textMuted,
    fontSize: designSystem.typography.bodyMD,
    lineHeight: 20,
    fontFamily: designSystem.typography.fontFamily,
  },
  // ── Boton Reportar ──────────────────────
  reportBtn: {
    marginTop: designSystem.spacing.x2,
    marginBottom: designSystem.spacing.x1,
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  reportBtnText: {
    color: "#fff",
    fontSize: designSystem.typography.bodyLG,
    fontWeight: "800",
    fontFamily: designSystem.typography.fontFamily,
    letterSpacing: 0.3,
  },
});
