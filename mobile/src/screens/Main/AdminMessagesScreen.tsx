import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { GeneralNotification, MessageThread } from "../../types/api";
import { palette } from "../../theme/palette";

type NotificationCategory = "schedule" | "pricing" | "event" | "maintenance" | "general";

const CATEGORIES: { value: NotificationCategory; label: string; emoji: string }[] = [
  { value: "general", label: "Aviso general", emoji: "📢" },
  { value: "schedule", label: "Cambio de horario", emoji: "🕐" },
  { value: "pricing", label: "Cambio de tarifa", emoji: "💰" },
  { value: "event", label: "Evento especial", emoji: "🎉" },
  { value: "maintenance", label: "Mantenimiento", emoji: "🔧" },
];

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  general: "Aviso general",
  schedule: "Cambio de horario",
  pricing: "Cambio de tarifa",
  event: "Evento especial",
  maintenance: "Mantenimiento",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

export function AdminMessagesScreen({ navigation }: { navigation: any }) {
  const { token, user } = useAuth();

  /* ── general notification state ── */
  const [genTitle, setGenTitle] = useState("");
  const [genBody, setGenBody] = useState("");
  const [genCategory, setGenCategory] = useState<NotificationCategory>("general");
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [sendingGen, setSendingGen] = useState(false);
  const [pastNotifications, setPastNotifications] = useState<GeneralNotification[]>([]);

  /* ── direct messages state ── */
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  /* ── new conversation modal ── */
  const [newConvModalVisible, setNewConvModalVisible] = useState(false);
  const [users, setUsers] = useState<{ id: string; fullName: string; role: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [startingThread, setStartingThread] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoadingThreads(true);
    try {
      const [notifRes, threadRes] = await Promise.all([
        api.listGeneralNotifications(token),
        api.getMyThreads(token),
      ]);
      setPastNotifications(notifRes.notifications);
      setThreads(threadRes.threads);
    } catch {
      // silent
    } finally {
      setLoadingThreads(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  /* ── send general notification ── */
  const onSendGeneral = async () => {
    if (!token) return;
    const t = genTitle.trim();
    const b = genBody.trim();
    if (!t || !b) {
      Alert.alert("Campos vacíos", "Ingresa un título y cuerpo para la notificación.");
      return;
    }
    setSendingGen(true);
    try {
      await api.sendGeneralNotification(token, { title: t, body: b, category: genCategory });
      setGenTitle("");
      setGenBody("");
      Alert.alert("Enviada", "Notificación enviada a todos los miembros.");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo enviar la notificación.");
    } finally {
      setSendingGen(false);
    }
  };

  /* ── open new conversation modal ── */
  const openNewConvModal = async () => {
    if (!token) return;
    setNewConvModalVisible(true);
    setUserSearch("");
    setLoadingUsers(true);
    try {
      const res = await api.listUsers(token);
      setUsers(
        (res.users as any[])
          .filter((u: any) => u.id !== user?.id)
          .map((u: any) => ({ id: u.id, fullName: u.fullName, role: u.role })),
      );
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const onStartConversation = async (targetUserId: string, targetName: string) => {
    if (!token) return;
    setStartingThread(targetUserId);
    try {
      const res = await api.getOrCreateThread(token, { targetUserId });
      setNewConvModalVisible(false);
      navigation.navigate("MessageConversation", {
        threadId: res.thread.id,
        otherUserName: targetName,
        initialMessages: res.messages,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo abrir la conversación.");
    } finally {
      setStartingThread(null);
    }
  };

  const onOpenThread = (thread: MessageThread) => {
    navigation.navigate("MessageConversation", {
      threadId: thread.id,
      otherUserName: thread.memberName,
    });
  };

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(userSearch.toLowerCase()),
  );

  return (
    <ScrollView style={styles.shell} contentContainerStyle={styles.content}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Mensajes</Text>
      </View>

      {/* ══ Block 1: General Notification ══ */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📢 Notificación General</Text>
        <Text style={styles.cardSubtitle}>
          Envía un aviso a todos los miembros del gimnasio.
        </Text>

        {/* Category selector */}
        <TouchableOpacity
          style={styles.categorySelector}
          onPress={() => setCategoryPickerVisible(true)}
        >
          <Text style={styles.categorySelectorText}>
            {CATEGORIES.find((c) => c.value === genCategory)?.emoji}{" "}
            {CATEGORY_LABEL[genCategory]}
          </Text>
          <Text style={styles.categorySelectorChevron}>▾</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.inputField}
          placeholder="Título (ej: Cambio de horario esta semana)"
          placeholderTextColor={palette.textMuted}
          value={genTitle}
          onChangeText={setGenTitle}
          maxLength={100}
        />

        <TextInput
          style={[styles.inputField, styles.inputMultiline]}
          placeholder="Detalle del aviso..."
          placeholderTextColor={palette.textMuted}
          value={genBody}
          onChangeText={setGenBody}
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        <TouchableOpacity
          style={[styles.primaryButton, sendingGen && styles.buttonDisabled]}
          onPress={onSendGeneral}
          disabled={sendingGen}
        >
          {sendingGen ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Enviar a todos los miembros</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Past general notifications ── */}
      {pastNotifications.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historial de avisos</Text>
          {pastNotifications.slice(0, 5).map((n) => (
            <View key={n.id} style={styles.notifRow}>
              <View style={styles.notifDot} />
              <View style={styles.notifInfo}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifMeta}>
                  {CATEGORY_LABEL[n.category as NotificationCategory] ?? n.category} ·{" "}
                  {formatRelativeTime(n.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ══ Block 2: Direct Messages ══ */}
      <View style={styles.card}>
        <View style={styles.directHeader}>
          <Text style={styles.cardTitle}>💬 Mensajes Directos</Text>
          <TouchableOpacity style={styles.newConvButton} onPress={openNewConvModal}>
            <Text style={styles.newConvButtonText}>+ Nueva conversación</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.cardSubtitle}>
          Las conversaciones expiran a los 5 días. Se inicia una nueva al retomar contacto.
        </Text>

        {loadingThreads ? (
          <ActivityIndicator size="small" color={palette.cocoa} style={{ marginTop: 12 }} />
        ) : threads.length === 0 ? (
          <Text style={styles.emptyText}>Aún no hay conversaciones activas.</Text>
        ) : (
          threads.map((thread) => (
            <TouchableOpacity
              key={thread.id}
              style={styles.threadRow}
              onPress={() => onOpenThread(thread)}
            >
              <View style={styles.threadAvatar}>
                <Text style={styles.threadAvatarText}>
                  {thread.memberName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.threadInfo}>
                <Text style={styles.threadName}>{thread.memberName}</Text>
                {thread.lastMessage ? (
                  <Text style={styles.threadLast} numberOfLines={1}>
                    {thread.lastMessage.senderUserId === user?.id ? "Tú: " : ""}
                    {thread.lastMessage.body}
                  </Text>
                ) : (
                  <Text style={styles.threadLast}>Sin mensajes aún</Text>
                )}
              </View>
              <Text style={styles.threadTime}>
                {thread.lastMessage ? formatRelativeTime(thread.lastMessage.createdAt) : ""}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* ── Category Picker Modal ── */}
      <Modal
        visible={categoryPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCategoryPickerVisible(false)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Tipo de notificación</Text>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[
                  styles.pickerOption,
                  genCategory === c.value && styles.pickerOptionActive,
                ]}
                onPress={() => {
                  setGenCategory(c.value);
                  setCategoryPickerVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    genCategory === c.value && styles.pickerOptionTextActive,
                  ]}
                >
                  {c.emoji} {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── New Conversation Modal ── */}
      <Modal
        visible={newConvModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewConvModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.userPickerSheet}>
            <View style={styles.userPickerHeader}>
              <Text style={styles.pickerTitle}>Seleccionar usuario</Text>
              <TouchableOpacity onPress={() => setNewConvModalVisible(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchField}
              placeholder="Buscar por nombre..."
              placeholderTextColor={palette.textMuted}
              value={userSearch}
              onChangeText={setUserSearch}
            />
            {loadingUsers ? (
              <ActivityIndicator size="small" color={palette.cocoa} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={(u) => u.id}
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => onStartConversation(item.id, item.fullName)}
                    disabled={startingThread === item.id}
                  >
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>
                        {item.fullName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.fullName}</Text>
                      <Text style={styles.userRole}>
                        {item.role === "trainer" ? "Entrenador" : "Miembro"}
                      </Text>
                    </View>
                    {startingThread === item.id && (
                      <ActivityIndicator size="small" color={palette.cocoa} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Sin resultados</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40 },

  header: { marginBottom: 12, marginTop: Platform.OS === "ios" ? 50 : 20 },
  screenTitle: { fontSize: 22, fontWeight: "800", color: palette.cocoa },

  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: palette.cocoa, marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: palette.textMuted, marginBottom: 12 },

  categorySelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: palette.sand,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.line,
  },
  categorySelectorText: { fontSize: 13, color: palette.cocoa, fontWeight: "600" },
  categorySelectorChevron: { fontSize: 14, color: palette.textMuted },

  inputField: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: palette.ink,
    marginBottom: 10,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top", paddingTop: 10 },

  primaryButton: {
    backgroundColor: palette.cocoa,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: palette.white, fontWeight: "700", fontSize: 13 },

  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.gold,
    marginRight: 10,
  },
  notifInfo: { flex: 1 },
  notifTitle: { fontSize: 13, color: palette.ink, fontWeight: "600" },
  notifMeta: { fontSize: 11, color: palette.textMuted, marginTop: 2 },

  directHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  newConvButton: {
    backgroundColor: palette.sand,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: palette.line,
  },
  newConvButtonText: { fontSize: 12, color: palette.cocoa, fontWeight: "600" },

  emptyText: { fontSize: 13, color: palette.textMuted, textAlign: "center", paddingVertical: 12 },

  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  threadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.sand,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: palette.line,
  },
  threadAvatarText: { fontSize: 16, fontWeight: "700", color: palette.cocoa },
  threadInfo: { flex: 1 },
  threadName: { fontSize: 14, fontWeight: "700", color: palette.ink },
  threadLast: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  threadTime: { fontSize: 11, color: palette.textMuted },

  // modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  pickerTitle: { fontSize: 16, fontWeight: "700", color: palette.cocoa, marginBottom: 14 },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  pickerOptionActive: { backgroundColor: palette.sand },
  pickerOptionText: { fontSize: 14, color: palette.ink },
  pickerOptionTextActive: { fontWeight: "700", color: palette.cocoa },

  userPickerSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "80%",
    flex: 1,
    marginTop: "20%",
  },
  userPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  closeText: { fontSize: 18, color: palette.textMuted },

  searchField: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: palette.ink,
    marginBottom: 12,
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.sand,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: palette.line,
  },
  userAvatarText: { fontSize: 14, fontWeight: "700", color: palette.cocoa },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: "600", color: palette.ink },
  userRole: { fontSize: 12, color: palette.textMuted, marginTop: 1 },
});
