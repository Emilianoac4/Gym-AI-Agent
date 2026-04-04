import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { AdminKpi, AssistanceRatingEntry, ChurnRiskEntry, GymSettings, MembershipReport, TrainerPresenceSummaryDay } from "../../types/api";
import { palette } from "../../theme/palette";

const REPORT_OPTIONS = [
  { label: "1 dia", days: 1 },
  { label: "1 semana", days: 7 },
  { label: "1 mes", days: 30 },
  { label: "3 meses", days: 90 },
  { label: "6 meses", days: 180 },
] as const;

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatMoney = (value: number, currency: "USD" | "CRC") =>
  new Intl.NumberFormat(currency === "CRC" ? "es-CR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);

const formatHour = (value: string | null) => {
  if (!value) {
    return "En curso";
  }

  return new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const monthLabels = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const weekHeaders = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
};

const shiftMonth = (base: Date, amount: number) =>
  new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + amount, 1));

const buildMonthMatrix = (monthStart: Date) => {
  const start = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1));
  const firstWeekday = (start.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const result: Array<Date | null> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    result.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    result.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day)));
  }

  while (result.length % 7 !== 0) {
    result.push(null);
  }

  return result;
};

export function AdminProfileScreen() {
  const { user, token, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [presenceDays, setPresenceDays] = useState<TrainerPresenceSummaryDay[]>([]);
  const [report, setReport] = useState<MembershipReport | null>(null);
  const [reportRangeLabel, setReportRangeLabel] = useState("1 semana");
  const [rangeSelectorVisible, setRangeSelectorVisible] = useState(false);
  const [dateSelectorVisible, setDateSelectorVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [expandedPresenceMonth, setExpandedPresenceMonth] = useState(false);
  const [gymSettings, setGymSettings] = useState<GymSettings | null>(null);
  const [ratingsHistory, setRatingsHistory] = useState<AssistanceRatingEntry[]>([]);
  const [kpi, setKpi] = useState<AdminKpi | null>(null);
  const [churnRisk, setChurnRisk] = useState<ChurnRiskEntry[]>([]);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [selectedReportDate, setSelectedReportDate] = useState(() => toDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const calendarDays = useMemo(() => buildMonthMatrix(calendarMonth), [calendarMonth]);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const [presenceResponse, reportResponse, settingsResponse, ratingsResponse, kpiResponse, churnResponse] = await Promise.all([
        api.getTrainerPresenceSummary(token, 30),
        api.getMembershipReport(token, 7),
        api.getGymSettings(token),
        api.listAssistanceRatings(token).catch(() => ({ ratings: [], total: 0 })),
        api.getKpi(token).catch(() => null),
        api.getChurnRisk(token).catch(() => ({ churnRisk: [] })),
      ]);
      setPresenceDays(presenceResponse.days);
      setReport(reportResponse.report);
      setGymSettings(settingsResponse.settings);
      setRatingsHistory(ratingsResponse.ratings);
      if (kpiResponse) setKpi(kpiResponse.kpi);
      setChurnRisk(churnResponse.churnRisk);
      setReportRangeLabel("1 semana");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar el panel administrativo";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const activeCoaches = useMemo(
    () => presenceDays.slice(-7).reduce((count, day) => count + day.activeCount, 0),
    [presenceDays],
  );

  const visiblePresenceDays = useMemo(
    () => (expandedPresenceMonth ? presenceDays : presenceDays.slice(-7)),
    [expandedPresenceMonth, presenceDays],
  );

  const onGenerateReport = async (days: number, label: string, specificDate?: string) => {
    if (!token) {
      return;
    }

    setRangeSelectorVisible(false);
    setDateSelectorVisible(false);
    setExporting(true);
    try {
      const response = await api.getMembershipReport(token, days, specificDate);
      setReport(response.report);
      setReportRangeLabel(specificDate ? `Dia especifico (${specificDate})` : label);
      Alert.alert("Reporte generado", `Se actualizaron ${response.report.summary.rowCount} movimientos.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo exportar el reporte";
      Alert.alert("Error", message);
    } finally {
      setExporting(false);
    }
  };

  const onSendLinkedEmail = async () => {
    if (!token || !report) {
      return;
    }

    setExporting(true);
    try {
      const response = await api.sendMembershipReport(token, {
        days: report.periodDays,
        specificDate: report.specificDate ?? undefined,
        delivery: "linked",
      });
      Alert.alert("Reporte enviado", response.message);
      setSendModalVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar el reporte";
      Alert.alert("Error", message);
    } finally {
      setExporting(false);
    }
  };

  const onSendCustomEmail = async () => {
    if (!token || !report) {
      return;
    }

    const sanitizedEmail = customEmail.trim();
    if (!sanitizedEmail) {
      Alert.alert("Correo requerido", "Ingresa un correo para enviar el reporte.");
      return;
    }

    setExporting(true);
    try {
      const response = await api.sendMembershipReport(token, {
        days: report.periodDays,
        specificDate: report.specificDate ?? undefined,
        delivery: "custom",
        email: sanitizedEmail,
      });
      Alert.alert("Reporte enviado", response.message);
      setSendModalVisible(false);
      setCustomEmail("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar el reporte";
      Alert.alert("Error", message);
    } finally {
      setExporting(false);
    }
  };

  const toggleTrainerSessions = (key: string) => {
    setExpandedSessions((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? false),
    }));
  };

  const onUpdateCurrency = async (currency: "USD" | "CRC") => {
    if (!token || savingCurrency || gymSettings?.currency === currency) {
      return;
    }

    setSavingCurrency(true);
    try {
      const response = await api.updateGymSettings(token, { currency });
      setGymSettings(response.settings);
      Alert.alert("Moneda actualizada", `Ahora la moneda global es ${response.settings.currency}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la moneda";
      Alert.alert("Error", message);
    } finally {
      setSavingCurrency(false);
    }
  };

  const onLogout = () => {
    Alert.alert("Cerrar sesión", "¿Deseas cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.fullName?.charAt(0).toUpperCase() ?? "A"}</Text>
          </View>
          <Text style={styles.name}>{user?.fullName ?? "Administrador"}</Text>
          <Text style={styles.email}>{user?.email ?? ""}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Administrador</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Miembros activos</Text>
            <Text style={styles.summaryValue}>{kpi?.membersWithActiveMembership ?? "—"}</Text>
            <Text style={styles.summaryHint}>membresía vigente</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Nuevos hoy</Text>
            <Text style={styles.summaryValue}>{kpi?.newUsersToday ?? "—"}</Text>
            <Text style={styles.summaryHint}>registros del día</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entrenadores</Text>
            <Text style={styles.summaryValue}>{kpi?.activeTrainersNow ?? activeCoaches}</Text>
            <Text style={styles.summaryHint}>activos ahora</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ingresos (semana)</Text>
            <Text style={[styles.summaryValue, { fontSize: 20 }]}>
              {kpi
                ? new Intl.NumberFormat(kpi.currency === "CRC" ? "es-CR" : "en-US", {
                    style: "currency",
                    currency: kpi.currency,
                    maximumFractionDigits: 0,
                  }).format(kpi.week.revenue)
                : "—"}
            </Text>
            <Text style={styles.summaryHint}>
              {kpi ? `${kpi.week.registrations + kpi.week.renewals} movimientos` : ""}
            </Text>
          </View>
        </View>

        {churnRisk.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⚠️ Riesgo de abandono</Text>
            </View>
            {churnRisk.map((entry) => (
              <View key={entry.userId} style={styles.churnCard}>
                <Text style={styles.churnName}>{entry.fullName}</Text>
                <Text style={styles.churnMeta}>
                  {entry.daysSince !== null
                    ? `Sin actividad: ${entry.daysSince}d`
                    : "Sin actividad registrada"}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Configuración general</Text>
          </View>
          <Text style={styles.summaryHint}>Moneda global para reportes y transacciones</Text>
          <View style={styles.sectionHeaderActions}>
            <TouchableOpacity
              style={[styles.refreshChip, gymSettings?.currency === "USD" ? styles.selectedChip : null]}
              onPress={() => void onUpdateCurrency("USD")}
              disabled={savingCurrency}
            >
              <Text style={styles.refreshChipText}>USD</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.refreshChip, gymSettings?.currency === "CRC" ? styles.selectedChip : null]}
              onPress={() => void onUpdateCurrency("CRC")}
              disabled={savingCurrency}
            >
              <Text style={styles.refreshChipText}>CRC</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Horas de entrada y salida</Text>
            <View style={styles.sectionHeaderActions}>
              <TouchableOpacity
                style={styles.refreshChip}
                onPress={() => setExpandedPresenceMonth((current) => !current)}
              >
                <Text style={styles.refreshChipText}>
                  {expandedPresenceMonth ? "Ver ultima semana" : "Ver ultimo mes"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.refreshChip} onPress={() => void loadDashboard()}>
                <Text style={styles.refreshChipText}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={palette.cocoa} />
            </View>
          ) : presenceDays.length === 0 ? (
            <View style={styles.infoCard}>
              <Text style={styles.emptyText}>Todavia no hay actividad registrada de entrenadores.</Text>
            </View>
          ) : (
            visiblePresenceDays.map((day) => (
              <View key={day.date} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{formatDate(day.date)}</Text>
                  <Text style={styles.daySubtitle}>{day.activeCount} activos</Text>
                </View>
                {day.trainers.length === 0 ? (
                  <Text style={styles.emptyText}>Sin movimientos ese dia.</Text>
                ) : (
                  day.trainers.map((trainer) => (
                    <View key={`${day.date}-${trainer.trainerId}`} style={styles.trainerBlock}>
                      {(() => {
                        const trainerKey = `${day.date}-${trainer.trainerId}`;
                        const canCollapse = trainer.sessions.length >= 3;
                        const isExpanded = expandedSessions[trainerKey] ?? !canCollapse;

                        return (
                          <>
                            <TouchableOpacity
                              style={styles.trainerHeaderBtn}
                              onPress={() => canCollapse && toggleTrainerSessions(trainerKey)}
                              activeOpacity={canCollapse ? 0.75 : 1}
                            >
                              <Text style={styles.trainerName}>{trainer.trainerName}</Text>
                              {canCollapse ? (
                                <Text style={styles.trainerChevron}>{isExpanded ? "▾" : "▸"}</Text>
                              ) : null}
                            </TouchableOpacity>
                            {isExpanded
                              ? trainer.sessions.map((session) => {
                                  const left = `${(session.startHour / 24) * 100}%` as const;
                                  const width = `${Math.max(((session.endHour - session.startHour) / 24) * 100, 4)}%` as const;

                                  return (
                                    <View key={session.id} style={styles.timelineCard}>
                                      <Text style={styles.timelineLabel}>
                                        {formatHour(session.startedAt)} - {formatHour(session.endedAt)}
                                      </Text>
                                      <View style={styles.timelineTrack}>
                                        <View style={[styles.timelineBar, { left, width }]} />
                                      </View>
                                    </View>
                                  );
                                })
                              : null}
                          </>
                        );
                      })()}
                    </View>
                  ))
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Calificaciones del último mes</Text>
            <TouchableOpacity style={styles.refreshChip} onPress={() => void loadDashboard()}>
              <Text style={styles.refreshChipText}>Actualizar</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={palette.cocoa} />
            </View>
          ) : ratingsHistory.length === 0 ? (
            <View style={styles.infoCard}>
              <Text style={styles.emptyText}>No hay solicitudes calificadas en los últimos 30 días.</Text>
            </View>
          ) : (
            ratingsHistory.map((entry) => (
              <View key={entry.id} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.trainerName}>{entry.memberName}</Text>
                  <Text style={styles.ratingStars}>
                    {"★".repeat(entry.rating ?? 0)}{"☆".repeat(5 - (entry.rating ?? 0))}
                  </Text>
                </View>
                {entry.trainerName ? (
                  <Text style={styles.trainerSessionMeta}>Entrenador: {entry.trainerName}</Text>
                ) : null}
                <Text style={styles.trainerSessionMeta}>
                  {entry.ratedAt ? formatDateTime(entry.ratedAt) : ""}
                </Text>
                {entry.resolution ? (
                  <Text style={styles.emptyText} numberOfLines={2}>{entry.resolution}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reporte de registros y renovaciones</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, exporting && styles.primaryBtnDisabled]}
              onPress={() => setRangeSelectorVisible(true)}
              disabled={exporting}
            >
              <Text style={styles.primaryBtnText}>{exporting ? "Procesando..." : "Generar reporte"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.reportCaption}>Rango actual: {report?.reportLabel ?? reportRangeLabel}</Text>
            <Text style={styles.reportAmount}>
              {formatMoney(
                report?.summary.totalAmount ?? 0,
                report?.currency ?? gymSettings?.currency ?? "USD",
              )}
            </Text>
            <View style={styles.reportStatsRow}>
              <View style={styles.reportStatChip}>
                <Text style={styles.reportStatValue}>{report?.summary.totalRegistrations ?? 0}</Text>
                <Text style={styles.reportStatLabel}>Registros</Text>
              </View>
              <View style={styles.reportStatChip}>
                <Text style={styles.reportStatValue}>{report?.summary.totalRenewals ?? 0}</Text>
                <Text style={styles.reportStatLabel}>Renovaciones</Text>
              </View>
              <View style={styles.reportStatChip}>
                <Text style={styles.reportStatValue}>{report?.summary.rowCount ?? 0}</Text>
                <Text style={styles.reportStatLabel}>Movimientos</Text>
              </View>
            </View>
            {report?.rows?.slice(0, 5).map((row) => (
              <View key={row.id} style={styles.reportRow}>
                <View>
                  <Text style={styles.reportRowTitle}>{row.memberName}</Text>
                  <Text style={styles.reportRowMeta}>
                    {row.typeLabel} · {row.paymentMethodLabel} · {row.actorName}
                  </Text>
                </View>
                <View style={styles.reportRowRight}>
                  <Text style={styles.reportRowAmount}>{formatMoney(row.amount, row.currency)}</Text>
                  <Text style={styles.reportRowMeta}>{formatDateTime(row.date)}</Text>
                </View>
              </View>
            ))}
            <View style={styles.reportActionsRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, (!report || exporting) && styles.primaryBtnDisabled]}
                onPress={() => setSendModalVisible(true)}
                disabled={!report || exporting}
              >
                <Text style={styles.secondaryBtnText}>Enviar reporte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={rangeSelectorVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRangeSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Generar reporte</Text>
            <Text style={styles.modalSubtitle}>Selecciona el rango para mostrar en pantalla</Text>
            {REPORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.days}
                style={styles.optionBtn}
                onPress={() => void onGenerateReport(option.days, option.label)}
              >
                <Text style={styles.optionBtnText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.optionBtn}
              onPress={() => {
                setRangeSelectorVisible(false);
                const current = parseDateKey(selectedReportDate);
                setCalendarMonth(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)));
                setDateSelectorVisible(true);
              }}
            >
              <Text style={styles.optionBtnText}>Dia especifico</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCancelBtn} onPress={() => setRangeSelectorVisible(false)}>
              <Text style={styles.optionCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={dateSelectorVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDateSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seleccionar dia</Text>
            <Text style={styles.modalSubtitle}>El reporte se filtrara solo para este dia</Text>

            <View style={styles.calendarHeader}>
              <TouchableOpacity style={styles.calendarArrowButton} onPress={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}>
                <Text style={styles.calendarArrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>
                {monthLabels[calendarMonth.getUTCMonth()]} {calendarMonth.getUTCFullYear()}
              </Text>
              <TouchableOpacity style={styles.calendarArrowButton} onPress={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}>
                <Text style={styles.calendarArrowText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekHeaderRow}>
              {weekHeaders.map((header) => (
                <Text key={header} style={styles.weekHeaderCell}>{header}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.calendarCell} />;
                }

                const dateKey = toDateKey(day);
                const isSelected = dateKey === selectedReportDate;

                return (
                  <TouchableOpacity
                    key={dateKey}
                    style={[styles.calendarCell, isSelected && styles.calendarCellSelected]}
                    onPress={() => setSelectedReportDate(dateKey)}
                  >
                    <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextSelected]}>
                      {day.getUTCDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.optionBtn}
              onPress={() => void onGenerateReport(1, "Dia especifico", selectedReportDate)}
            >
              <Text style={styles.optionBtnText}>Generar para {selectedReportDate}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCancelBtn} onPress={() => setDateSelectorVisible(false)}>
              <Text style={styles.optionCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={sendModalVisible} animationType="fade" transparent onRequestClose={() => setSendModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enviar reporte</Text>
            <Text style={styles.modalSubtitle}>Elige como deseas compartir el reporte actual</Text>
            <TouchableOpacity style={styles.optionBtn} onPress={() => void onSendLinkedEmail()}>
              <Text style={styles.optionBtnText}>Enviar al correo vinculado con este perfil</Text>
            </TouchableOpacity>
            <Text style={styles.inputLabel}>Enviar a un correo especifico</Text>
            <TextInput
              style={styles.input}
              value={customEmail}
              onChangeText={setCustomEmail}
              placeholder="correo@dominio.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.optionBtn} onPress={() => void onSendCustomEmail()}>
              <Text style={styles.optionBtnText}>Enviar a este correo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCancelBtn} onPress={() => setSendModalVisible(false)}>
              <Text style={styles.optionCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: palette.cream, padding: 20, paddingTop: 60 },
  heroCard: {
    backgroundColor: palette.moss,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.cream + "30",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: "700", color: palette.cream },
  name: { fontSize: 22, fontWeight: "700", color: palette.cream, marginBottom: 4 },
  email: { fontSize: 14, color: palette.cream + "CC", marginBottom: 12 },
  roleBadge: {
    backgroundColor: palette.gold,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeText: { fontWeight: "700", color: palette.cocoa, fontSize: 13 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  summaryCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.sand,
  },
  summaryLabel: { fontSize: 12, color: palette.cocoa + "99", fontWeight: "700", textTransform: "uppercase" },
  summaryValue: { fontSize: 28, color: palette.cocoa, fontWeight: "800", marginTop: 8 },
  summaryAlert: { color: "#ef4444" },
  summaryHint: { fontSize: 12, color: palette.cocoa + "88", marginTop: 6 },
  churnCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f59e0b",
    marginBottom: 8,
  },
  churnName: { fontWeight: "700", color: palette.cocoa, fontSize: 15 },
  churnMeta: { marginTop: 4, fontSize: 13, color: palette.cocoa + "aa" },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  sectionHeaderActions: {
    flexDirection: "row",
    gap: 8,
  },
  sectionTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: palette.cocoa },
  refreshChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.sand,
  },
  selectedChip: {
    backgroundColor: palette.gold,
    borderWidth: 1,
    borderColor: palette.cocoa,
  },
  refreshChipText: { color: palette.cocoa, fontWeight: "700", fontSize: 12 },
  primaryBtn: {
    backgroundColor: palette.cocoa,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: palette.cream, fontWeight: "800", fontSize: 13 },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.sand,
  },
  dayCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.sand,
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dayTitle: { color: palette.cocoa, fontWeight: "800", fontSize: 15 },
  daySubtitle: { color: palette.moss, fontWeight: "700", fontSize: 12 },
  trainerBlock: { marginTop: 10 },
  trainerHeaderBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trainerName: { color: palette.cocoa, fontWeight: "700", flex: 1 },
  trainerChevron: { color: palette.cocoa, fontSize: 16, fontWeight: "800", marginLeft: 8 },
  trainerSessionMeta: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
  ratingStars: { color: palette.gold, fontSize: 16, marginLeft: 8 },
  timelineCard: { marginBottom: 8 },
  timelineLabel: { color: palette.cocoa + "AA", fontSize: 12, marginBottom: 4 },
  timelineTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: palette.sand,
    overflow: "hidden",
    position: "relative",
  },
  timelineBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: palette.moss,
  },
  emptyText: { color: palette.cocoa + "88", lineHeight: 20 },
  reportCaption: { color: palette.cocoa + "99", fontWeight: "700", marginBottom: 6 },
  reportAmount: { color: palette.cocoa, fontSize: 30, fontWeight: "800", marginBottom: 14 },
  reportStatsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  reportStatChip: {
    flex: 1,
    backgroundColor: palette.cream,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  reportStatValue: { color: palette.cocoa, fontSize: 18, fontWeight: "800" },
  reportStatLabel: { color: palette.cocoa + "99", fontSize: 11, marginTop: 4 },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.sand,
    gap: 12,
  },
  reportRowTitle: { color: palette.cocoa, fontWeight: "700" },
  reportRowMeta: { color: palette.cocoa + "88", fontSize: 12, marginTop: 3 },
  reportRowRight: { alignItems: "flex-end" },
  reportRowAmount: { color: palette.moss, fontWeight: "800" },
  reportActionsRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.sand,
    paddingTop: 12,
  },
  secondaryBtn: {
    backgroundColor: palette.moss,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  logoutBtn: {
    backgroundColor: palette.coral,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  logoutBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(44, 29, 18, 0.35)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: { color: palette.cocoa, fontSize: 20, fontWeight: "800" },
  modalSubtitle: { color: palette.cocoa + "88", marginTop: 6, marginBottom: 14 },
  optionBtn: {
    backgroundColor: palette.cream,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  optionBtnText: { color: palette.cocoa, fontWeight: "700" },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  calendarArrowButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarArrowText: {
    color: palette.cocoa,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "700",
  },
  calendarTitle: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 14,
  },
  weekHeaderRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekHeaderCell: {
    flex: 1,
    textAlign: "center",
    color: palette.cocoa + "99",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  calendarCell: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  calendarCellSelected: {
    backgroundColor: palette.cocoa,
  },
  calendarCellText: {
    color: palette.cocoa,
    fontWeight: "600",
  },
  calendarCellTextSelected: {
    color: palette.cream,
    fontWeight: "800",
  },
  inputLabel: { color: palette.cocoa, marginTop: 8, marginBottom: 6, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: palette.sand,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: palette.cocoa,
    backgroundColor: "#fff",
  },
  optionCancelBtn: { alignItems: "center", paddingTop: 8 },
  optionCancelText: { color: palette.coral, fontWeight: "700" },
});
