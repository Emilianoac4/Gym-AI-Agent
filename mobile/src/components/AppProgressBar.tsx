import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { designSystem } from "../theme/designSystem";

type Props = {
  progress: number;
  style?: StyleProp<ViewStyle>;
};

export function AppProgressBar({ progress, style }: Props) {
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${clampedProgress * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 10,
    backgroundColor: designSystem.colors.surfaceElevated,
    borderRadius: designSystem.radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: designSystem.radius.pill,
    backgroundColor: designSystem.colors.primary,
  },
});
