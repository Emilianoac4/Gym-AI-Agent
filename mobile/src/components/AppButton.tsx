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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.moss,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: palette.ink,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
