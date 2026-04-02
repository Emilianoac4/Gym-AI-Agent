import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { palette } from "../../theme/palette";
import { UserRole } from "../../types/api";

type RoleOption = {
  role: UserRole;
  title: string;
  description: string;
};

const roleOptions: RoleOption[] = [
  {
    role: "admin",
    title: "Ingresar como administrador",
    description: "Gestiona la operacion del gimnasio, usuarios y metricas de negocio.",
  },
  {
    role: "trainer",
    title: "Ingresar como entrenador",
    description: "Atiende usuarios, gestiona renovaciones y soporte en piso.",
  },
  {
    role: "member",
    title: "Ingresar como usuario",
    description: "Accede a rutinas, progreso y acompanamiento con coach IA.",
  },
];

export function RoleSelectScreen() {
  const navigation = useNavigation<any>();

  const onSelectRole = (role: UserRole) => {
    navigation.navigate("Login", { role });
  };

  return (
    <LinearGradient colors={palette.gradientHero} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>GymAI</Text>
        <Text style={styles.title}>Selecciona tu tipo de acceso</Text>
        <Text style={styles.subtitle}>Elige como deseas ingresar a la aplicacion.</Text>

        <View style={styles.optionList}>
          {roleOptions.map((option) => (
            <TouchableOpacity
              key={option.role}
              style={styles.optionCard}
              onPress={() => onSelectRole(option.role)}
              activeOpacity={0.9}
            >
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    fontSize: 26,
    color: palette.ink,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
    color: palette.textMuted,
    lineHeight: 20,
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cream,
    padding: 14,
  },
  optionTitle: {
    color: palette.cocoa,
    fontSize: 15,
    fontWeight: "800",
  },
  optionDescription: {
    marginTop: 4,
    color: palette.textMuted,
    lineHeight: 18,
  },
});
