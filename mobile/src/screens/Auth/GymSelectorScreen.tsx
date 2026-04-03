import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { palette } from "../../theme/palette";

export function GymSelectorScreen() {
  const { pendingGymSelection, selectGym, loading } = useAuth();

  const gyms = useMemo(() => pendingGymSelection?.gyms ?? [], [pendingGymSelection]);

  if (!pendingGymSelection) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyCard}>
          <Text style={styles.title}>Sin seleccion pendiente</Text>
          <Text style={styles.subtitle}>Inicia sesion nuevamente para elegir un gimnasio.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Cuenta detectada en multiples gimnasios</Text>
        <Text style={styles.title}>Selecciona tu perfil</Text>
        <Text style={styles.subtitle}>Elige a que gimnasio deseas ingresar en esta sesion.</Text>
      </View>

      <FlatList
        data={gyms}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            disabled={loading}
            onPress={() => selectGym(item.userId)}
          >
            <Text style={styles.gymName}>{item.gymName}</Text>
            <Text style={styles.detail}>Rol: {item.role}</Text>
            <Text style={styles.detail}>Usuario: {item.username ?? "(sin username)"}</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={loading ? <ActivityIndicator color={palette.cocoa} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 18,
  },
  header: {
    marginBottom: 16,
  },
  eyebrow: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 6,
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    color: palette.textMuted,
    lineHeight: 20,
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
  },
  gymName: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  detail: {
    marginTop: 6,
    color: palette.textMuted,
  },
  emptyCard: {
    marginTop: 32,
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
});
