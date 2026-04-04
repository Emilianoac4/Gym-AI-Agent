import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { palette } from "../../theme/palette";

export function ChangeTemporaryPasswordScreen() {
  const { completeTemporaryPasswordChange, loading } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const onConfirm = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Campos incompletos", "Completa ambos campos de contraseña.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Contraseña inválida", "La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("No coincide", "La confirmación de contraseña no coincide con la nueva contraseña.");
      return;
    }

    try {
      await completeTemporaryPasswordChange(newPassword);
      Alert.alert("Contraseña actualizada", "Tu nueva contraseña se guardó correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la contraseña";
      Alert.alert("Error", message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Actualiza tu contraseña</Text>
        <Text style={styles.subtitle}>
          Este usuario fue creado con una contraseña temporal. Debes crear una contraseña permanente para
          continuar.
        </Text>

        <Text style={styles.label}>Nueva contraseña</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={palette.textMuted}
          />
          <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowNewPassword((v) => !v)}>
            <MaterialCommunityIcons
              name={showNewPassword ? "eye-off" : "eye"}
              size={20}
              color={palette.moss}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirmar contraseña</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            placeholder="Repite la contraseña"
            placeholderTextColor={palette.textMuted}
          />
          <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowConfirmPassword((v) => !v)}>
            <MaterialCommunityIcons
              name={showConfirmPassword ? "eye-off" : "eye"}
              size={20}
              color={palette.moss}
            />
          </TouchableOpacity>
        </View>

        <AppButton
          label={loading ? "Guardando..." : "Guardar contraseña"}
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
  passwordRow: {
    position: "relative",
    marginBottom: 12,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 84,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 11,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
