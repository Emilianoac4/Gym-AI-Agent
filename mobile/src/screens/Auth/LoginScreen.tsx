import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { AppButton } from "../../components/AppButton";
import { palette } from "../../theme/palette";

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login, loading } = useAuth();

  const [email, setEmail] = useState("admin@gymiai.com");
  const [password, setPassword] = useState("Admin123456");

  const onLogin = async () => {
    try {
      await login(email.trim(), password);
    } catch (error) {
      Alert.alert("No fue posible ingresar", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  return (
    <LinearGradient colors={palette.gradientHero} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>GymAI</Text>
        <Text style={styles.title}>Entrena con inteligencia</Text>
        <Text style={styles.subtitle}>Tu progreso, mediciones y coach IA en una sola app.</Text>

        <View style={styles.highlightStrip}>
          <View style={styles.highlightPill}>
            <Text style={styles.highlightText}>Rutinas IA</Text>
          </View>
          <View style={styles.highlightPillAlt}>
            <Text style={styles.highlightTextAlt}>Seguimiento real</Text>
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={palette.textSoft}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={palette.textSoft}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <AppButton label={loading ? "Ingresando..." : "Iniciar Sesion"} onPress={onLogin} disabled={loading} />

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Crear cuenta inicial de gimnasio</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.cocoa,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  eyebrow: {
    color: palette.coral,
    fontWeight: "700",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    color: palette.ink,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: palette.textMuted,
    lineHeight: 20,
  },
  highlightStrip: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  highlightPill: {
    backgroundColor: palette.moss,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightPillAlt: {
    backgroundColor: palette.cocoa,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightText: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 12,
  },
  highlightTextAlt: {
    color: palette.gold,
    fontWeight: "700",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: palette.cream,
    color: palette.ink,
  },
  link: {
    color: palette.cocoa,
    textAlign: "center",
    marginTop: 14,
    fontWeight: "600",
  },
});
