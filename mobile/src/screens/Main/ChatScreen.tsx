import React, { useCallback, useRef, useState } from "react";
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
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";
import { AIActionProposal } from "../../types/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  actionProposal?: AIActionProposal;
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
  const [clearing, setClearing] = useState(false);
  const [startingNewConversation, setStartingNewConversation] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  const [selectedDayByProposalId, setSelectedDayByProposalId] = useState<Record<string, string>>({});
  const listRef = useRef<FlatList<Message>>(null);

  const extractAllowedDays = (proposal: AIActionProposal): string[] => {
    const rawDays = proposal.payload.allowedDays;
    if (!Array.isArray(rawDays)) {
      return [];
    }

    return rawDays.filter((day): day is string => typeof day === "string");
  };

  const getDefaultDay = (proposal: AIActionProposal): string | undefined => {
    const suggestedDay = proposal.payload.suggestedDay;
    if (typeof suggestedDay === "string" && suggestedDay.trim().length > 0) {
      return suggestedDay;
    }

    const allowedDays = extractAllowedDays(proposal);
    return allowedDays[0];
  };

  const getSelectedDayForProposal = (proposal: AIActionProposal): string | undefined => {
    const picked = selectedDayByProposalId[proposal.proposalId];
    if (picked) {
      return picked;
    }

    return getDefaultDay(proposal);
  };

  const onSelectProposalDay = (proposalId: string, day: string) => {
    setSelectedDayByProposalId((prev) => ({
      ...prev,
      [proposalId]: day,
    }));
  };

  const appendAssistantMessage = (text: string, actionProposal?: AIActionProposal) => {
    const aiMsg: Message = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      role: "assistant",
      text,
      actionProposal,
    };

    setMessages((prev) => [...prev, aiMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const markProposalAsResolved = (
    proposalId: string,
    status: "APPLIED" | "REJECTED" | "FAILED"
  ) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.actionProposal?.proposalId !== proposalId) {
          return message;
        }

        return {
          ...message,
          actionProposal: {
            ...message.actionProposal,
            status,
          },
        };
      })
    );
  };

  const getHistoryStatus = () => {
    if (loadingHistory) {
      return "Sincronizando historial...";
    }

    if (!lastSyncAt) {
      return "Historial sin sincronizacion reciente";
    }

    const hours = String(lastSyncAt.getHours()).padStart(2, "0");
    const minutes = String(lastSyncAt.getMinutes()).padStart(2, "0");
    return `Historial sincronizado ${hours}:${minutes}`;
  };

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
      setLastSyncAt(new Date());
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

  const onClearChat = () => {
    if (!user || !token || clearing) {
      return;
    }

    Alert.alert(
      "Limpiar chat",
      "Se eliminara el historial de esta conversacion. Esta accion no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              await api.clearChatHistory(user.id, token);
              setMessages([WELCOME_MESSAGE]);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Error inesperado";
              Alert.alert("No se pudo limpiar", message);
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text || !user || !token || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.askCoach(user.id, token, text, {
        startNewConversation: startingNewConversation,
      });
      appendAssistantMessage(data.response, data.actionProposal);
      setStartingNewConversation(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      appendAssistantMessage(`Error consultando al coach: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const onConfirmProposal = async (proposal: AIActionProposal) => {
    if (!user || !token || pendingProposalId) {
      return;
    }

    setPendingProposalId(proposal.proposalId);
    try {
      const selectedDay = proposal.type === "exercise_add" ? getSelectedDayForProposal(proposal) : undefined;
      const result = await api.confirmActionProposal(user.id, proposal.proposalId, token, {
        selectedDay,
      });

      markProposalAsResolved(proposal.proposalId, "APPLIED");

      const routineApplied = Boolean(result.routine);
      appendAssistantMessage(
        routineApplied
          ? "Listo. Ya apliqué la accion en tu rutina y puedes verla en tu seccion de rutinas."
          : "Listo. La accion fue confirmada correctamente."
      );
    } catch (error) {
      markProposalAsResolved(proposal.proposalId, "FAILED");
      const message = error instanceof Error ? error.message : "Error inesperado";
      appendAssistantMessage(`No pude aplicar la accion: ${message}`);
    } finally {
      setPendingProposalId(null);
    }
  };

  const onRejectProposal = async (proposal: AIActionProposal) => {
    if (!user || !token || pendingProposalId) {
      return;
    }

    setPendingProposalId(proposal.proposalId);
    try {
      await api.rejectActionProposal(user.id, proposal.proposalId, token, {
        reason: "Usuario rechazo la propuesta desde chat",
      });
      markProposalAsResolved(proposal.proposalId, "REJECTED");
      appendAssistantMessage("Entendido. No apliqué ese cambio. Si quieres, te propongo una alternativa.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      appendAssistantMessage(`No pude rechazar la propuesta: ${message}`);
    } finally {
      setPendingProposalId(null);
    }
  };

  const onStartNewConversation = () => {
    if (loading || loadingHistory || clearing) {
      return;
    }

    setMessages([WELCOME_MESSAGE]);
    setStartingNewConversation(true);
    setInput("");
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const proposal = item.actionProposal;
    const proposalIsPending = proposal?.status === "PROPOSED";
    const isWorkingProposal = proposal ? pendingProposalId === proposal.proposalId : false;
    const allowedDays = proposal ? extractAllowedDays(proposal) : [];
    const selectedDay = proposal ? getSelectedDayForProposal(proposal) : undefined;

    return (
      <View style={styles.messageWrap}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAI}>{item.text}</Text>
        </View>

        {!isUser && proposal && (
          <View style={styles.proposalCard}>
            <Text style={styles.proposalTitle}>Accion sugerida</Text>
            <Text style={styles.proposalSummary}>{proposal.summary}</Text>
            <Text style={styles.proposalRationale}>{proposal.rationale}</Text>

            {proposal.type === "exercise_add" && proposalIsPending && allowedDays.length > 0 && (
              <View style={styles.daySelectorWrap}>
                <Text style={styles.daySelectorLabel}>Dia para aplicarlo:</Text>
                <View style={styles.dayChipsRow}>
                  {allowedDays.map((day) => {
                    const isSelected = selectedDay === day;
                    return (
                      <TouchableOpacity
                        key={`${proposal.proposalId}-${day}`}
                        style={[styles.dayChip, isSelected && styles.dayChipActive]}
                        onPress={() => onSelectProposalDay(proposal.proposalId, day)}
                        disabled={isWorkingProposal}
                      >
                        <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {proposalIsPending ? (
              <View style={styles.proposalActions}>
                <TouchableOpacity
                  style={[styles.proposalButton, styles.rejectButton, isWorkingProposal && styles.proposalButtonDisabled]}
                  onPress={() => onRejectProposal(proposal)}
                  disabled={isWorkingProposal}
                >
                  <Text style={styles.rejectButtonText}>Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.proposalButton, styles.confirmButton, isWorkingProposal && styles.proposalButtonDisabled]}
                  onPress={() => onConfirmProposal(proposal)}
                  disabled={isWorkingProposal}
                >
                  <Text style={styles.confirmButtonText}>{isWorkingProposal ? "Aplicando..." : "Confirmar"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.proposalStatus}>Estado: {proposal.status}</Text>
            )}
          </View>
        )}
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
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Coach IA</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={onStartNewConversation}
              disabled={loading || loadingHistory || clearing}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Nueva conversacion</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClearChat}
              disabled={clearing || loadingHistory}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>
                {clearing ? "Limpiando..." : "Limpiar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.subtitle}>Tu entrenador personal inteligente</Text>
        <Text style={styles.syncStatus}>{getHistoryStatus()}</Text>
        {startingNewConversation && (
          <Text style={styles.newConversationHint}>
            Nueva conversacion activa: el proximo mensaje se enviara sin contexto previo.
          </Text>
        )}
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
    backgroundColor: palette.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.ink,
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.line,
  },
  clearButtonText: {
    color: palette.cocoa,
    fontSize: 12,
    fontWeight: "700",
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  syncStatus: {
    color: palette.textSoft,
    fontSize: 12,
    marginTop: 4,
  },
  newConversationHint: {
    marginTop: 6,
    color: palette.coral,
    fontSize: 12,
    fontWeight: "600",
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageWrap: {
    marginBottom: 10,
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: palette.cocoa,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: palette.card,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: palette.line,
  },
  bubbleTextUser: {
    color: palette.cream,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextAI: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  proposalCard: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 2,
  },
  proposalTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.textSoft,
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  proposalSummary: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 6,
  },
  proposalRationale: {
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 18,
  },
  proposalActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  daySelectorWrap: {
    marginTop: 10,
  },
  daySelectorLabel: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  dayChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dayChipActive: {
    backgroundColor: palette.ocean,
    borderColor: palette.ocean,
  },
  dayChipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  dayChipTextActive: {
    color: palette.cream,
  },
  proposalButton: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  proposalButtonDisabled: {
    opacity: 0.6,
  },
  confirmButton: {
    backgroundColor: palette.ocean,
    borderColor: palette.ocean,
  },
  confirmButtonText: {
    color: palette.cream,
    fontWeight: "700",
    fontSize: 13,
  },
  rejectButton: {
    backgroundColor: palette.card,
    borderColor: palette.line,
  },
  rejectButtonText: {
    color: palette.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  proposalStatus: {
    marginTop: 10,
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 8,
  },
  typingText: {
    color: palette.textSoft,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.card,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: palette.ink,
    backgroundColor: palette.cream,
  },
  sendBtn: {
    backgroundColor: palette.gold,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.cocoa,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 14,
  },
});
