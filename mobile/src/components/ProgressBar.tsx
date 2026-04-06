import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { designSystem as ds } from "../theme/designSystem";

type Props = {
  progress: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({ progress, style }: Props) {
  const clamped = Math.max(0, Math.min(progress, 1));

  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 10,
    backgroundColor: ds.colors.surfaceElevated,
    borderRadius: ds.radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: ds.radius.pill,
    backgroundColor: ds.colors.success,
  },
});
