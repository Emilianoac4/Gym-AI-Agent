import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { AppButtonVariant, designSystem } from "../theme/designSystem";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: AppButtonVariant;
  fullWidth?: boolean;
};

export function AppButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  fullWidth = true,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        variant === "primary" ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? designSystem.colors.background : designSystem.colors.textPrimary}
        />
      ) : (
        <Text style={[styles.text, variant === "primary" ? styles.primaryText : styles.secondaryText]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: designSystem.spacing.x3,
    paddingVertical: designSystem.spacing.x2,
    borderRadius: designSystem.radius.md,
    alignItems: "center",
    justifyContent: "center",
    ...designSystem.shadows.soft,
  },
  fullWidth: {
    width: "100%",
  },
  primary: {
    backgroundColor: designSystem.colors.primary,
  },
  secondary: {
    backgroundColor: designSystem.colors.surfaceElevated,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontSize: designSystem.typography.bodyLG,
    fontWeight: "600",
    fontFamily: designSystem.typography.fontFamily,
  },
  primaryText: {
    color: designSystem.colors.background,
  },
  secondaryText: {
    color: designSystem.colors.textPrimary,
  },
});
