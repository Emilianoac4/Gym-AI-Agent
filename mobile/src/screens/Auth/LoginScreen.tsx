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
    <LinearGradient colors={["#EAF4FF", "#F4F7F9"]} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>GymAI</Text>
        <Text style={styles.title}>Entrena con inteligencia</Text>
        <Text style={styles.subtitle}>Tu progreso, mediciones y coach IA en una sola app.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
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
    borderRadius: 24,
    padding: 22,
    shadowColor: "#163247",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  eyebrow: {
    color: palette.sky,
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
    color: "#4E606D",
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CFD9DF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: "#FAFCFD",
  },
  link: {
    color: palette.ocean,
    textAlign: "center",
    marginTop: 14,
    fontWeight: "600",
  },
});
