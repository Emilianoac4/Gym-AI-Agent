import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { designSystem as ds } from "../theme/designSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExerciseCardStatus = "pending" | "in_progress" | "completed";

export interface ExerciseCardMenuOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  loading?: boolean;
}

/** Replacement suggestion shown below the card when the menu triggers "Elegir siguiente" */
export interface ExerciseReplacement {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  tips?: string;
}

export interface ExerciseLogValues {
  loadValue: string;
  loadUnit: "kg" | "lb";
  reps: string;
  sets: string;
}

export interface ExerciseCardProps {
  /** Exercise name */
  name: string;
  /** Prescribed sets (number) */
  sets: number;
  /** Prescribed reps (string, e.g. "8-10") */
  reps: string;
  /** Rest period in seconds */
  restSeconds: number;
  /** Short AI tip / coach note */
  tip?: string;
  /** Last registered performance shown as calm operational context */
  lastPerformance?: string;
  /** Card state */
  status?: ExerciseCardStatus;
  /** Whether the weight log form is open */
  logOpen?: boolean;
  /** Current values inside the log form */
  logValues?: ExerciseLogValues;
  /** Whether a log save is in progress */
  savingLog?: boolean;
  /** Key of the exercise that was last saved (used to show success msg) */
  lastSavedKey?: string | null;
  /** This exercise's unique key (to match lastSavedKey) */
  exerciseKey?: string;
  /** Called when user starts a set and opens the register form */
  onToggleLog?: () => void;
  /** Called when any log field changes */
  onLogChange?: (values: Partial<ExerciseLogValues>) => void;
  /** Allow editing today's log even when exercise is already completed */
  allowEditWhenCompleted?: boolean;
  /** Whether "View progress" is available */
  hasProgress?: boolean;
  /** Whether the progress panel is open */
  progressOpen?: boolean;
  /** Called to toggle the progress panel */
  onToggleProgress?: () => void;
  /** Content rendered inside the progress panel (passed as node) */
  progressContent?: React.ReactNode;
  /** Replacement options to show inside the card */
  replacements?: ExerciseReplacement[];
  /** Called when user picks a replacement option */
  onSelectReplacement?: (option: ExerciseReplacement) => void;
  /** Whether replacements are loading */
  replacementsLoading?: boolean;
  /** Context menu options (delete, replace, reorder, …) */
  menuOptions?: ExerciseCardMenuOption[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExerciseCard({
  name,
  sets,
  reps,
  restSeconds,
  tip,
  lastPerformance,
  status = "pending",
  logOpen = false,
  logValues,
  savingLog = false,
  lastSavedKey,
  exerciseKey,
  onToggleLog,
  onLogChange,
  allowEditWhenCompleted = false,
  hasProgress = false,
  progressOpen = false,
  onToggleProgress,
  progressContent,
  replacements,
  onSelectReplacement,
  replacementsLoading = false,
  menuOptions = [],
}: ExerciseCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);

  const isDone = status === "completed";
  const isActive = status === "in_progress";
  const statusLabel = isDone ? "Completado" : isActive ? "En curso" : "Pendiente";
  const statusTone = isDone ? styles.statusBadgeCompleted : isActive ? styles.statusBadgeActive : styles.statusBadgePending;
  const statusTextTone = isDone ? styles.statusBadgeTextCompleted : isActive ? styles.statusBadgeTextActive : styles.statusBadgeTextPending;

  const primaryLabel = isDone
    ? allowEditWhenCompleted
      ? "Editar marca"
      : "Completado"
    : logOpen
    ? "Registro activo"
    : "Iniciar serie";

  const justSaved =
    lastSavedKey != null && exerciseKey != null && lastSavedKey.startsWith(`${exerciseKey}::`);

  const primaryDisabled = logOpen || (isDone ? !allowEditWhenCompleted || !onToggleLog : !onToggleLog);

  return (
    <View
      style={[
        styles.card,
        isActive && styles.cardActive,
        isDone && styles.cardDone,
      ]}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={2}>
            {name}
          </Text>
          <View style={[styles.statusBadge, statusTone]}>
            <Text style={[styles.statusBadgeText, statusTextTone]}>{statusLabel}</Text>
          </View>
        </View>
        {menuOptions.length > 0 && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.menuDots}>···</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Metadata chips ─────────────────────────────── */}
      <Text style={styles.metaLine}>{`${sets} series · ${reps} reps · ${restSeconds}s`}</Text>

      {lastPerformance ? <Text style={styles.lastPerformance}>{lastPerformance}</Text> : null}

      {/* ── AI tip ─────────────────────────────────────── */}
      {!!tip && !isDone && (
        <Text style={styles.tip}>{tip}</Text>
      )}

      {/* ── Primary action ─────────────────────────────── */}
      <TouchableOpacity
        style={[
          styles.primaryBtn,
          isDone && styles.primaryBtnDone,
          primaryDisabled && !isDone && styles.primaryBtnDisabled,
        ]}
        onPress={onToggleLog}
        disabled={primaryDisabled}
        activeOpacity={0.8}
      >
        <Text style={[styles.primaryBtnText, isDone && styles.primaryBtnTextDone]}>
          {primaryLabel}
        </Text>
      </TouchableOpacity>

      {/* ── Secondary action ───────────────────────────── */}
      {!isDone && !logOpen && hasProgress && (
        <TouchableOpacity
          style={styles.progressToggle}
          onPress={onToggleProgress}
          activeOpacity={0.75}
        >
          <Text style={styles.progressToggleText}>{progressOpen ? "Ocultar progreso" : "Ver progreso"}</Text>
        </TouchableOpacity>
      )}

      {/* ── Progress panel ─────────────────────────────── */}
      {progressOpen && progressContent && (
        <View style={styles.progressPanel}>{progressContent}</View>
      )}

      {/* ── Replacement options panel ──────────────────── */}
      {replacementsLoading && (
        <View style={styles.replacementsPanel}>
          <ActivityIndicator color={ds.colors.actionPrimary} size="small" />
          <Text style={styles.replacementsLoading}>Buscando alternativas…</Text>
        </View>
      )}
      {!replacementsLoading && replacements && replacements.length > 0 && (
        <View style={styles.replacementsPanel}>
          <Text style={styles.replacementsPanelTitle}>Alternativas sugeridas</Text>
          {replacements.map((opt) => (
            <TouchableOpacity
              key={opt.name}
              style={styles.replacementRow}
              onPress={() => onSelectReplacement?.(opt)}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.replacementName}>{opt.name}</Text>
                <Text style={styles.replacementMeta}>
                  {opt.sets} series · {opt.reps} reps · {opt.rest_seconds}s
                </Text>
              </View>
              <Text style={styles.replacementArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Weight log form ────────────────────────────── */}
      {logOpen && logValues && onLogChange && (
        <View style={styles.logForm}>
          {/* Unit toggle */}
          <View style={styles.unitRow}>
            {(["kg", "lb"] as const).map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[styles.unitChip, logValues.loadUnit === unit && styles.unitChipActive]}
                onPress={() => onLogChange({ loadUnit: unit })}
              >
                <Text
                  style={[
                    styles.unitChipText,
                    logValues.loadUnit === unit && styles.unitChipTextActive,
                  ]}
                >
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Inputs */}
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputWide]}
              placeholder={logValues.loadUnit === "kg" ? "Carga (kg)" : "Carga (lb)"}
              placeholderTextColor={ds.colors.textSecondary}
              keyboardType="decimal-pad"
              value={logValues.loadValue}
              onChangeText={(v) => onLogChange({ loadValue: v })}
            />
            <TextInput
              style={[styles.input, styles.inputNarrow]}
              placeholder="Reps"
              placeholderTextColor={ds.colors.textSecondary}
              keyboardType="number-pad"
              value={logValues.reps}
              onChangeText={(v) => onLogChange({ reps: v })}
            />
            <TextInput
              style={[styles.input, styles.inputNarrow]}
              placeholder="Series"
              placeholderTextColor={ds.colors.textSecondary}
              keyboardType="number-pad"
              value={logValues.sets}
              onChangeText={(v) => onLogChange({ sets: v })}
            />
          </View>

          {/* Status feedback */}
          {savingLog ? (
            <Text style={styles.logStatus}>Guardando…</Text>
          ) : justSaved ? (
            <Text style={styles.logStatusSuccess}>✓ Registro guardado</Text>
          ) : (
            <Text style={styles.logHint}>Se guarda automáticamente al ingresar un valor válido.</Text>
          )}
        </View>
      )}

      {/* ── Context menu ───────────────────────────────── */}
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
                    disabled={opt.loading}
                    onPress={() => {
                      if (!opt.loading) {
                        setMenuVisible(false);
                        opt.onPress();
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {opt.loading ? (
                      <ActivityIndicator size="small" color={ds.colors.textSecondary} />
                    ) : (
                      <Text
                        style={[
                          styles.sheetOptionText,
                          opt.destructive && styles.sheetOptionDestructive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    )}
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
    gap: 12,
    ...ds.shadows.soft,
  },
  cardActive: {
    backgroundColor: ds.colors.surfaceElevated,
  },
  cardDone: {
    opacity: 0.7,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  headerCopy: {
    flex: 1,
    gap: ds.spacing.x1,
  },
  name: {
    flex: 1,
    fontSize: ds.typography.bodyLG,
    fontWeight: "700",
    color: ds.colors.textPrimary,
    letterSpacing: 0.1,
    fontFamily: ds.typography.fontFamily,
  },
  nameDone: {
    color: ds.colors.textSecondary,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: ds.radius.pill,
  },
  statusBadgePending: {
    backgroundColor: ds.colors.surface,
  },
  statusBadgeActive: {
    backgroundColor: ds.colors.actionPrimary + "22",
  },
  statusBadgeCompleted: {
    backgroundColor: ds.colors.success + "1E",
  },
  statusBadgeText: {
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    fontFamily: ds.typography.fontFamily,
  },
  statusBadgeTextPending: {
    color: ds.colors.textSecondary,
  },
  statusBadgeTextActive: {
    color: ds.colors.actionPrimary,
  },
  statusBadgeTextCompleted: {
    color: ds.colors.success,
  },

  // Menu button
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ds.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  menuDots: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
    color: ds.colors.textSecondary,
    lineHeight: 20,
  },

  metaLine: {
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    color: ds.colors.textSecondary,
    fontFamily: ds.typography.fontFamily,
  },
  lastPerformance: {
    fontSize: ds.typography.bodyMD,
    color: ds.colors.textPrimary,
    fontWeight: "500",
    fontFamily: ds.typography.fontFamily,
  },

  // Tip
  tip: {
    fontSize: ds.typography.bodyMD,
    color: ds.colors.textSecondary,
    lineHeight: 20,
    fontFamily: ds.typography.fontFamily,
  },

  // Primary action
  primaryBtn: {
    backgroundColor: ds.colors.actionPrimary,
    borderRadius: ds.radius.sm,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryBtnDone: {
    backgroundColor: "#1F2937",
  },
  primaryBtnDisabled: {
    backgroundColor: ds.colors.borderSubtle,
  },
  primaryBtnText: {
    fontSize: ds.typography.bodyMD,
    fontWeight: "700",
    color: ds.colors.textPrimary,
    letterSpacing: 0.2,
    fontFamily: ds.typography.fontFamily,
  },
  primaryBtnTextDone: {
    color: ds.colors.textSecondary,
  },

  // Progress toggle
  progressToggle: {
    alignSelf: "flex-start",
  },
  progressToggleText: {
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    color: ds.colors.textSecondary,
    fontFamily: ds.typography.fontFamily,
  },
  secondaryInlineAction: {
    alignSelf: "flex-start",
  },
  secondaryInlineActionText: {
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    color: ds.colors.textSecondary,
    fontFamily: ds.typography.fontFamily,
  },

  // Progress panel
  progressPanel: {
    backgroundColor: ds.colors.surface,
    borderRadius: ds.radius.sm,
    padding: ds.spacing.x2,
    gap: 6,
  },

  // Replacement panel
  replacementsPanel: {
    backgroundColor: ds.colors.surface,
    borderRadius: ds.radius.sm,
    padding: ds.spacing.x2,
    gap: 4,
  },
  replacementsPanelTitle: {
    fontSize: ds.typography.bodySM,
    fontWeight: "700",
    color: ds.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  replacementsLoading: {
    fontSize: ds.typography.bodyMD,
    color: ds.colors.textSecondary,
    marginLeft: 8,
  },
  replacementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: ds.colors.borderSubtle,
  },
  replacementName: {
    fontSize: ds.typography.bodyMD,
    fontWeight: "600",
    color: ds.colors.textPrimary,
    fontFamily: ds.typography.fontFamily,
  },
  replacementMeta: {
    fontSize: ds.typography.bodySM,
    color: ds.colors.textSecondary,
    marginTop: 2,
    fontFamily: ds.typography.fontFamily,
  },
  replacementArrow: {
    fontSize: 20,
    color: ds.colors.textSecondary,
    paddingLeft: 8,
  },

  // Log form
  logForm: {
    gap: 10,
  },
  unitRow: {
    flexDirection: "row",
    gap: 8,
  },
  unitChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: ds.colors.borderSubtle,
    backgroundColor: ds.colors.surface,
  },
  unitChipActive: {
    borderColor: ds.colors.actionPrimary,
    backgroundColor: ds.colors.actionPrimary + "18",
  },
  unitChipText: {
    fontSize: ds.typography.bodyMD,
    fontWeight: "700",
    color: ds.colors.textSecondary,
  },
  unitChipTextActive: {
    color: ds.colors.actionPrimary,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    backgroundColor: ds.colors.surface,
    borderRadius: ds.radius.sm,
    borderWidth: 1,
    borderColor: ds.colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: ds.typography.bodyMD,
    color: ds.colors.textPrimary,
  },
  inputWide: {
    flex: 2,
  },
  inputNarrow: {
    flex: 1,
  },
  logHint: {
    fontSize: ds.typography.bodySM,
    color: ds.colors.textSecondary,
  },
  logStatus: {
    fontSize: ds.typography.bodySM,
    color: ds.colors.textSecondary,
  },
  logStatusSuccess: {
    fontSize: ds.typography.bodySM,
    fontWeight: "600",
    color: ds.colors.success,
  },

  // Context menu
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
    paddingBottom: 34,
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
    minHeight: 52,
    justifyContent: "center",
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
