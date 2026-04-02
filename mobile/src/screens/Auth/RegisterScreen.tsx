import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { palette } from "../../theme/palette";

export function RegisterScreen() {
  const { registerAdmin, loading } = useAuth();

  const [gymName, setGymName] = useState("GymAI Central");
  const [ownerName, setOwnerName] = useState("Nombre del propietario");
  const [fullName, setFullName] = useState("Administrador principal");
  const [email, setEmail] = useState("admin@gymiai.com");
  const [password, setPassword] = useState("Admin123456");

  const onRegister = async () => {
    try {
      await registerAdmin({ gymName, ownerName, fullName, email, password });
    } catch (error) {
      Alert.alert("No fue posible registrar", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  return (
    <LinearGradient colors={palette.gradientHero} style={styles.shell}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Setup inicial</Text>
            <Text style={styles.title}>Primer setup del gimnasio</Text>
            <Text style={styles.subtitle}>Crea el usuario administrador inicial para tu app.</Text>

            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>Listo para probar la nueva identidad</Text>
              <Text style={styles.bannerText}>Esta configuracion deja activa la experiencia visual base para Expo.</Text>
            </View>

            <TextInput style={styles.input} placeholder="Nombre del gimnasio" placeholderTextColor={palette.textSoft} value={gymName} onChangeText={setGymName} />
            <TextInput style={styles.input} placeholder="Nombre del propietario" placeholderTextColor={palette.textSoft} value={ownerName} onChangeText={setOwnerName} />
            <TextInput style={styles.input} placeholder="Nombre completo admin" placeholderTextColor={palette.textSoft} value={fullName} onChangeText={setFullName} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={palette.textSoft} autoCapitalize="none" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Contrasena" placeholderTextColor={palette.textSoft} secureTextEntry value={password} onChangeText={setPassword} />

            <AppButton label={loading ? "Creando..." : "Crear y entrar"} onPress={onRegister} disabled={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 22,
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
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.textMuted,
    marginTop: 8,
    marginBottom: 18,
  },
  banner: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  bannerTitle: {
    color: palette.cocoa,
    fontSize: 15,
    fontWeight: "800",
  },
  bannerText: {
    color: palette.textMuted,
    marginTop: 6,
    lineHeight: 20,
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
});
