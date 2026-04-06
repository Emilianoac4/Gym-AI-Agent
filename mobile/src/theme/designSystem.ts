import { Platform } from "react-native";

export const designSystem = {
  colors: {
    primary: "#22C55E",
    actionPrimary: "#3B82F6",
    success: "#22C55E",
    accent: "#F97316",
    backgroundDeep: "#0B1220",
    background: "#0F172A",
    surface: "#111827",
    surfaceElevated: "#1F2937",
    textPrimary: "#F9FAFB",
    textSecondary: "#9CA3AF",
    borderSubtle: "#1F2937",
    shadow: "#020617",
    overlay: "rgba(15, 23, 42, 0.72)",
    danger: "#EF4444",
  },
  spacing: {
    x0_5: 4,
    x1: 8,
    x2: 16,
    x3: 24,
    x4: 32,
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 24,
    pill: 999,
  },
  typography: {
    fontFamily: Platform.select({
      ios: "SF Pro Text",
      android: "Inter",
      default: undefined,
    }),
    titleXL: 30,
    titleLG: 24,
    titleMD: 20,
    bodyLG: 16,
    bodyMD: 14,
    bodySM: 12,
  },
  shadows: {
    card: {
      shadowColor: "#020617",
      shadowOpacity: 0.22,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: 24,
      elevation: 8,
    },
    soft: {
      shadowColor: "#020617",
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 16,
      elevation: 5,
    },
  },
} as const;

export type AppCardVariant = "hero" | "default" | "flat";
export type AppButtonVariant = "primary" | "secondary";
