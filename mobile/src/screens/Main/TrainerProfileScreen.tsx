import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
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
import { TrainerPresenceStatus } from "../../types/api";
import { palette } from "../../theme/palette";

const formatHour = (value: string) =>
  new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function TrainerProfileScreen() {
  const { user, token, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<TrainerPresenceStatus | null>(null);

  const loadStatus = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.getMyTrainerPresenceStatus(token);
      setStatus(response.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar el estado operativo";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadStatus();
    }, [loadStatus]),
  );

  const onToggleStatus = async () => {
    if (!token || !status) {
      return;
    }

    setSaving(true);
    try {
      const response = await api.updateMyTrainerPresenceStatus(token, { isActive: !status.isActive });
      setStatus(response.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar el estado operativo";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    Alert.alert("Cerrar sesion", "Deseas cerrar sesion?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesion", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user?.fullName?.charAt(0).toUpperCase() ?? "E"}</Text>
        </View>
        <Text style={styles.name}>{user?.fullName ?? "Entrenador"}</Text>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Entrenador</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado operativo</Text>
        <View style={styles.statusCard}>
          {loading ? (
            <ActivityIndicator color={palette.cocoa} />
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status?.isActive ? styles.statusButtonActive : styles.statusButtonInactive,
                  saving && styles.statusButtonDisabled,
                ]}
                onPress={() => void onToggleStatus()}
                disabled={saving}
              >
                <View style={styles.statusButtonInner}>
                  <Text style={styles.statusButtonText}>
                    {saving ? "..." : status?.isActive ? "Activo" : "Fuera"}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.statusHeadline}>
                {status?.isActive ? "Actualmente trabajando" : "Actualmente fuera de turno"}
              </Text>
              <Text style={styles.statusHelp}>
                {status?.activeSession
                  ? `Entrada registrada a las ${formatHour(status.activeSession.startedAt)}`
                  : "Activa el boton al iniciar tu jornada y desactivalo al terminar."}
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sesiones de hoy</Text>
        <View style={styles.infoCard}>
          {status?.sessionsToday?.length ? (
            status.sessionsToday.map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <View>
                  <Text style={styles.sessionTitle}>
                    {formatHour(session.startedAt)} - {session.endedAt ? formatHour(session.endedAt) : "En curso"}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {session.isActive ? "Sesion activa" : `${session.durationMinutes} min trabajados`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.sessionBadge,
                    session.isActive ? styles.sessionBadgeActive : styles.sessionBadgeClosed,
                  ]}
                >
                  <Text style={styles.sessionBadgeText}>{session.isActive ? "Activo" : "Cerrado"}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Aun no registras entradas o salidas hoy.</Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutBtnText}>Cerrar sesion</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: palette.cream, padding: 20, paddingTop: 60 },
  heroCard: {
    backgroundColor: palette.moss,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 24,
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
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: palette.cocoa, marginBottom: 12 },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.sand,
  },
  statusButton: {
    width: 132,
    height: 132,
    borderRadius: 66,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  statusButtonActive: { backgroundColor: "#2f9e44" },
  statusButtonInactive: { backgroundColor: palette.coral },
  statusButtonDisabled: { opacity: 0.7 },
  statusButtonInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  statusButtonText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  statusHeadline: { color: palette.cocoa, fontSize: 18, fontWeight: "800" },
  statusHelp: { color: palette.cocoa + "88", textAlign: "center", marginTop: 8, lineHeight: 20 },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: palette.sand,
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.sand,
    gap: 12,
  },
  sessionTitle: { color: palette.cocoa, fontWeight: "700" },
  sessionMeta: { color: palette.cocoa + "88", marginTop: 4 },
  sessionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sessionBadgeActive: { backgroundColor: "#2f9e44" },
  sessionBadgeClosed: { backgroundColor: palette.sand },
  sessionBadgeText: { color: "#fff", fontWeight: "700" },
  emptyText: { color: palette.cocoa + "88", lineHeight: 20, paddingVertical: 12 },
  logoutBtn: {
    backgroundColor: palette.coral,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  logoutBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
