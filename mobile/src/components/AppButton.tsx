import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { palette } from "../theme/palette";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function AppButton({ label, onPress, disabled }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.ocean,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: palette.snow,
    fontSize: 16,
    fontWeight: "700",
  },
});
