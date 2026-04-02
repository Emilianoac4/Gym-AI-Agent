import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";
import { GymAvailabilityDay, GymAvailabilitySlotState } from "../../types/api";

const dayLabels: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miercoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sabado",
  sunday: "Domingo",
};

const slotLabels: Record<GymAvailabilitySlotState, string> = {
  high: "Disponible",
  limited: "Reducido",
  closed: "Cerrado",
};

function formatDateLabel(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function GymAvailabilityScreen() {
  const { token } = useAuth();
  const [days, setDays] = useState<GymAvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!token) {
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await api.getAvailabilityNext7Days(token);
      setDays(data.days);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.cocoa} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.cocoa} />}
    >
      {days.map((day) => (
        <View key={day.date} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <View>
              <Text style={styles.dayTitle}>{dayLabels[day.dayOfWeek] ?? day.dayOfWeek}</Text>
              <Text style={styles.daySubtitle}>{formatDateLabel(day.date)}</Text>
            </View>
            <View style={[styles.statusBadge, day.status === "open" ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
              <Text style={[styles.statusBadgeText, day.status === "open" ? styles.statusBadgeTextDark : undefined]}>
                {day.status === "open" ? "Abierto" : "Cerrado"}
              </Text>
            </View>
          </View>

          <Text style={styles.windowText}>
            {day.status === "open" && day.opensAt && day.closesAt
              ? `${day.opensAt} - ${day.closesAt}`
              : day.source === "default_closed"
                ? "Sin horario publicado"
                : "No disponible"}
          </Text>

          {day.note ? <Text style={styles.note}>{day.note}</Text> : null}

          <View style={styles.slotWrap}>
            {day.slots.length > 0 ? (
              day.slots.map((slot, index) => (
                <View
                  key={`${day.date}-${slot.label}-${index}`}
                  style={[
                    styles.slotChip,
                    slot.availability === "high"
                      ? styles.slotChipHigh
                      : slot.availability === "limited"
                        ? styles.slotChipLimited
                        : styles.slotChipClosed,
                  ]}
                >
                  <Text
                    style={[
                      styles.slotChipText,
                      slot.availability === "limited" ? styles.slotChipTextDark : undefined,
                    ]}
                  >
                    {slot.label} · {slotLabels[slot.availability]}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No hay franjas publicadas para este dia.</Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 20,
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
  },
  dayCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 10,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  dayTitle: {
    color: palette.cocoa,
    fontSize: 20,
    fontWeight: "800",
  },
  daySubtitle: {
    color: palette.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeOpen: {
    backgroundColor: palette.moss,
  },
  statusBadgeClosed: {
    backgroundColor: palette.cocoa,
  },
  statusBadgeText: {
    color: palette.card,
    fontWeight: "800",
  },
  statusBadgeTextDark: {
    color: palette.cocoa,
  },
  windowText: {
    color: palette.cocoa,
    fontWeight: "700",
  },
  note: {
    color: palette.textMuted,
    lineHeight: 20,
  },
  slotWrap: {
    gap: 8,
  },
  slotChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  slotChipHigh: {
    backgroundColor: palette.moss,
  },
  slotChipLimited: {
    backgroundColor: palette.gold,
  },
  slotChipClosed: {
    backgroundColor: palette.cocoa,
  },
  slotChipText: {
    color: palette.card,
    fontWeight: "700",
  },
  slotChipTextDark: {
    color: palette.cocoa,
  },
  emptyText: {
    color: palette.textMuted,
  },
});