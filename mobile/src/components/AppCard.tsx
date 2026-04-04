import React from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { AppCardVariant, designSystem } from "../theme/designSystem";

type Props = ViewProps & {
  children: React.ReactNode;
  variant?: AppCardVariant;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({ children, variant = "default", style, ...rest }: Props) {
  return (
    <View style={[styles.base, styles[variant], style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: designSystem.radius.lg,
    padding: designSystem.spacing.x3,
    backgroundColor: designSystem.colors.surface,
  },
  hero: {
    backgroundColor: designSystem.colors.surfaceElevated,
    ...designSystem.shadows.card,
  },
  default: {
    backgroundColor: designSystem.colors.surface,
    ...designSystem.shadows.soft,
  },
  flat: {
    backgroundColor: designSystem.colors.surface,
    padding: designSystem.spacing.x2,
  },
});
