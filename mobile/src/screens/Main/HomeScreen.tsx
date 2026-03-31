import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { palette } from "../../theme/palette";

export function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <LinearGradient colors={["#0F4C81", "#2A78C8"]} style={styles.container}>
      <Text style={styles.welcome}>Hola, {user?.fullName ?? "Atleta"}</Text>
      <Text style={styles.hero}>Tu panel inteligente de entrenamiento</Text>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Estado</Text>
          <Text style={styles.kpiValue}>Activo</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Rol</Text>
          <Text style={styles.kpiValue}>{user?.role ?? "member"}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton label="Cerrar sesion" onPress={logout} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  welcome: {
    color: "#D8EBFF",
    fontWeight: "700",
    fontSize: 16,
  },
  hero: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    marginTop: 8,
    fontWeight: "800",
    maxWidth: 300,
  },
  kpiRow: {
    flexDirection: "row",
    marginTop: 26,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 16,
    padding: 14,
  },
  kpiLabel: {
    color: "#E2F2FF",
    fontSize: 12,
  },
  kpiValue: {
    color: "#FFFFFF",
    marginTop: 6,
    fontWeight: "800",
    fontSize: 18,
  },
  actions: {
    marginTop: 24,
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 14,
  },
});
