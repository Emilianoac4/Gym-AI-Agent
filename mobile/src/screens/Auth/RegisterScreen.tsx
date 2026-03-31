import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { palette } from "../../theme/palette";

export function RegisterScreen() {
  const { registerAdmin, loading } = useAuth();

  const [gymName, setGymName] = useState("GymAI Central");
  const [ownerName, setOwnerName] = useState("Owner Name");
  const [fullName, setFullName] = useState("Admin Name");
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Primer setup del gimnasio</Text>
        <Text style={styles.subtitle}>Crea el usuario administrador inicial para tu app.</Text>

        <TextInput style={styles.input} placeholder="Nombre del gimnasio" value={gymName} onChangeText={setGymName} />
        <TextInput style={styles.input} placeholder="Nombre del propietario" value={ownerName} onChangeText={setOwnerName} />
        <TextInput style={styles.input} placeholder="Nombre completo admin" value={fullName} onChangeText={setFullName} />
        <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

        <AppButton label={loading ? "Creando..." : "Crear y entrar"} onPress={onRegister} disabled={loading} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: palette.snow,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 20,
  },
  title: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#556977",
    marginTop: 8,
    marginBottom: 18,
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
});
