import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { Measurement } from "../../types/api";
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
  const [loading, setLoading] = useState(false);

  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [waistCm, setWaistCm] = useState("");

  const hasAnyValue = useMemo(
    () => Boolean(weightKg.trim() || bodyFatPct.trim() || waistCm.trim()),
    [weightKg, bodyFatPct, waistCm],
  );

  const loadMeasurements = async () => {
    if (!user || !token) {
      return;
    }

    setLoading(true);
    try {
      const data = await api.getMeasurements(user.id, token);
      setMeasurements(data.measurements);
    } catch (error) {
      Alert.alert("No se pudieron cargar mediciones", error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
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
      waistCm: toOptionalPositiveNumber(waistCm),
    };

    if (!payload.weightKg && !payload.bodyFatPct && !payload.waistCm) {
      Alert.alert("Valores invalidos", "Usa numeros positivos para guardar la medicion.");
      return;
    }

    setLoading(true);
    try {
      await api.createMeasurement(user.id, token, payload);
      setWeightKg("");
      setBodyFatPct("");
      setWaistCm("");
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
      <Text style={styles.title}>Mediciones</Text>
      <Text style={styles.subtitle}>Registra tus metricas para seguir tu progreso semanal.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Peso (kg)</Text>
        <TextInput
          style={styles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
          placeholder="72.5"
        />

        <Text style={styles.label}>Grasa corporal (%)</Text>
        <TextInput
          style={styles.input}
          value={bodyFatPct}
          onChangeText={setBodyFatPct}
          keyboardType="decimal-pad"
          placeholder="18"
        />

        <Text style={styles.label}>Cintura (cm)</Text>
        <TextInput
          style={styles.input}
          value={waistCm}
          onChangeText={setWaistCm}
          keyboardType="decimal-pad"
          placeholder="84"
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
              <Text style={styles.rowValue}>Cintura: {item.waistCm ?? "-"} cm</Text>
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
    backgroundColor: palette.snow,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.ink,
  },
  subtitle: {
    marginTop: 8,
    color: "#556977",
    marginBottom: 16,
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
    borderRadius: 16,
    padding: 14,
  },
  label: {
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CFD9DF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    backgroundColor: "#FAFCFD",
  },
  empty: {
    color: "#6F7D87",
  },
  row: {
    borderWidth: 1,
    borderColor: "#E3EBF0",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FBFDFE",
  },
  rowDate: {
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 6,
  },
  rowValue: {
    color: "#435867",
    fontSize: 13,
  },
});
