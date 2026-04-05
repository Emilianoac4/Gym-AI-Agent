import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppButton } from "../../components/AppButton";
import { palette } from "../../theme/palette";
import { api } from "../../services/api";

type Plan = "basic" | "standard" | "premium";
type UserCountRange = "1-50" | "51-150" | "151-300" | "300+";

const PLANS: { id: Plan; label: string; description: string }[] = [
  {
    id: "basic",
    label: "Basic",
    description: "Descripción del plan próximamente disponible.",
  },
  {
    id: "standard",
    label: "Standard",
    description: "Descripción del plan próximamente disponible.",
  },
  {
    id: "premium",
    label: "Premium",
    description: "Descripción del plan próximamente disponible.",
  },
];

const USER_COUNT_RANGES: UserCountRange[] = ["1-50", "51-150", "151-300", "300+"];

export function ContactSalesScreen() {
  const navigation = useNavigation<any>();

  const [gymName, setGymName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedUserCount, setSelectedUserCount] = useState<UserCountRange | null>(null);
  const [needs, setNeeds] = useState("");
  const [sending, setSending] = useState(false);
  const [tooltipPlan, setTooltipPlan] = useState<Plan | null>(null);

  const onSubmit = async () => {
    if (!gymName.trim()) {
      Alert.alert("Campo requerido", "Ingresa el nombre de tu gimnasio.");
      return;
    }
    if (!contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      Alert.alert("Correo inválido", "Ingresa un correo de contacto válido.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Campo requerido", "Ingresa tu número de teléfono.");
      return;
    }
    if (!selectedPlan) {
      Alert.alert("Plan requerido", "Selecciona el plan de tu interés.");
      return;
    }
    if (!selectedUserCount) {
      Alert.alert("Usuarios requerido", "Selecciona el rango de usuarios estimados.");
      return;
    }

    setSending(true);
    try {
      const data = await api.contactSales({
        gymName: gymName.trim(),
        contactEmail: contactEmail.trim().toLowerCase(),
        phone: phone.trim(),
        plan: selectedPlan,
        userCount: selectedUserCount,
        needs: needs.trim() || undefined,
      });
      Alert.alert(
        "¡Solicitud enviada!",
        data.message,
        [{ text: "Entendido", onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo enviar la solicitud. Intenta nuevamente.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <LinearGradient colors={palette.gradientHero} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={palette.cocoa} />
              <Text style={styles.backText}>Volver</Text>
            </TouchableOpacity>

            <Text style={styles.eyebrow}>GymAI</Text>
            <Text style={styles.title}>Registra tu gimnasio</Text>
            <Text style={styles.subtitle}>
              Completa el formulario y un agente de ventas se pondrá en contacto contigo a la brevedad.
            </Text>

            {/* Gym name */}
            <Text style={styles.label}>Nombre del gimnasio *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Fitness Center Monterrey"
              placeholderTextColor={palette.textSoft}
              value={gymName}
              onChangeText={setGymName}
            />

            {/* Contact email */}
            <Text style={styles.label}>Correo de contacto *</Text>
            <TextInput
              style={styles.input}
              placeholder="contacto@migym.com"
              placeholderTextColor={palette.textSoft}
              keyboardType="email-address"
              autoCapitalize="none"
              value={contactEmail}
              onChangeText={setContactEmail}
            />

            {/* Phone */}
            <Text style={styles.label}>Número de teléfono *</Text>
            <TextInput
              style={styles.input}
              placeholder="+52 81 0000 0000"
              placeholderTextColor={palette.textSoft}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            {/* Plan selector */}
            <Text style={styles.label}>Paquete de interés *</Text>
            <View style={styles.chipRow}>
              {PLANS.map((plan) => (
                <View key={plan.id} style={styles.planChipWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.chip,
                      selectedPlan === plan.id && styles.chipActive,
                    ]}
                    onPress={() => setSelectedPlan(plan.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedPlan === plan.id && styles.chipTextActive,
                      ]}
                    >
                      {plan.label}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.tooltipButton}
                    onPress={() => setTooltipPlan(plan.id)}
                  >
                    <MaterialCommunityIcons name="help-circle-outline" size={18} color={palette.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* User count selector */}
            <Text style={styles.label}>Cantidad de usuarios estimados *</Text>
            <View style={styles.chipRow}>
              {USER_COUNT_RANGES.map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.chip,
                    selectedUserCount === range && styles.chipActive,
                  ]}
                  onPress={() => setSelectedUserCount(range)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedUserCount === range && styles.chipTextActive,
                    ]}
                  >
                    {range}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Needs */}
            <Text style={styles.label}>¿Qué necesitas en este momento? <Text style={styles.optional}>(Opcional)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Contanos sobre tu gimnasio, tus retos actuales o cualquier consulta que tengas..."
              placeholderTextColor={palette.textSoft}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={needs}
              onChangeText={setNeeds}
              maxLength={1000}
            />
            <Text style={styles.charCount}>{needs.length}/1000</Text>

            <AppButton
              label={sending ? "Enviando..." : "Enviar solicitud"}
              onPress={onSubmit}
              disabled={sending}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Plan tooltip modal */}
      <Modal
        visible={tooltipPlan !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTooltipPlan(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTooltipPlan(null)}
        >
          <View style={styles.tooltipCard}>
            <Text style={styles.tooltipTitle}>
              {PLANS.find((p) => p.id === tooltipPlan)?.label ?? ""}
            </Text>
            <Text style={styles.tooltipDescription}>
              {PLANS.find((p) => p.id === tooltipPlan)?.description ?? ""}
            </Text>
            <TouchableOpacity style={styles.tooltipClose} onPress={() => setTooltipPlan(null)}>
              <Text style={styles.tooltipCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 24,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.cocoa,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 14,
  },
  eyebrow: {
    color: palette.moss,
    fontWeight: "700",
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    color: palette.ink,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: palette.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    color: palette.ink,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  optional: {
    color: palette.textMuted,
    fontWeight: "400",
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: palette.cream,
    color: palette.ink,
  },
  textArea: {
    height: 100,
    marginBottom: 4,
  },
  charCount: {
    color: palette.textMuted,
    fontSize: 11,
    textAlign: "right",
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  planChipWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: palette.cream,
  },
  chipActive: {
    backgroundColor: palette.cocoa,
    borderColor: palette.cocoa,
  },
  chipText: {
    color: palette.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  tooltipButton: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  tooltipCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    gap: 10,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
  },
  tooltipDescription: {
    color: palette.textMuted,
    lineHeight: 20,
  },
  tooltipClose: {
    alignSelf: "flex-end",
    marginTop: 8,
    backgroundColor: palette.cocoa,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tooltipCloseText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
