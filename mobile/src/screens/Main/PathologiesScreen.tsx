import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";

const PRIMARY = palette.moss; // #22C55E
const MUTED = palette.textMuted; // #6B7280
const INK = palette.ink; // #111827

// ─── Types ────────────────────────────────────────────────────────────────────

interface PathologyEntry {
  id?: string;
  key: string;
  customLabel?: string;
  notes?: string;
  isActive: boolean;
  allowTrainerView: boolean;
  diagnosedAt?: string;
}

interface PathologyState {
  notes: string;
  allowTrainerView: boolean;
  customLabel: string; // only used when key === "other"
}

// ─── Catalogue definition ────────────────────────────────────────────────────

interface CatalogueItem {
  key: string;
  label: string;
}

interface Category {
  id: string;
  title: string;
  items: CatalogueItem[];
}

const CATALOGUE: Category[] = [
  {
    id: "cardiovascular",
    title: "Cardiovascular",
    items: [
      { key: "hipertension_arterial", label: "Hipertensión arterial" },
      { key: "cardiopatia_isquemica_angina", label: "Cardiopatía isquémica / Angina" },
      { key: "arritmia_cardiaca", label: "Arritmia cardíaca" },
      { key: "insuficiencia_cardiaca", label: "Insuficiencia cardíaca" },
      { key: "marcapasos_implantado", label: "Marcapasos implantado" },
    ],
  },
  {
    id: "respiratorio",
    title: "Respiratorio",
    items: [
      { key: "asma", label: "Asma" },
      { key: "epoc", label: "EPOC" },
      { key: "apnea_sueno", label: "Apnea del sueño" },
    ],
  },
  {
    id: "metabolico",
    title: "Metabólico / Endocrino",
    items: [
      { key: "diabetes_tipo_1", label: "Diabetes tipo 1" },
      { key: "diabetes_tipo_2", label: "Diabetes tipo 2" },
      { key: "trastorno_tiroideo", label: "Trastorno tiroideo" },
      { key: "obesidad_morbida", label: "Obesidad mórbida" },
    ],
  },
  {
    id: "musculoesqueletico",
    title: "Musculoesquelético",
    items: [
      { key: "hernia_discal", label: "Hernia discal" },
      { key: "escoliosis", label: "Escoliosis" },
      { key: "osteoporosis_osteopenia", label: "Osteoporosis / Osteopenia" },
      { key: "artritis_reumatoide", label: "Artritis reumatoide" },
      { key: "artrosis", label: "Artrosis" },
      { key: "tendinitis_cronica", label: "Tendinitis crónica" },
      { key: "lesion_ligamento_cruzado", label: "Lesión de ligamento cruzado" },
      { key: "sindrome_manguito_rotador", label: "Síndrome de manguito rotador" },
      { key: "fractura_rehabilitacion", label: "Fractura en rehabilitación" },
      { key: "protesis_articular", label: "Prótesis articular" },
      { key: "fibromialgia", label: "Fibromialgia" },
    ],
  },
  {
    id: "neurologico",
    title: "Neurológico",
    items: [
      { key: "epilepsia", label: "Epilepsia" },
      { key: "esclerosis_multiple", label: "Esclerosis múltiple" },
      { key: "parkinson", label: "Parkinson" },
      { key: "migrana_cronica", label: "Migraña crónica" },
    ],
  },
  {
    id: "oncologico",
    title: "Oncológico",
    items: [
      { key: "cancer_activo", label: "Cáncer activo" },
      { key: "cancer_remision", label: "Cáncer en remisión" },
    ],
  },
  {
    id: "salud_mental",
    title: "Salud Mental",
    items: [
      { key: "ansiedad_generalizada", label: "Ansiedad generalizada" },
      { key: "depresion_clinica", label: "Depresión clínica" },
      { key: "trastorno_alimentario", label: "Trastorno alimentario" },
    ],
  },
  {
    id: "renal_urologico",
    title: "Renal / Urológico",
    items: [
      { key: "insuficiencia_renal_cronica", label: "Insuficiencia renal crónica" },
      { key: "calculos_renales", label: "Cálculos renales" },
      { key: "incontinencia_urinaria", label: "Incontinencia urinaria" },
      { key: "prostatitis_cronica", label: "Prostatitis crónica" },
    ],
  },
  {
    id: "ginecologico",
    title: "Ginecológico / Obstétrico",
    items: [
      { key: "embarazo_activo", label: "Embarazo activo" },
      { key: "postparto_reciente", label: "Posparto reciente" },
    ],
  },
  {
    id: "otro",
    title: "Otro",
    items: [{ key: "other", label: "Otro padecimiento" }],
  },
];

const ALL_ITEMS = CATALOGUE.flatMap((c) => c.items);

function labelFor(key: string): string {
  return ALL_ITEMS.find((item) => item.key === key)?.label ?? key;
}

// ─── Collapsible category row ─────────────────────────────────────────────────

function CategorySection({
  category,
  selected,
  stateMap,
  onToggleItem,
  onChangeNotes,
  onChangeCustomLabel,
  onChangeTrainerView,
}: {
  category: Category;
  selected: Set<string>;
  stateMap: Record<string, PathologyState>;
  onToggleItem: (key: string) => void;
  onChangeNotes: (key: string, value: string) => void;
  onChangeCustomLabel: (key: string, value: string) => void;
  onChangeTrainerView: (key: string, value: boolean) => void;
}) {
  const activeCount = category.items.filter((i) => selected.has(i.key)).length;
  const [expanded, setExpanded] = useState(activeCount > 0);
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(rotateAnim, {
      toValue: next ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });

  return (
    <View style={styles.categoryBlock}>
      <TouchableOpacity style={styles.categoryHeader} onPress={toggle} activeOpacity={0.7}>
        <Text style={styles.categoryTitle}>
          {category.title}
          {activeCount > 0 ? (
            <Text style={styles.categoryCount}> ({activeCount})</Text>
          ) : null}
        </Text>
        <Animated.Text style={[styles.chevron, { transform: [{ rotate }] }]}>›</Animated.Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.categoryBody}>
          {category.items.map((item) => {
            const isSelected = selected.has(item.key);
            const state = stateMap[item.key];
            return (
              <View key={item.key}>
                <TouchableOpacity
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => onToggleItem(item.key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.chipDot, isSelected && styles.chipDotActive]} />
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>

                {isSelected && state ? (
                  <View style={styles.detailPanel}>
                    {item.key === "other" ? (
                      <>
                        <Text style={styles.detailLabel}>¿Cuál condición?</Text>
                        <TextInput
                          style={styles.detailInput}
                          value={state.customLabel}
                          onChangeText={(v) => onChangeCustomLabel(item.key, v)}
                          placeholder="Describe brevemente el padecimiento"
                          placeholderTextColor={MUTED}
                          maxLength={120}
                        />
                      </>
                    ) : null}
                    <Text style={styles.detailLabel}>Detalles / observaciones</Text>
                    <TextInput
                      style={[styles.detailInput, styles.detailInputMultiline]}
                      value={state.notes}
                      onChangeText={(v) => onChangeNotes(item.key, v)}
                      placeholder="Ej.: controlado con medicación, afecta rodilla derecha…"
                      placeholderTextColor={MUTED}
                      multiline
                      numberOfLines={3}
                      maxLength={500}
                      textAlignVertical="top"
                    />
                    <View style={styles.trainerRow}>
                      <View style={styles.trainerTextBlock}>
                        <Text style={styles.trainerLabel}>Visible para mi entrenador</Text>
                        <Text style={styles.trainerSub}>
                          El entrenador podrá ver este padecimiento al planificar tus sesiones
                        </Text>
                      </View>
                      <Switch
                        value={state.allowTrainerView}
                        onValueChange={(v) => onChangeTrainerView(item.key, v)}
                        trackColor={{ false: "#E5E7EB", true: PRIMARY + "66" }}
                        thumbColor={state.allowTrainerView ? PRIMARY : "#F3F4F6"}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function PathologiesScreen({ navigation }: { navigation: any }) {
  const { user, token } = useAuth();
  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stateMap, setStateMap] = useState<Record<string, PathologyState>>({});

  // ── Load existing pathologies ──
  useEffect(() => {
    if (!token || !userId) return;
    (async () => {
      try {
        const resp = await api.getUserPathologies(userId, token);
        const newSelected = new Set<string>();
        const newStateMap: Record<string, PathologyState> = {};
        for (const p of resp.pathologies) {
          if (!p.isActive) continue;
          newSelected.add(p.key);
          newStateMap[p.key] = {
            notes: p.notes ?? "",
            allowTrainerView: p.allowTrainerView,
            customLabel: p.customLabel ?? "",
          };
        }
        setSelected(newSelected);
        setStateMap(newStateMap);
      } catch {
        Alert.alert("Error", "No se pudieron cargar tus padecimientos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, userId]);

  // ── Toggle a pathology on/off ──
  const onToggleItem = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setStateMap((sm) =>
          sm[key]
            ? sm
            : {
                ...sm,
                [key]: { notes: "", allowTrainerView: false, customLabel: "" },
              },
        );
      }
      return next;
    });
  }, []);

  const onChangeNotes = useCallback((key: string, value: string) => {
    setStateMap((sm) => ({ ...sm, [key]: { ...sm[key], notes: value } }));
  }, []);

  const onChangeCustomLabel = useCallback((key: string, value: string) => {
    setStateMap((sm) => ({ ...sm, [key]: { ...sm[key], customLabel: value } }));
  }, []);

  const onChangeTrainerView = useCallback((key: string, value: boolean) => {
    setStateMap((sm) => ({ ...sm, [key]: { ...sm[key], allowTrainerView: value } }));
  }, []);

  // ── Save ──
  const onSave = useCallback(async () => {
    if (!token || !userId) {
      Alert.alert("Sesión requerida", "Inicia sesión nuevamente para guardar tus padecimientos.");
      return;
    }

    // Validate "other" customLabel
    if (selected.has("other")) {
      const s = stateMap["other"];
      if (!s?.customLabel || s.customLabel.trim().length < 2) {
        Alert.alert("Dato requerido", "Describe el padecimiento en el campo '¿Cuál condición?'.");
        return;
      }
    }

    const entries: Array<{
      key: string;
      customLabel?: string;
      notes?: string;
      isActive: boolean;
      allowTrainerView: boolean;
    }> = Array.from(selected).map((key) => {
      const s = stateMap[key] ?? { notes: "", allowTrainerView: false, customLabel: "" };
      const entry: {
        key: string;
        customLabel?: string;
        notes?: string;
        isActive: boolean;
        allowTrainerView: boolean;
      } = {
        key,
        isActive: true,
        notes: s.notes.trim() || undefined,
        allowTrainerView: s.allowTrainerView,
      };
      if (key === "other") entry.customLabel = s.customLabel.trim();
      return entry;
    });

    setSaving(true);
    try {
      await api.upsertUserPathologies(userId, token, { entries });
      Alert.alert("Guardado", "Tus padecimientos han sido actualizados.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [userId, token, selected, stateMap, navigation]);

  // ── Summary chips (compact badge at top) ──
  const summaryItems = Array.from(selected).map((key) => {
    const s = stateMap[key];
    if (key === "other" && s?.customLabel) return s.customLabel;
    return labelFor(key);
  });

  if (loading) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis padecimientos</Text>
        <View style={{ width: 72 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info notice */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Selecciona las condiciones que aplican para ti. Tuco las usará para adaptar tus rutinas
            y planes. Decide qué puede ver tu entrenador activando el permiso por padecimiento.
          </Text>
        </View>

        {/* Active summary */}
        {summaryItems.length > 0 ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Condiciones activas</Text>
            <View style={styles.summaryChips}>
              {summaryItems.map((label, i) => (
                <View key={i} style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Categories */}
        {CATALOGUE.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            selected={selected}
            stateMap={stateMap}
            onToggleItem={onToggleItem}
            onChangeNotes={onChangeNotes}
            onChangeCustomLabel={onChangeCustomLabel}
            onChangeTrainerView={onChangeTrainerView}
          />
        ))}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Esta información es orientativa para tu entrenamiento. No reemplaza el diagnóstico ni el
          consejo médico profesional.
        </Text>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Guardar cambios</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.background },
  loadingShell: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.card,
    paddingTop: Platform.OS === "ios" ? 56 : 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  backBtn: { width: 72 },
  backText: { color: PRIMARY, fontSize: 16, fontWeight: "600" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: INK },

  scroll: { padding: 16, paddingBottom: 48 },

  // Info box
  infoBox: {
    backgroundColor: PRIMARY + "18",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoText: { fontSize: 13, color: INK, lineHeight: 19 },

  // Summary
  summaryBox: {
    backgroundColor: palette.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryTitle: { fontSize: 12, fontWeight: "700", color: PRIMARY, marginBottom: 8 },
  summaryChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  summaryChip: {
    backgroundColor: PRIMARY + "20",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summaryChipText: { fontSize: 12, color: PRIMARY, fontWeight: "600" },

  // Category
  categoryBlock: {
    backgroundColor: palette.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  categoryTitle: { fontSize: 15, fontWeight: "700", color: INK },
  categoryCount: { color: PRIMARY },
  chevron: { fontSize: 22, color: PRIMARY, fontWeight: "700" },
  categoryBody: { paddingHorizontal: 12, paddingBottom: 10 },

  // Chip
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.line ?? "#E5E7EB",
    marginBottom: 6,
    backgroundColor: "transparent",
  },
  chipActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + "12",
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: MUTED,
    marginRight: 10,
  },
  chipDotActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  chipText: { fontSize: 14, color: INK },
  chipTextActive: { color: PRIMARY, fontWeight: "600" },

  // Detail panel
  detailPanel: {
    backgroundColor: palette.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: PRIMARY + "60",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    marginBottom: 5,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailInput: {
    backgroundColor: palette.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: INK,
    marginBottom: 8,
  },
  detailInputMultiline: { minHeight: 72 },

  // Trainer toggle
  trainerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  trainerTextBlock: { flex: 1, marginRight: 12 },
  trainerLabel: { fontSize: 13, fontWeight: "700", color: INK },
  trainerSub: { fontSize: 11, color: MUTED, marginTop: 2 },

  // Disclaimer
  disclaimer: {
    fontSize: 11,
    color: MUTED,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 16,
    lineHeight: 15,
    paddingHorizontal: 8,
  },

  // Save button
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
