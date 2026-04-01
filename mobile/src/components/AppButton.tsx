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
    backgroundColor: palette.cocoa,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.gold,
    shadowColor: palette.cocoa,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 4,
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
    color: palette.gold,
    fontSize: 16,
    fontWeight: "700",
  },
});
