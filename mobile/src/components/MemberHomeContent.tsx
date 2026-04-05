import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

type ActiveTrainer = { id: string; fullName: string; avatarUrl: string | null };

type Props = {
  userName: string;
  heroTitle: string;
  heroMeta: string;
  progressLabel: string;
  progressValue: number;
  insight: string;
  onStartWorkout: () => void;
  secondaryActions: SecondaryAction[];
  activeTrainers?: ActiveTrainer[];
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
  activeTrainers = [],
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

      {activeTrainers.length > 0 && (
        <AppCard variant="default">
          <Text style={styles.sectionEyebrow}>Entrenadores disponibles</Text>
          <Text style={styles.sectionTitle}>En el gimnasio ahora</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.trainersScroll}
            contentContainerStyle={styles.trainersRow}
          >
            {activeTrainers.map((trainer) => {
              const initials = trainer.fullName
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("");
              return (
                <View key={trainer.id} style={styles.trainerChip}>
                  <View style={styles.trainerAvatar}>
                    <Text style={styles.trainerAvatarText}>{initials}</Text>
                  </View>
                  <Text style={styles.trainerName} numberOfLines={1}>{trainer.fullName.split(" ")[0]}</Text>
                </View>
              );
            })}
          </ScrollView>
        </AppCard>
      )}

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
  trainersScroll: {
    marginTop: designSystem.spacing.x2,
  },
  trainersRow: {
    gap: designSystem.spacing.x2,
    paddingBottom: 4,
  },
  trainerChip: {
    alignItems: "center",
    gap: designSystem.spacing.x1,
    minWidth: 60,
  },
  trainerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: designSystem.colors.surfaceElevated,
    borderWidth: 2,
    borderColor: designSystem.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  trainerAvatarText: {
    color: designSystem.colors.primary,
    fontWeight: "700",
    fontSize: 15,
    fontFamily: designSystem.typography.fontFamily,
  },
  trainerName: {
    color: designSystem.colors.textPrimary,
    fontSize: designSystem.typography.bodySM,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
    textAlign: "center",
    maxWidth: 64,
  },
});
