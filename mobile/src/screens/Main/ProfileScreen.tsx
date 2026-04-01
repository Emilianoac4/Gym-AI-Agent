import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";

export function ProfileScreen() {
  const { user, token } = useAuth();
  const [goal, setGoal] = useState("");
  const [availability, setAvailability] = useState("");
  const [experienceLvl, setExperienceLvl] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user || !token) {
        return;
      }
      try {
        const data = await api.getProfile(user.id, token);
        setGoal(data.profile?.goal ?? "");
        setAvailability(data.profile?.availability ?? "");
        setExperienceLvl(data.profile?.experienceLvl ?? "");
      } catch {
        // Keep defaults when profile does not exist yet.
      }
    };

    void load();
  }, [token, user]);

  const onSave = async () => {
    if (!user || !token) {
      return;
    }
    try {
      await api.updateProfile(user.id, token, {
        goal,
        availability,
        experienceLvl,
      });
      Alert.alert("Perfil actualizado", "Tus preferencias se guardaron correctamente.");
    } catch (error) {
      Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Perfil base</Text>
        <Text style={styles.title}>Perfil Deportivo</Text>
        <Text style={styles.subtitle}>Estos datos alimentan la IA para rutinas y nutricion personalizadas.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Objetivo</Text>
        <TextInput style={styles.input} value={goal} onChangeText={setGoal} placeholder="Ganar masa muscular" placeholderTextColor={palette.textSoft} />

        <Text style={styles.label}>Disponibilidad</Text>
        <TextInput style={styles.input} value={availability} onChangeText={setAvailability} placeholder="4 dias por semana" placeholderTextColor={palette.textSoft} />

        <Text style={styles.label}>Nivel</Text>
        <TextInput style={styles.input} value={experienceLvl} onChangeText={setExperienceLvl} placeholder="Intermedio" placeholderTextColor={palette.textSoft} />

        <AppButton label="Guardar perfil" onPress={onSave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: palette.background,
    padding: 20,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 16,
  },
  eyebrow: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.ink,
    marginTop: 8,
  },
  subtitle: {
    marginTop: 8,
    color: palette.textMuted,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  label: {
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    backgroundColor: palette.cream,
    color: palette.ink,
  },
});
