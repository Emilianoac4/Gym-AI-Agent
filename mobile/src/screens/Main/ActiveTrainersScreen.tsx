import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";

type ActiveTrainer = {
  trainerId: string;
  trainerName: string;
};

export function ActiveTrainersScreen() {
  const { token } = useAuth();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [activeTrainers, setActiveTrainers] = useState<ActiveTrainer[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        return;
      }

      let cancelled = false;
      setLoading(true);
      api
        .getTrainerPresenceSummary(token, 1)
        .then((res) => {
          if (cancelled) return;
          const day = res.days[0];
          const current = day
            ? day.trainers
                .filter((trainer) => trainer.sessions.some((session) => session.isActive))
                .map((trainer) => ({
                  trainerId: trainer.trainerId,
                  trainerName: trainer.trainerName,
                }))
            : [];
          setActiveTrainers(current);
        })
        .catch(() => {
          if (!cancelled) setActiveTrainers([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [token]),
  );

  const activeCount = useMemo(() => activeTrainers.length, [activeTrainers.length]);

  return (
    <ScrollView style={styles.shell} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Panel operativo</Text>
        <Text style={styles.heroTitle}>Entrenadores activos</Text>
        <Text style={styles.heroCount}>{activeCount}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Activos ahora</Text>
        {loading ? (
          <ActivityIndicator color={palette.cocoa} style={{ marginTop: 16 }} />
        ) : activeTrainers.length === 0 ? (
          <Text style={styles.emptyText}>No hay entrenadores activos en este momento.</Text>
        ) : (
          activeTrainers.map((trainer) => (
            <View key={trainer.trainerId} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.rowText}>{trainer.trainerName}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Accesos rápidos</Text>
        <View style={styles.quickGrid}>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate("Perfil")}>
            <Text style={styles.quickBtnText}>Reporte operativo</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate("Mensajes")}>
            <Text style={styles.quickBtnText}>Mensajes</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => navigation.navigate("Operacion")}>
            <Text style={styles.quickBtnText}>Operación</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: palette.background },
  content: { padding: 18, paddingTop: 46, paddingBottom: 30 },
  hero: {
    backgroundColor: palette.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 18,
    marginBottom: 14,
  },
  heroEyebrow: { color: palette.coral, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  heroTitle: { color: palette.cocoa, fontSize: 22, fontWeight: "800", marginTop: 6 },
  heroCount: { color: palette.moss, fontSize: 42, fontWeight: "900", marginTop: 8 },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: palette.cocoa, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  emptyText: { color: palette.textMuted, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.line },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.moss, marginRight: 8 },
  rowText: { color: palette.ink, fontWeight: "700" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickBtn: {
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickBtnText: { color: palette.cocoa, fontWeight: "700" },
});
