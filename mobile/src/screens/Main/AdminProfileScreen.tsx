import React from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { palette } from "../../theme/palette";

export function AdminProfileScreen() {
  const { user, logout } = useAuth();

  const onLogout = () => {
    Alert.alert("Cerrar sesión", "¿Deseas cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: logout },
    ]);
  };

  return (
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuración</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Perfil</Text>
            <Text style={styles.infoValue}>Administrador del gimnasio</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Acceso</Text>
            <Text style={styles.infoValue}>Total</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
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
  sectionTitle: { fontSize: 16, fontWeight: "700", color: palette.cocoa, marginBottom: 12 },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: palette.cocoa,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.sand,
  },
  infoLabel: { fontSize: 14, color: palette.cocoa + "80", fontWeight: "500" },
  infoValue: { fontSize: 14, color: palette.cocoa, fontWeight: "600" },
  logoutBtn: {
    backgroundColor: palette.coral,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  logoutBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
