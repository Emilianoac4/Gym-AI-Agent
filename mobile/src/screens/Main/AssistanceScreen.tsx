import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { AssistanceRequest } from "../../types/api";
import { palette } from "../../theme/palette";

const STATUS_LABEL: Record<string, string> = {
  CREATED: "En espera",
  ASSIGNED: "Asignada",
  IN_PROGRESS: "En progreso",
  RESOLVED: "Resuelta",
  RATED: "Calificada",
};

const STATUS_COLOR: Record<string, string> = {
  CREATED: palette.gold,
  ASSIGNED: palette.coral,
  IN_PROGRESS: palette.moss,
  RESOLVED: palette.moss,
  RATED: palette.textMuted,
};



function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLOR[status] ?? palette.line }]}>
      <Text style={styles.badgeText}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

function RequestCard({
  item,
  onRate,
}: {
  item: AssistanceRequest;
  onRate: (id: string) => void;
}) {
  const date = new Date(item.createdAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <StatusBadge status={item.status} />
        <Text style={styles.cardDate}>{date}</Text>
      </View>
      <Text style={styles.cardDescription}>{item.description}</Text>
      {item.resolution ? (
        <View style={styles.resolutionBox}>
          <Text style={styles.resolutionLabel}>Resolución</Text>
          <Text style={styles.resolutionText}>{item.resolution}</Text>
        </View>
      ) : null}
      {item.status === "RESOLVED" && (
        <TouchableOpacity style={styles.rateButton} onPress={() => onRate(item.id)}>
          <Text style={styles.rateButtonText}>Calificar atención</Text>
        </TouchableOpacity>
      )}
      {item.status === "RATED" && item.rating ? (
        <Text style={styles.ratingText}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)} — Tu calificación</Text>
      ) : null}
    </View>
  );
}

export function AssistanceScreen() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const [hasOpenRequest, setHasOpenRequest] = useState(false);

  // New request modal
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Rate modal
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [rating, setRating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.listMyAssistanceRequests(token);
      setRequests(data.requests);
      setHasOpenRequest(
        data.requests.some((r) =>
          ["CREATED", "ASSIGNED", "IN_PROGRESS"].includes(r.status),
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar solicitudes";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onSubmit = async () => {
    if (!token) return;
    if (!description.trim()) {
      Alert.alert("Campo requerido", "Describe el motivo de tu solicitud.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createAssistanceRequest(token, {
        description: description.trim(),
      });
      setModalVisible(false);
      setDescription("");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al crear solicitud";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onOpenRateModal = (id: string) => {
    setRatingId(id);
    setSelectedRating(5);
    setRateModalVisible(true);
  };

  const onSubmitRating = async () => {
    if (!token || !ratingId) return;
    setRating(true);
    try {
      await api.rateAssistanceRequest(token, ratingId, { rating: selectedRating });
      setRateModalVisible(false);
      setRatingId(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al calificar";
      Alert.alert("Error", msg);
    } finally {
      setRating(false);
    }
  };

  return (
    <View style={styles.shell}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Solicitudes</Text>
        {!hasOpenRequest && (
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.newButtonText}>+ Nueva</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={palette.cocoa} />
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🙋</Text>
          <Text style={styles.emptyTitle}>Sin solicitudes</Text>
          <Text style={styles.emptyBody}>
            Cuando necesites ayuda de un entrenador, crea una nueva solicitud.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {hasOpenRequest && (
            <View style={styles.activeBanner}>
              <Text style={styles.activeBannerText}>
                Tienes una solicitud activa — espera a ser asistido.
              </Text>
            </View>
          )}
          {requests.map((item) => (
            <RequestCard key={item.id} item={item} onRate={onOpenRateModal} />
          ))}
        </ScrollView>
      )}

      {/* New request modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva solicitud</Text>

            <Text style={styles.modalLabel}>¿En qué necesitas ayuda?</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe tu solicitud..."
              placeholderTextColor={palette.textMuted}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={() => void onSubmit()}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? "Enviando..." : "Enviar solicitud"}
              </Text>
            </TouchableOpacity>
            <Pressable onPress={() => setModalVisible(false)} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Cancelar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rate modal */}
      <Modal visible={rateModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Calificar atención</Text>
            <Text style={styles.modalLabel}>¿Qué tan satisfecho quedaste? (1-5)</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setSelectedRating(star)}>
                  <Text style={[styles.star, star <= selectedRating && styles.starActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.submitButton, rating && styles.buttonDisabled]}
              onPress={() => void onSubmitRating()}
              disabled={rating}
            >
              <Text style={styles.submitButtonText}>
                {rating ? "Enviando..." : "Enviar calificación"}
              </Text>
            </TouchableOpacity>
            <Pressable
              onPress={() => setRateModalVisible(false)}
              style={styles.cancelLink}
            >
              <Text style={styles.cancelLinkText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.cocoa,
  },
  newButton: {
    backgroundColor: palette.cocoa,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.gold,
  },
  newButtonText: {
    color: palette.gold,
    fontWeight: "700",
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  activeBanner: {
    backgroundColor: palette.sand,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: palette.gold,
  },
  activeBannerText: {
    color: palette.cocoa,
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardDate: {
    color: palette.textMuted,
    fontSize: 12,
  },
  cardDescription: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
  },
  badgeText: {
    color: palette.cocoa,
    fontSize: 11,
    fontWeight: "700",
  },
  resolutionBox: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: palette.line,
  },
  resolutionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.textMuted,
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 13,
    color: palette.ink,
    lineHeight: 18,
  },
  rateButton: {
    backgroundColor: palette.moss,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  rateButtonText: {
    color: palette.white,
    fontWeight: "700",
    fontSize: 13,
  },
  ratingText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.cocoa,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.cocoa,
  },
  modalLabel: {
    fontSize: 14,
    color: palette.textMuted,
  },
  typeMenuTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.surface,
  },
  typeMenuTriggerText: {
    fontSize: 14,
    color: palette.ink,
    flex: 1,
  },
  typeMenuChevron: {
    fontSize: 11,
    color: palette.textMuted,
    marginLeft: 8,
  },
  typeMenuList: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: -4,
  },
  typeMenuOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  typeMenuOptionActive: {
    backgroundColor: palette.sand,
  },
  typeMenuOptionText: {
    fontSize: 14,
    color: palette.ink,
  },
  typeMenuOptionTextActive: {
    color: palette.cocoa,
    fontWeight: "700",
  },
  typePill: {
    alignSelf: "flex-start",
    backgroundColor: palette.sand,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: palette.gold,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.cocoa,
  },
  textArea: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 12,
    color: palette.ink,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
    backgroundColor: palette.surface,
  },
  submitButton: {
    backgroundColor: palette.cocoa,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.gold,
  },
  submitButtonText: {
    color: palette.gold,
    fontWeight: "700",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelLinkText: {
    color: palette.textMuted,
    fontSize: 14,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 8,
  },
  star: {
    fontSize: 36,
    color: palette.line,
  },
  starActive: {
    color: palette.gold,
  },
});
