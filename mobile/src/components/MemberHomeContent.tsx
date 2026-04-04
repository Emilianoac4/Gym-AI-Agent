import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppButton } from "./AppButton";
import { AppCard } from "./AppCard";
import { AppProgressBar } from "./AppProgressBar";
import { AppScreen } from "./AppScreen";
import { designSystem } from "../theme/designSystem";

type SecondaryAction = {
  key: string;
  label: string;
  description: string;
  onPress: () => void;
};

type Props = {
  userName: string;
  heroTitle: string;
  heroMeta: string;
  progressLabel: string;
  progressValue: number;
  insight: string;
  onStartWorkout: () => void;
  secondaryActions: SecondaryAction[];
};

export function MemberHomeContent({
  userName,
  heroTitle,
  heroMeta,
  progressLabel,
  progressValue,
  insight,
  onStartWorkout,
  secondaryActions,
}: Props) {
  return (
    <AppScreen scrollable contentStyle={styles.content}>
      <AppCard variant="hero" style={styles.heroCard}>
        <Text style={styles.eyebrow}>Hola, {userName}</Text>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.heroMeta}>{heroMeta}</Text>
        <AppButton label="Iniciar entrenamiento" onPress={onStartWorkout} />
      </AppCard>

      <AppCard variant="default">
        <Text style={styles.sectionEyebrow}>Progreso semanal</Text>
        <Text style={styles.sectionTitle}>{progressLabel}</Text>
        <AppProgressBar progress={progressValue} style={styles.progressBar} />
      </AppCard>

      <AppCard variant="default">
        <Text style={styles.sectionEyebrow}>Insight de Tuco</Text>
        <Text style={styles.insightText}>{insight}</Text>
      </AppCard>

      <AppCard variant="flat">
        <Text style={styles.sectionEyebrow}>Siguientes pasos</Text>
        <View style={styles.secondaryList}>
          {secondaryActions.map((action) => (
            <Pressable key={action.key} style={styles.secondaryAction} onPress={action.onPress}>
              <Text style={styles.secondaryActionLabel}>{action.label}</Text>
              <Text style={styles.secondaryActionDescription}>{action.description}</Text>
            </Pressable>
          ))}
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: designSystem.spacing.x2,
  },
  heroCard: {
    gap: designSystem.spacing.x2,
  },
  eyebrow: {
    color: designSystem.colors.textSecondary,
    fontSize: designSystem.typography.bodySM,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  heroTitle: {
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.titleXL,
    lineHeight: 36,
    fontWeight: "700",
    fontFamily: designSystem.typography.fontFamily,
  },
  heroMeta: {
    color: designSystem.colors.textSecondary,
    fontSize: designSystem.typography.bodyMD,
    lineHeight: 21,
    fontWeight: "500",
    fontFamily: designSystem.typography.fontFamily,
  },
  sectionEyebrow: {
    color: designSystem.colors.textSecondary,
    fontSize: designSystem.typography.bodySM,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  sectionTitle: {
    marginTop: designSystem.spacing.x1,
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.titleMD,
    lineHeight: 28,
    fontWeight: "700",
    fontFamily: designSystem.typography.fontFamily,
  },
  progressBar: {
    marginTop: designSystem.spacing.x2,
  },
  insightText: {
    marginTop: designSystem.spacing.x1,
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.bodyLG,
    lineHeight: 24,
    fontWeight: "500",
    fontFamily: designSystem.typography.fontFamily,
  },
  secondaryList: {
    marginTop: designSystem.spacing.x2,
    gap: designSystem.spacing.x1,
  },
  secondaryAction: {
    backgroundColor: designSystem.colors.surfaceElevated,
    borderRadius: designSystem.radius.md,
    paddingHorizontal: designSystem.spacing.x2,
    paddingVertical: designSystem.spacing.x2,
  },
  secondaryActionLabel: {
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.bodyLG,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  secondaryActionDescription: {
    marginTop: designSystem.spacing.x0_5,
    color: designSystem.colors.textSecondary,
    fontSize: designSystem.typography.bodyMD,
    lineHeight: 20,
    fontWeight: "500",
    fontFamily: designSystem.typography.fontFamily,
  },
});
