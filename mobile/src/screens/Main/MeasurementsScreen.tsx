import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { Measurement, ProgressSummary } from "../../types/api";
import { palette } from "../../theme/palette";

function toOptionalPositiveNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export function MeasurementsScreen() {
  const { user, token } = useAuth();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [armCm, setArmCm] = useState("");

  const hasAnyValue = useMemo(
    () =>
      Boolean(
        weightKg.trim() ||
          bodyFatPct.trim() ||
          muscleMass.trim() ||
          chestCm.trim() ||
          waistCm.trim() ||
          hipCm.trim() ||
          armCm.trim(),
      ),
    [weightKg, bodyFatPct, muscleMass, chestCm, waistCm, hipCm, armCm],
  );

  const loadMeasurements = async () => {
    if (!user || !token) {
      return;
    }

    setLoading(true);
    try {
      const [measurementsData, summaryData] = await Promise.all([
        api.getMeasurements(user.id, token),
        api.getProgressSummary(user.id, token),
      ]);
      setMeasurements(measurementsData.measurements);
      setProgressSummary(summaryData.summary);
    } catch (error) {
      Alert.alert("No se pudieron cargar mediciones", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const renderDelta = (value: number | null, suffix: string) => {
    if (value === null) {
      return "Sin datos";
    }
    const sign = value > 0 ? "+" : "";
    return `${sign}${value}${suffix}`;
  };

  useEffect(() => {
    void loadMeasurements();
  }, [token, user]);

  const onSave = async () => {
    if (!user || !token) {
      return;
    }

    if (!hasAnyValue) {
      Alert.alert("Completa al menos un campo", "Ingresa peso, grasa corporal o cintura para guardar la medicion.");
      return;
    }

    const payload = {
      weightKg: toOptionalPositiveNumber(weightKg),
      bodyFatPct: toOptionalPositiveNumber(bodyFatPct),
      muscleMass: toOptionalPositiveNumber(muscleMass),
      chestCm: toOptionalPositiveNumber(chestCm),
      waistCm: toOptionalPositiveNumber(waistCm),
      hipCm: toOptionalPositiveNumber(hipCm),
      armCm: toOptionalPositiveNumber(armCm),
    };

    if (
      !payload.weightKg &&
      !payload.bodyFatPct &&
      !payload.muscleMass &&
      !payload.chestCm &&
      !payload.waistCm &&
      !payload.hipCm &&
      !payload.armCm
    ) {
      Alert.alert("Valores invalidos", "Usa numeros positivos para guardar la medicion.");
      return;
    }

    setLoading(true);
    try {
      await api.createMeasurement(user.id, token, payload);
      setWeightKg("");
      setBodyFatPct("");
      setMuscleMass("");
      setChestCm("");
      setWaistCm("");
      setHipCm("");
      setArmCm("");
      await loadMeasurements();
      Alert.alert("Medicion guardada", "Tu progreso fue registrado correctamente.");
    } catch (error) {
      Alert.alert("No se pudo guardar", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Progreso corporal</Text>
        <Text style={styles.title}>Mediciones</Text>
        <Text style={styles.subtitle}>Registra tus metricas para seguir tu progreso semanal.</Text>
      </View>

      {progressSummary && progressSummary.measurementsCount > 0 ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen de progreso</Text>
          <Text style={styles.summaryHint}>{progressSummary.nextAction}</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Registros</Text>
              <Text style={styles.summaryValue}>{progressSummary.measurementsCount}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Racha semanal</Text>
              <Text style={styles.summaryValue}>{progressSummary.weeklyCheckInStreak}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Ultimo check-in</Text>
              <Text style={styles.summaryValue}>
                {progressSummary.daysSinceLastMeasurement === null
                  ? "Sin datos"
                  : `${progressSummary.daysSinceLastMeasurement} dia(s)`}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Estado semanal</Text>
              <Text style={styles.summaryValue}>{progressSummary.hasMeasurementThisWeek ? "Al dia" : "Pendiente"}</Text>
            </View>
          </View>

          <View style={styles.trendCard}>
            <Text style={styles.trendTitle}>Cambios vs periodos anteriores</Text>
            <Text style={styles.trendText}>Peso (7 dias): {renderDelta(progressSummary.metrics.weightKg.weeklyChange, " kg")}</Text>
            <Text style={styles.trendText}>Peso (30 dias): {renderDelta(progressSummary.metrics.weightKg.monthlyChange, " kg")}</Text>
            <Text style={styles.trendText}>
              Cintura (30 dias): {renderDelta(progressSummary.metrics.waistCm.monthlyChange, " cm")}
            </Text>
            <Text style={styles.trendText}>
              Brazo (30 dias): {renderDelta(progressSummary.metrics.armCm.monthlyChange, " cm")}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Peso (kg)</Text>
        <TextInput
          style={styles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
          placeholder="72.5"
          placeholderTextColor={palette.textSoft}
        />

        <Text style={styles.label}>Grasa corporal (%)</Text>
        <TextInput
          style={styles.input}
          value={bodyFatPct}
          onChangeText={setBodyFatPct}
          keyboardType="decimal-pad"
          placeholder="18"
          placeholderTextColor={palette.textSoft}
        />

        <Text style={styles.label}>Masa muscular (kg)</Text>
        <TextInput
          style={styles.input}
          value={muscleMass}
          onChangeText={setMuscleMass}
          keyboardType="decimal-pad"
          placeholder="32"
          placeholderTextColor={palette.textSoft}
        />

        <Text style={styles.label}>Pecho (cm)</Text>
        <TextInput
          style={styles.input}
          value={chestCm}
          onChangeText={setChestCm}
          keyboardType="decimal-pad"
          placeholder="100"
          placeholderTextColor={palette.textSoft}
        />

        <Text style={styles.label}>Cintura (cm)</Text>
        <TextInput
          style={styles.input}
          value={waistCm}
          onChangeText={setWaistCm}
          keyboardType="decimal-pad"
          placeholder="84"
          placeholderTextColor={palette.textSoft}
        />

        <Text style={styles.label}>Cadera (cm)</Text>
        <TextInput
          style={styles.input}
          value={hipCm}
          onChangeText={setHipCm}
          keyboardType="decimal-pad"
          placeholder="96"
          placeholderTextColor={palette.textSoft}
        />

        <Text style={styles.label}>Brazo (cm)</Text>
        <TextInput
          style={styles.input}
          value={armCm}
          onChangeText={setArmCm}
          keyboardType="decimal-pad"
          placeholder="34"
          placeholderTextColor={palette.textSoft}
        />

        <AppButton label={loading ? "Guardando..." : "Guardar medicion"} onPress={onSave} disabled={loading} />
      </View>

      <Text style={styles.sectionTitle}>Historial reciente</Text>
      <View style={styles.card}>
        {measurements.length === 0 ? (
          <Text style={styles.empty}>Aun no hay mediciones registradas.</Text>
        ) : (
          measurements.slice(0, 10).map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.rowDate}>{new Date(item.date).toLocaleDateString()}</Text>
              <Text style={styles.rowValue}>Peso: {item.weightKg ?? "-"} kg</Text>
              <Text style={styles.rowValue}>Grasa: {item.bodyFatPct ?? "-"} %</Text>
              <Text style={styles.rowValue}>Masa muscular: {item.muscleMass ?? "-"} kg</Text>
              <Text style={styles.rowValue}>Pecho: {item.chestCm ?? "-"} cm</Text>
              <Text style={styles.rowValue}>Cintura: {item.waistCm ?? "-"} cm</Text>
              <Text style={styles.rowValue}>Cadera: {item.hipCm ?? "-"} cm</Text>
              <Text style={styles.rowValue}>Brazo: {item.armCm ?? "-"} cm</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: palette.background,
    padding: 20,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 16,
  },
  eyebrow: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.ink,
    marginTop: 8,
  },
  subtitle: {
    marginTop: 8,
    color: palette.textMuted,
  },
  summaryCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 14,
  },
  summaryTitle: {
    color: palette.ink,
    fontWeight: "800",
    fontSize: 17,
  },
  summaryHint: {
    color: palette.textMuted,
    marginTop: 6,
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCell: {
    width: "47%",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 10,
  },
  summaryLabel: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  trendCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: palette.surfaceMuted,
  },
  trendTitle: {
    color: palette.ink,
    fontWeight: "700",
    marginBottom: 8,
  },
  trendText: {
    color: palette.textMuted,
    marginBottom: 4,
  },
  sectionTitle: {
    marginTop: 18,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  label: {
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    backgroundColor: palette.cream,
    color: palette.ink,
  },
  empty: {
    color: palette.textMuted,
  },
  row: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: palette.surface,
  },
  rowDate: {
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 6,
  },
  rowValue: {
    color: palette.textMuted,
    fontSize: 13,
  },
});
