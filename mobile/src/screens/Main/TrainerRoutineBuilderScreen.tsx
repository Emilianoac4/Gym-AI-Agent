import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { ExerciseInput, TrainerRoutineTemplate } from "../../types/api";
import { palette } from "../../theme/palette";

type Mode = "assign" | "preset" | "edit-preset" | "edit-assigned";

interface RouteParams {
  mode: Mode;
  memberId?: string;
  memberName?: string;
  /** Pre-fill from a template (assign mode using preset, or edit-preset) */
  template?: TrainerRoutineTemplate | null;
  /** ID of the assigned routine being edited (edit-assigned mode) */
  assignedRoutineId?: string;
  /** Pre-filled data for edit-assigned mode */
  assignedRoutine?: {
    id: string;
    name: string;
    purpose: string;
    scheduledDays?: string[] | null;
    exercises: ExerciseInput[];
  } | null;
}

interface ExerciseRow extends ExerciseInput {
  _key: string;
  _standardizing: boolean;
}

const makeBlankExercise = (): ExerciseRow => ({
  _key: Math.random().toString(36).slice(2),
  _standardizing: false,
  name: "",
  originalName: undefined,
  reps: 10,
  sets: 3,
  restSeconds: 60,
  tips: "",
});

export function TrainerRoutineBuilderScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: RouteParams };
}) {
  const { mode, memberId, memberName, template, assignedRoutineId, assignedRoutine } = route.params;
  const { token } = useAuth();

  const isAssign = mode === "assign";
  const isEditPreset = mode === "edit-preset";
  const isEditAssigned = mode === "edit-assigned";

  const prefillName = assignedRoutine?.name ?? template?.name ?? "";
  const prefillPurpose = assignedRoutine?.purpose ?? template?.purpose ?? "";
  const prefillExercises = assignedRoutine?.exercises ?? template?.exercises;

  const [routineName, setRoutineName] = useState(prefillName);
  const [purpose, setPurpose] = useState(prefillPurpose);
  const [exercises, setExercises] = useState<ExerciseRow[]>(() => {
    const source = prefillExercises;
    if (source && source.length > 0) {
      return source.map((e) => ({
        _key: Math.random().toString(36).slice(2),
        _standardizing: false,
        name: e.name,
        originalName: e.originalName ?? undefined,
        reps: e.reps,
        sets: e.sets,
        restSeconds: e.restSeconds,
        tips: e.tips ?? "",
        sortOrder: e.sortOrder,
      }));
    }
    return [makeBlankExercise()];
  });
  const [submitting, setSubmitting] = useState(false);
  const [memberPreferredDays, setMemberPreferredDays] = useState<string[]>([]);
  const [memberPathologies, setMemberPathologies] = useState<Array<{ label: string; notes?: string }>>([]);
  const [pathologiesUpdatedAt, setPathologiesUpdatedAt] = useState<Date | null>(null);
  const [scheduledDays, setScheduledDays] = useState<string[]>(
    Array.isArray(assignedRoutine?.scheduledDays) ? assignedRoutine.scheduledDays : []
  );

  const ALL_DAYS: { value: string; label: string }[] = [
    { value: "monday",    label: "Lun" },
    { value: "tuesday",   label: "Mar" },
    { value: "wednesday", label: "Mié" },
    { value: "thursday",  label: "Jue" },
    { value: "friday",    label: "Vie" },
    { value: "saturday",  label: "Sáb" },
    { value: "sunday",    label: "Dom" },
  ];

  const availableDays = isAssign && memberPreferredDays.length > 0
    ? ALL_DAYS.filter((d) => memberPreferredDays.includes(d.value))
    : ALL_DAYS;

  const title = isAssign
    ? `Rutina para ${memberName ?? "usuario"}`
    : isEditPreset
    ? "Editar plantilla"
    : isEditAssigned
    ? `Editar rutina de ${memberName ?? "usuario"}`
    : "Nueva plantilla";
  const submitLabel = isAssign
    ? "Subir rutina"
    : isEditPreset
    ? "Guardar cambios"
    : isEditAssigned
    ? "Guardar cambios"
    : "Guardar plantilla";

  useEffect(() => {
    if (!isAssign || !memberId || !token) return;
    api.getMemberPreferredDays(token, memberId)
      .then((res) => setMemberPreferredDays(res.preferredDays))
      .catch(() => {});
  }, [isAssign, memberId, token]);

  useEffect(() => {
    if (!token || !memberId || (!isAssign && !isEditAssigned)) return;

    let cancelled = false;

    const loadPathologies = () => {
      api.getUserPathologies(memberId, token)
        .then((res) => {
          if (cancelled) return;
          const active = res.pathologies.filter((item) => item.isActive);
          const parsed = active.map((item) => ({
            label: item.key === "other" && item.customLabel
              ? item.customLabel
              : item.key.replace(/_/g, " "),
            notes: item.notes ?? undefined,
          }));
          setMemberPathologies(parsed);
          setPathologiesUpdatedAt(new Date());
        })
        .catch(() => {
          if (cancelled) return;
          setMemberPathologies([]);
          setPathologiesUpdatedAt(new Date());
        });
    };

    loadPathologies();
    const interval = setInterval(loadPathologies, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, memberId, isAssign, isEditAssigned]);

  /* ─── exercise helpers ─────────────────────────────── */

  const addExercise = () => setExercises((prev) => [...prev, makeBlankExercise()]);

  const removeExercise = (key: string) =>
    setExercises((prev) => (prev.length > 1 ? prev.filter((e) => e._key !== key) : prev));

  const updateField = (key: string, field: keyof ExerciseInput, value: string | number) => {
    setExercises((prev) =>
      prev.map((e) => (e._key === key ? { ...e, [field]: value } : e)),
    );
  };

  const standardize = async (key: string) => {
    if (!token) return;
    const ex = exercises.find((e) => e._key === key);
    if (!ex || !ex.name.trim()) return;

    setExercises((prev) =>
      prev.map((e) => (e._key === key ? { ...e, _standardizing: true } : e)),
    );

    try {
      const res = await api.standardizeExerciseName(token, ex.name.trim());
      setExercises((prev) =>
        prev.map((e) =>
          e._key === key
            ? {
                ...e,
                name: res.standardized,
                originalName: res.standardized !== res.original ? res.original : e.originalName,
                _standardizing: false,
              }
            : e,
        ),
      );
    } catch {
      setExercises((prev) =>
        prev.map((e) => (e._key === key ? { ...e, _standardizing: false } : e)),
      );
    }
  };

  /* ─── submit ────────────────────────────────────────── */

  const handleSubmit = async () => {
    if (!token) return;

    // Validation
    if (!routineName.trim()) {
      Alert.alert("Falta información", "Por favor escribe un nombre para la rutina.");
      return;
    }
    if (!purpose.trim()) {
      Alert.alert("Falta información", "Por favor escribe el propósito de la rutina.");
      return;
    }
    const invalidEx = exercises.find((e) => !e.name.trim());
    if (invalidEx) {
      Alert.alert("Falta información", "Todos los ejercicios deben tener un nombre.");
      return;
    }

    const exercisePayload: ExerciseInput[] = exercises.map((e, i) => ({
      name: e.name.trim(),
      originalName: e.originalName,
      reps: Number(e.reps),
      sets: Number(e.sets),
      restSeconds: Number(e.restSeconds),
      tips: e.tips?.trim() || undefined,
      sortOrder: i,
    }));

    setSubmitting(true);

    try {
      if (isEditPreset) {
        if (!template?.id) { setSubmitting(false); return; }
        await api.updateTrainerTemplate(token, template.id, {
          name: routineName.trim(),
          purpose: purpose.trim(),
          exercises: exercisePayload,
        });
        Alert.alert("Plantilla actualizada", `"${routineName}" se actualizó correctamente.`, [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        setSubmitting(false);
        return;
      }

      if (isEditAssigned) {
        const routineId = assignedRoutineId ?? assignedRoutine?.id;
        if (!routineId) { setSubmitting(false); return; }
        await api.updateTrainerAssignedRoutine(token, routineId, {
          name: routineName.trim(),
          purpose: purpose.trim(),
          exercises: exercisePayload,
          scheduledDays: scheduledDays.length > 0 ? scheduledDays : undefined,
        });
        Alert.alert("Rutina actualizada", `"${routineName}" se actualizó correctamente.`, [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        setSubmitting(false);
        return;
      }

      if (!isAssign) {
        // Save as preset/template
        await api.createTrainerTemplate(token, {
          name: routineName.trim(),
          purpose: purpose.trim(),
          exercises: exercisePayload,
        });
        Alert.alert("Plantilla guardada", `La plantilla "${routineName}" se guardó correctamente.`, [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
        setSubmitting(false);
        return;
      }

      // Assign mode: validate first
      if (!memberId) { setSubmitting(false); return; }

      let acceptedWarnings: string[] = [];

      try {
        const { warnings } = await api.validateTrainerRoutine(token, {
          memberId,
          routineName: routineName.trim(),
          purpose: purpose.trim(),
          exercises: exercisePayload,
        });

        if (warnings.length > 0) {
          const warningText = warnings.map((w) => `• ${w}`).join("\n");
          await new Promise<void>((resolve) => {
            Alert.alert(
              "Advertencia de la IA",
              `La inteligencia artificial detectó algunas observaciones:\n\n${warningText}\n\n¿Deseas continuar de todas formas?`,
              [
                { text: "Cancelar", style: "cancel", onPress: () => { setSubmitting(false); resolve(undefined); } },
                {
                  text: "Continuar",
                  style: "destructive",
                  onPress: () => {
                    acceptedWarnings = warnings;
                    resolve(undefined);
                  },
                },
              ],
              { cancelable: false },
            );
          });

          if (acceptedWarnings.length === 0 && warnings.length > 0) {
            // user cancelled
            return;
          }
        }
      } catch {
        // validation endpoint failure → skip, proceed without warnings
      }

      await api.assignTrainerRoutine(token, {
        memberId,
        name: routineName.trim(),
        purpose: purpose.trim(),
        exercises: exercisePayload,
        templateId: template?.id,
        aiWarnings: acceptedWarnings.length > 0 ? acceptedWarnings : undefined,
        scheduledDays: scheduledDays.length > 0 ? scheduledDays : undefined,
      });

      Alert.alert(
        "Rutina asignada",
        `La rutina "${routineName}" fue asignada a ${memberName ?? "el usuario"} y se les envió una notificación.`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
      setSubmitting(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "No se pudo completar la operación.");
      setSubmitting(false);
    }
  };

  /* ─── render ─────────────────────────────────────────── */

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{title}</Text>
            {isAssign && (
              <Text style={styles.screenSubtitle}>Rutina personalizada para {memberName}</Text>
            )}
          </View>
        </View>

        {(isAssign || isEditAssigned) && memberPathologies.length > 0 && (
          <View style={styles.pathologiesCard}>
            <Text style={styles.pathologiesTitle}>Padecimientos compartidos por el usuario</Text>
            {pathologiesUpdatedAt ? (
              <Text style={styles.pathologiesRefreshHint}>
                Actualizado: {pathologiesUpdatedAt.toLocaleTimeString()}
              </Text>
            ) : null}
            {memberPathologies.map((item, idx) => (
              <View key={`${item.label}-${idx}`} style={styles.pathologyRow}>
                <Text style={styles.pathologyName}>• {item.label}</Text>
                {item.notes ? <Text style={styles.pathologyNotes}>{item.notes}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Days selector — assign and edit-assigned modes */}
        {(isAssign || isEditAssigned) && (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>Días de la rutina</Text>
            {isAssign && memberPreferredDays.length === 0 && (
              <Text style={styles.daysHint}>El usuario no tiene días preferidos configurados. Puedes seleccionar cualquier día.</Text>
            )}
            <View style={styles.daysRow}>
              {availableDays.map((day) => {
                const active = scheduledDays.includes(day.value);
                return (
                  <TouchableOpacity
                    key={day.value}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() =>
                      setScheduledDays((prev) =>
                        active ? prev.filter((d) => d !== day.value) : [...prev, day.value]
                      )
                    }
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {scheduledDays.length === 0 && (
              <Text style={styles.daysHint}>Si no seleccionas ningún día se asignará como "Día A".</Text>
            )}
          </View>
        )}

        {/* Routine info */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>Nombre de la rutina</Text>
          <TextInput
            style={styles.input}
            value={routineName}
            onChangeText={setRoutineName}
            placeholder="Ej. Rutina push-pull nivel intermedio"
            placeholderTextColor={palette.textMuted}
            maxLength={100}
          />
          <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Propósito</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Ej. Aumento de masa muscular con enfoque en tren superior"
            placeholderTextColor={palette.textMuted}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        {/* Exercises */}
        <Text style={styles.exercisesTitle}>Ejercicios</Text>

        {exercises.map((ex, idx) => (
          <View key={ex._key} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseIndex}>Ejercicio {idx + 1}</Text>
              {exercises.length > 1 && (
                <TouchableOpacity onPress={() => removeExercise(ex._key)}>
                  <Text style={styles.removeBtn}>✕ Quitar</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Name + Standardize */}
            <Text style={styles.fieldLabel}>Nombre del ejercicio</Text>
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={ex.name}
                onChangeText={(v) => updateField(ex._key, "name", v)}
                placeholder="Ej. Press de banca"
                placeholderTextColor={palette.textMuted}
              />
              <TouchableOpacity
                style={[styles.stdBtn, ex._standardizing && { opacity: 0.6 }]}
                onPress={() => void standardize(ex._key)}
                disabled={ex._standardizing || !ex.name.trim()}
              >
                {ex._standardizing ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Text style={styles.stdBtnText}>Estandarizar</Text>
                )}
              </TouchableOpacity>
            </View>
            {ex.originalName && ex.originalName !== ex.name && (
              <Text style={styles.originalName}>Original: "{ex.originalName}"</Text>
            )}

            {/* Reps / Sets / Rest */}
            <View style={styles.numbersRow}>
              <View style={styles.numberField}>
                <Text style={styles.fieldLabel}>Reps</Text>
                <TextInput
                  style={[styles.input, styles.numberInput]}
                  value={String(ex.reps)}
                  onChangeText={(v) => updateField(ex._key, "reps", parseInt(v) || 0)}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View style={styles.numberField}>
                <Text style={styles.fieldLabel}>Series</Text>
                <TextInput
                  style={[styles.input, styles.numberInput]}
                  value={String(ex.sets)}
                  onChangeText={(v) => updateField(ex._key, "sets", parseInt(v) || 0)}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <View style={styles.numberField}>
                <Text style={styles.fieldLabel}>Descanso (s)</Text>
                <TextInput
                  style={[styles.input, styles.numberInput]}
                  value={String(ex.restSeconds)}
                  onChangeText={(v) => updateField(ex._key, "restSeconds", parseInt(v) || 0)}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>

            {/* Tips */}
            <Text style={styles.fieldLabel}>Consejos (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={ex.tips}
              onChangeText={(v) => updateField(ex._key, "tips", v)}
              placeholder="Ej. Mantén la espalda recta, controla el descenso"
              placeholderTextColor={palette.textMuted}
              multiline
              numberOfLines={2}
              maxLength={300}
            />
          </View>
        ))}

        {/* Add exercise */}
        <TouchableOpacity style={styles.addExerciseBtn} onPress={addExercise}>
          <Text style={styles.addExerciseBtnText}>+ Añadir ejercicio</Text>
        </TouchableOpacity>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Text style={styles.submitBtnText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 48 },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    marginTop: Platform.OS === "ios" ? 50 : 14,
  },
  backBtn: { paddingRight: 10, paddingTop: 2 },
  backIcon: { fontSize: 28, color: palette.cocoa, lineHeight: 30 },
  screenTitle: { fontSize: 20, fontWeight: "800", color: palette.cocoa },
  screenSubtitle: { fontSize: 12, color: palette.textMuted, marginTop: 2 },

  sectionBox: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 20,
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: palette.cocoa, marginBottom: 6 },

  pathologiesCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 12,
  },
  pathologiesTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: palette.cocoa,
    marginBottom: 8,
  },
  pathologiesRefreshHint: {
    fontSize: 11,
    color: palette.textMuted,
    marginBottom: 8,
  },
  pathologyRow: {
    marginBottom: 8,
  },
  pathologyName: {
    fontSize: 13,
    color: palette.cocoa,
    fontWeight: "700",
  },
  pathologyNotes: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },

  exercisesTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.cocoa,
    marginBottom: 12,
  },

  exerciseCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 14,
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  exerciseIndex: { fontSize: 14, fontWeight: "800", color: palette.cocoa },
  removeBtn: { fontSize: 12, color: palette.coral, fontWeight: "700" },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  stdBtn: {
    backgroundColor: palette.moss,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 106,
    alignItems: "center",
  },
  stdBtnText: { color: palette.white, fontWeight: "700", fontSize: 12 },
  originalName: { fontSize: 11, color: palette.textMuted, marginBottom: 8, fontStyle: "italic" },

  numbersRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 6 },
  numberField: { flex: 1 },
  numberInput: { textAlign: "center" },

  fieldLabel: { fontSize: 12, fontWeight: "600", color: palette.textMuted, marginBottom: 4 },

  input: {
    backgroundColor: palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: palette.ink,
  },
  inputMulti: {
    minHeight: 72,
    textAlignVertical: "top",
    paddingTop: 10,
  },

  addExerciseBtn: {
    borderWidth: 1.5,
    borderColor: palette.cocoa,
    borderRadius: 14,
    borderStyle: "dashed",
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 20,
  },
  addExerciseBtnText: { color: palette.cocoa, fontWeight: "700", fontSize: 14 },

  submitBtn: {
    backgroundColor: palette.cocoa,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnText: { color: palette.white, fontWeight: "800", fontSize: 16 },

  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  daysHint: { fontSize: 12, color: palette.textSoft, marginTop: 4, marginBottom: 4 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  dayChipActive: {
    borderColor: palette.moss,
    backgroundColor: palette.moss + "18",
  },
  dayChipText: { fontSize: 13, fontWeight: "600", color: palette.textSoft },
  dayChipTextActive: { color: palette.moss },
});
