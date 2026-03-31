import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  text: "Hola! Soy tu coach de IA. Preguntame sobre entrenamiento, nutricion o recuperacion.",
};

export function ChatScreen() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const listRef = useRef<FlatList<Message>>(null);

  const loadHistory = useCallback(async () => {
    if (!user || !token) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    try {
      const data = await api.getChatHistory(user.id, token, 30);
      const ordered = [...data.history].reverse();
      const historyMessages = ordered.flatMap((entry) => {
        const rows: Message[] = [];

        if (entry.userMessage) {
          rows.push({
            id: `${entry.id}-u`,
            role: "user",
            text: entry.userMessage,
          });
        }

        if (entry.aiResponse) {
          rows.push({
            id: `${entry.id}-a`,
            role: "assistant",
            text: entry.aiResponse,
          });
        }

        return rows;
      });

      setMessages(historyMessages.length > 0 ? historyMessages : [WELCOME_MESSAGE]);
    } catch (error) {
      setMessages([WELCOME_MESSAGE]);
    } finally {
      setLoadingHistory(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [token, user]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !user || !token || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.askCoach(user.id, token, text);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data.response,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `Error consultando al coach: ${message}`,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAI}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Coach IA</Text>
        <Text style={styles.subtitle}>Tu entrenador personal inteligente</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        refreshing={loadingHistory}
        onRefresh={loadHistory}
      />

      {loading && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={palette.ocean} />
          <Text style={styles.typingText}>Coach escribiendo...</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe tu pregunta..."
          placeholderTextColor="#8FA0AE"
          multiline
          maxLength={500}
          onSubmitEditing={onSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.snow,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: palette.snow,
    borderBottomWidth: 1,
    borderBottomColor: "#E2ECF2",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.ink,
  },
  subtitle: {
    color: "#556977",
    fontSize: 13,
    marginTop: 2,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bubbleUser: {
    backgroundColor: palette.ocean,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2ECF2",
  },
  bubbleTextUser: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextAI: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 8,
  },
  typingText: {
    color: "#8FA0AE",
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2ECF2",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CFD9DF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: palette.ink,
    backgroundColor: "#FAFCFD",
  },
  sendBtn: {
    backgroundColor: palette.ocean,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendBtnDisabled: {
    backgroundColor: "#B0C4CF",
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
