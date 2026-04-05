import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { designSystem as ds } from "../theme/designSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ListCardStatus = "default" | "active" | "completed";

export interface ListCardMetaChip {
  label: string;
  /** Optional override for the chip background tint */
  color?: string;
}

export interface ListCardAction {
  label: string;
  onPress: () => void;
}

export interface ListCardMenuOption {
  label: string;
  onPress: () => void;
  /** Renders the option in danger/red */
  destructive?: boolean;
}

export interface ListCardProps {
  title: string;
  metadata?: ListCardMetaChip[];
  description?: string;
  primaryAction: ListCardAction;
  secondaryAction?: ListCardAction;
  menuOptions?: ListCardMenuOption[];
  status?: ListCardStatus;
  style?: StyleProp<ViewStyle>;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ListCardStatus,
  { accentColor: string; badge: string | null; dimmed: boolean }
> = {
  default: { accentColor: "transparent", badge: null, dimmed: false },
  active:  { accentColor: ds.colors.primary, badge: "Activo",     dimmed: false },
  completed: { accentColor: "#6B7280",       badge: "Completado", dimmed: true  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ListCard({
  title,
  metadata = [],
  description,
  primaryAction,
  secondaryAction,
  menuOptions = [],
  status = "default",
  style,
}: ListCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const { accentColor, badge, dimmed } = STATUS_CONFIG[status];
  const hasAccentBorder = accentColor !== "transparent";

  return (
    <View
      style={[
        styles.card,
        hasAccentBorder && { borderLeftColor: accentColor, borderLeftWidth: 3 },
        dimmed && styles.cardDimmed,
        style,
      ]}
    >
      {/* ── Header row ──────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, dimmed && styles.titleDimmed]} numberOfLines={2}>
            {title}
          </Text>
          {badge && (
            <View style={[styles.statusBadge, { backgroundColor: accentColor + "22" }]}>
              <Text style={[styles.statusBadgeText, { color: accentColor }]}>{badge}</Text>
            </View>
          )}
        </View>

        {menuOptions.length > 0 && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.menuDots}>···</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Metadata chips ──────────────────────────────── */}
      {metadata.length > 0 && (
        <View style={styles.metaRow}>
          {metadata.map((chip, i) => (
            <View
              key={i}
              style={[
                styles.chip,
                chip.color ? { backgroundColor: chip.color + "22", borderColor: chip.color + "44" } : null,
              ]}
            >
              <Text
                style={[styles.chipText, chip.color ? { color: chip.color } : null]}
              >
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Description ─────────────────────────────────── */}
      {!!description && (
        <Text style={styles.description} numberOfLines={3}>
          {description}
        </Text>
      )}

      {/* ── Actions ─────────────────────────────────────── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.primaryBtn, dimmed && styles.primaryBtnDimmed]}
          onPress={primaryAction.onPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryBtnText, dimmed && styles.primaryBtnTextDimmed]}>
            {primaryAction.label}
          </Text>
        </TouchableOpacity>

        {secondaryAction && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={secondaryAction.onPress}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>{secondaryAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Context menu modal ──────────────────────────── */}
      {menuOptions.length > 0 && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
          statusBarTranslucent
        >
          <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              {menuOptions.map((opt, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={styles.sheetDivider} />}
                  <TouchableOpacity
                    style={styles.sheetOption}
                    onPress={() => {
                      setMenuVisible(false);
                      opt.onPress();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sheetOptionText,
                        opt.destructive && styles.sheetOptionDestructive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
              <View style={styles.sheetDivider} />
              <TouchableOpacity
                style={styles.sheetOption}
                onPress={() => setMenuVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.sheetCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: ds.colors.surfaceElevated,
    borderRadius: ds.radius.md,
    padding: ds.spacing.x2,
    gap: ds.spacing.x1,
    ...ds.shadows.soft,
  },
  cardDimmed: {
    opacity: 0.65,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: ds.typography.bodyLG,
    fontWeight: "700",
    color: ds.colors.textPrimary,
    letterSpacing: 0.1,
  },
  titleDimmed: {
    color: ds.colors.textSecondary,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ds.radius.pill,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // 3-dot menu button
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ds.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -2,
  },
  menuDots: {
    fontSize: 18,
    fontWeight: "700",
    color: ds.colors.textSecondary,
    letterSpacing: 2,
    lineHeight: 20,
  },

  // Metadata chips
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: ds.radius.pill,
    borderWidth: 1,
    borderColor: ds.colors.borderSubtle,
    backgroundColor: ds.colors.surface,
  },
  chipText: {
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    color: ds.colors.textSecondary,
  },

  // Description
  description: {
    fontSize: ds.typography.bodyMD,
    color: ds.colors.textSecondary,
    lineHeight: 20,
  },

  // Actions
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: ds.colors.primary,
    borderRadius: ds.radius.sm,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryBtnDimmed: {
    backgroundColor: ds.colors.borderSubtle,
  },
  primaryBtnText: {
    fontSize: ds.typography.bodyMD,
    fontWeight: "700",
    color: ds.colors.background,
  },
  primaryBtnTextDimmed: {
    color: ds.colors.textSecondary,
  },
  secondaryBtn: {
    paddingHorizontal: 4,
    paddingVertical: 11,
  },
  secondaryBtnText: {
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    color: ds.colors.textSecondary,
  },

  // Modal sheet
  overlay: {
    flex: 1,
    backgroundColor: ds.colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: ds.colors.surfaceElevated,
    borderTopLeftRadius: ds.radius.lg,
    borderTopRightRadius: ds.radius.lg,
    paddingHorizontal: ds.spacing.x2,
    paddingBottom: 32,
    paddingTop: 12,
    ...ds.shadows.card,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: ds.colors.borderSubtle,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: ds.colors.borderSubtle,
  },
  sheetOption: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  sheetOptionText: {
    fontSize: ds.typography.bodyLG,
    fontWeight: "500",
    color: ds.colors.textPrimary,
  },
  sheetOptionDestructive: {
    color: ds.colors.danger,
    fontWeight: "600",
  },
  sheetCancelText: {
    fontSize: ds.typography.bodyLG,
    fontWeight: "700",
    color: ds.colors.textSecondary,
    textAlign: "center",
  },
});
