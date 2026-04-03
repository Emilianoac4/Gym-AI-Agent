import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { MessageThread } from "../../types/api";
import { palette } from "../../theme/palette";

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

export function MyMessagesScreen({ navigation }: { navigation: any }) {
  const { token, user } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      api
        .getMyThreads(token)
        .then((res) => setThreads(res.threads))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token]),
  );

  const onOpenThread = (thread: MessageThread) => {
    const otherUserName = user?.id === thread.adminUserId ? thread.memberName : thread.adminName;
    navigation.navigate("MessageConversation", {
      threadId: thread.id,
      otherUserName,
    });
  };

  return (
    <ScrollView style={styles.shell} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Mis mensajes</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={palette.cocoa} style={{ marginTop: 40 }} />
      ) : threads.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyText}>No tienes mensajes aún.</Text>
          <Text style={styles.emptySubtext}>
            El administrador del gimnasio puede enviarte mensajes personalizados aquí.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {threads.map((thread, idx) => {
            const otherName =
              user?.id === thread.adminUserId ? thread.memberName : thread.adminName;
            return (
              <TouchableOpacity
                key={thread.id}
                style={[
                  styles.threadRow,
                  idx < threads.length - 1 && styles.threadRowBorder,
                ]}
                onPress={() => onOpenThread(thread)}
              >
                <View style={styles.threadAvatar}>
                  <Text style={styles.threadAvatarText}>
                    {otherName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.threadInfo}>
                  <Text style={styles.threadName}>{otherName}</Text>
                  {thread.lastMessage ? (
                    <Text style={styles.threadLast} numberOfLines={1}>
                      {thread.lastMessage.senderUserId === user?.id ? "Tú: " : ""}
                      {thread.lastMessage.body}
                    </Text>
                  ) : (
                    <Text style={styles.threadLast}>Sin mensajes aún</Text>
                  )}
                </View>
                <View style={styles.threadMetaCol}>
                  {thread.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{thread.unreadCount}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.threadTime}>
                    {thread.lastMessage ? formatRelativeTime(thread.lastMessage.createdAt) : ""}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: Platform.OS === "ios" ? 50 : 14,
  },
  backButton: { paddingRight: 10 },
  backIcon: { fontSize: 28, color: palette.cocoa, lineHeight: 30 },
  screenTitle: { fontSize: 22, fontWeight: "800", color: palette.cocoa },

  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: "700", color: palette.cocoa, marginBottom: 8 },
  emptySubtext: { fontSize: 13, color: palette.textMuted, textAlign: "center", paddingHorizontal: 20 },

  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: "hidden",
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  threadRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  threadAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.sand,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  threadAvatarText: { fontSize: 16, fontWeight: "700", color: palette.cocoa },
  threadInfo: { flex: 1 },
  threadName: { fontSize: 14, fontWeight: "700", color: palette.ink },
  threadLast: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  threadMetaCol: { alignItems: "flex-end", gap: 4 },
  threadTime: { fontSize: 11, color: palette.textMuted },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: palette.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: palette.white,
    fontSize: 11,
    fontWeight: "800",
  },
});
