import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { DirectMessage } from "../../types/api";
import { palette } from "../../theme/palette";

type RouteParams = {
  threadId: string;
  otherUserName: string;
  initialMessages?: DirectMessage[];
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function groupByDay(messages: DirectMessage[]): { date: string; messages: DirectMessage[] }[] {
  const groups: { date: string; messages: DirectMessage[] }[] = [];
  let currentDate = "";
  messages.forEach((m) => {
    const day = new Date(m.createdAt).toLocaleDateString("es", {
      day: "numeric",
      month: "long",
    });
    if (day !== currentDate) {
      currentDate = day;
      groups.push({ date: day, messages: [] });
    }
    groups[groups.length - 1].messages.push(m);
  });
  return groups;
}

export function MessagesConversationScreen({ route, navigation }: { route: any; navigation: any }) {
  const { threadId, otherUserName, initialMessages } = route.params as RouteParams;
  const { token, user } = useAuth();

  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages ?? []);
  const [loading, setLoading] = useState(!initialMessages);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<any>>(null);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.getThreadMessages(token, threadId);
      setMessages(res.messages);
    } catch (e: any) {
      // conversation may be expired
      if (e?.statusCode === 410 || e?.message?.includes("expirado")) {
        Alert.alert(
          "Conversación expirada",
          "Esta conversación ha expirado. El administrador puede iniciar una nueva.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [token, threadId]);

  useEffect(() => {
    if (!initialMessages) {
      loadMessages();
    } else {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
      const intervalId = setInterval(() => {
        loadMessages();
      }, 5000);

      return () => {
        clearInterval(intervalId);
      };
    }, [loadMessages]),
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  const onSend = async () => {
    const text = inputText.trim();
    if (!text || !token) return;
    setSending(true);
    setInputText("");
    try {
      const res = await api.sendThreadMessage(token, threadId, { body: text });
      setMessages((prev) => [...prev, res.message]);
    } catch (e: any) {
      if (e?.statusCode === 410) {
        Alert.alert(
          "Conversación expirada",
          "Esta conversación ha expirado. El administrador puede iniciar una nueva.",
        );
      } else {
        Alert.alert("Error", e?.message ?? "No se pudo enviar el mensaje.");
      }
      setInputText(text); // restore so user can retry
    } finally {
      setSending(false);
    }
  };

  const groups = groupByDay(messages);

  const renderItem = ({ item }: { item: DirectMessage }) => {
    const isMe = item.senderUserId === user?.id;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
          {item.body}
        </Text>
        <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
          {formatTime(item.createdAt)}
          {isMe && item.readAt ? "  ✓✓" : ""}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator size="large" color={palette.cocoa} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{otherUserName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.headerName}>{otherUserName}</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={groups}
        keyExtractor={(g) => g.date}
        style={styles.list}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        renderItem={({ item: group }) => (
          <View>
            <View style={styles.dateDivider}>
              <View style={styles.dateLine} />
              <Text style={styles.dateLabel}>{group.date}</Text>
              <View style={styles.dateLine} />
            </View>
            {group.messages.map((m: DirectMessage) => (
              <View key={m.id}>{renderItem({ item: m })}</View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              Aún no hay mensajes. ¡Escribe el primero!
            </Text>
          </View>
        }
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={palette.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={onSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Text style={styles.sendIcon}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: palette.background },
  loadingShell: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 56 : 20,
    paddingBottom: 12,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  backButton: { paddingRight: 8 },
  backIcon: { fontSize: 28, color: palette.cocoa, lineHeight: 30 },
  headerAvatar: {
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
  headerAvatarText: { fontSize: 15, fontWeight: "700", color: palette.cocoa },
  headerName: { fontSize: 15, fontWeight: "700", color: palette.cocoa, flex: 1 },

  list: { flex: 1 },

  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: palette.line },
  dateLabel: {
    fontSize: 11,
    color: palette.textMuted,
    marginHorizontal: 8,
  },

  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  bubbleMe: {
    backgroundColor: palette.cocoa,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: palette.card,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: palette.line,
  },
  bubbleText: { fontSize: 14 },
  bubbleTextMe: { color: palette.white },
  bubbleTextThem: { color: palette.ink },
  bubbleTime: { fontSize: 10, marginTop: 3, alignSelf: "flex-end" },
  bubbleTimeMe: { color: "rgba(255,255,255,0.6)" },
  bubbleTimeThem: { color: palette.textMuted },

  emptyWrap: { flex: 1, alignItems: "center", paddingTop: 60 },
  emptyText: { color: palette.textMuted, fontSize: 13 },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.card,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingBottom: Platform.OS === "ios" ? 24 : 8,
  },
  input: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: palette.ink,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.cocoa,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { backgroundColor: palette.line },
  sendIcon: { color: palette.white, fontSize: 20, fontWeight: "700" },
});
