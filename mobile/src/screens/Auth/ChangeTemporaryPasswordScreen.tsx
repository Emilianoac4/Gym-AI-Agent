import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { palette } from "../../theme/palette";

export function ChangeTemporaryPasswordScreen() {
  const { completeTemporaryPasswordChange, loading } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const onConfirm = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Campos incompletos", "Completa ambos campos de contrasena.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Contrasena invalida", "La nueva contrasena debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("No coincide", "La confirmacion de contrasena no coincide con la nueva contrasena.");
      return;
    }

    try {
      await completeTemporaryPasswordChange(newPassword);
      Alert.alert("Contrasena actualizada", "Tu nueva contrasena se guardo correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la contrasena";
      Alert.alert("Error", message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Actualiza tu contrasena</Text>
        <Text style={styles.subtitle}>
          Este usuario fue creado con una contrasena temporal. Debes crear una contrasena permanente para
          continuar.
        </Text>

        <Text style={styles.label}>Nueva contrasena</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Minimo 8 caracteres"
          placeholderTextColor={palette.textMuted}
        />

        <Text style={styles.label}>Confirmar contrasena</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Repite la contrasena"
          placeholderTextColor={palette.textMuted}
        />

        <AppButton
          label={loading ? "Guardando..." : "Guardar contrasena"}
          onPress={onConfirm}
          disabled={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: palette.background,
  },
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    padding: 18,
  },
  title: {
    color: palette.cocoa,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    color: palette.textMuted,
    lineHeight: 20,
  },
  label: {
    color: palette.cocoa,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: palette.cream,
    color: palette.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
});
