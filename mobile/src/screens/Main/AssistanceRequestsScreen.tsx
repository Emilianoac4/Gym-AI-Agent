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

type ActionType = "assign" | "resolve";

function RequestCard({
  item,
  myId,
  onAction,
}: {
  item: AssistanceRequest;
  myId: string;
  onAction: (id: string, action: ActionType) => void;
}) {
  const date = new Date(item.createdAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const isMyRequest = item.trainerId === myId;
  const canAssign = item.status === "CREATED";
  const canResolve =
    isMyRequest && (item.status === "ASSIGNED" || item.status === "IN_PROGRESS");

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
      {item.rating ? (
        <Text style={styles.ratingText}>
          {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)} — Calificación del miembro
        </Text>
      ) : null}
      {canAssign && (
        <TouchableOpacity
          style={styles.assignButton}
          onPress={() => onAction(item.id, "assign")}
        >
          <Text style={styles.assignButtonText}>Tomar solicitud</Text>
        </TouchableOpacity>
      )}
      {canResolve && (
        <TouchableOpacity
          style={styles.resolveButton}
          onPress={() => onAction(item.id, "resolve")}
        >
          <Text style={styles.resolveButtonText}>Marcar como resuelta</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function AssistanceRequestsScreen() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);

  // Resolve modal
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);

  // Assign confirm
  const [assigning, setAssigning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.listAssistanceRequests(token);
      setRequests(data.requests);
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

  const onAction = (id: string, action: ActionType) => {
    if (action === "assign") {
      Alert.alert(
        "Tomar solicitud",
        "¿Confirmas que deseas asignarte esta solicitud?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: () => void doAssign(id) },
        ],
      );
    } else {
      setResolveId(id);
      setResolution("");
      setResolveModalVisible(true);
    }
  };

  const doAssign = async (id: string) => {
    if (!token) return;
    setAssigning(id);
    try {
      await api.assignAssistanceRequest(token, id);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al asignar solicitud";
      Alert.alert("Error", msg);
    } finally {
      setAssigning(null);
    }
  };

  const onSubmitResolve = async () => {
    if (!token || !resolveId) return;
    if (!resolution.trim()) {
      Alert.alert("Campo requerido", "Describe cómo resolviste la solicitud.");
      return;
    }
    setResolving(true);
    try {
      await api.resolveAssistanceRequest(token, resolveId, {
        resolution: resolution.trim(),
      });
      setResolveModalVisible(false);
      setResolveId(null);
      setResolution("");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al resolver solicitud";
      Alert.alert("Error", msg);
    } finally {
      setResolving(false);
    }
  };

  const pending = requests.filter((r) => r.status === "CREATED");
  const mine = requests.filter(
    (r) =>
      r.trainerId === user?.id &&
      (r.status === "ASSIGNED" || r.status === "IN_PROGRESS"),
  );
  const history = requests.filter(
    (r) =>
      r.trainerId === user?.id &&
      (r.status === "RESOLVED" || r.status === "RATED"),
  );

  return (
    <View style={styles.shell}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Solicitudes</Text>
        <TouchableOpacity onPress={() => void load()}>
          <Text style={styles.refreshText}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={palette.cocoa} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* Pending section */}
          {pending.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Pendientes ({pending.length})
              </Text>
              {pending.map((item) => (
                <RequestCard
                  key={item.id}
                  item={item}
                  myId={user?.id ?? ""}
                  onAction={onAction}
                />
              ))}
            </>
          )}

          {/* My active assignments */}
          {mine.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Mis asignaciones ({mine.length})
              </Text>
              {mine.map((item) => (
                <RequestCard
                  key={item.id}
                  item={item}
                  myId={user?.id ?? ""}
                  onAction={onAction}
                />
              ))}
            </>
          )}

          {/* History */}
          {history.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Resueltas recientes</Text>
              {history.map((item) => (
                <RequestCard
                  key={item.id}
                  item={item}
                  myId={user?.id ?? ""}
                  onAction={onAction}
                />
              ))}
            </>
          )}

          {pending.length === 0 && mine.length === 0 && history.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>Sin solicitudes</Text>
              <Text style={styles.emptyBody}>
                No hay solicitudes pendientes en el gimnasio en este momento.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Resolve modal */}
      <Modal visible={resolveModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Resolver solicitud</Text>
                <Text style={styles.modalLabel}>Describe cómo resolviste el problema:</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Ej: Enseñé la técnica correcta para sentadillas..."
                  placeholderTextColor={palette.textMuted}
                  multiline
                  numberOfLines={4}
                  value={resolution}
                  onChangeText={setResolution}
                />
                <TouchableOpacity
                  style={[styles.submitButton, resolving && styles.buttonDisabled]}
                  onPress={() => void onSubmitResolve()}
                  disabled={resolving}
                >
                  <Text style={styles.submitButtonText}>
                    {resolving ? "Guardando..." : "Marcar resuelta"}
                  </Text>
                </TouchableOpacity>
                <Pressable
                  onPress={() => setResolveModalVisible(false)}
                  style={styles.cancelLink}
                >
                  <Text style={styles.cancelLinkText}>Cancelar</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
  refreshText: {
    color: palette.cocoa,
    fontWeight: "600",
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 4,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 8,
    marginBottom: 8,
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
  ratingText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  assignButton: {
    backgroundColor: palette.cocoa,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.gold,
  },
  assignButtonText: {
    color: palette.gold,
    fontWeight: "700",
    fontSize: 13,
  },
  resolveButton: {
    backgroundColor: palette.moss,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  resolveButtonText: {
    color: palette.white,
    fontWeight: "700",
    fontSize: 13,
  },
  emptyState: {
    marginTop: 60,
    alignItems: "center",
    padding: 24,
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
  modalKeyboard: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalScrollContent: {
    flexGrow: 1,
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
});
