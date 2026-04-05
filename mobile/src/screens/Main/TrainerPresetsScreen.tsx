import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { TrainerRoutineTemplate } from "../../types/api";
import { palette } from "../../theme/palette";

interface GymMember {
  id: string;
  fullName: string;
  isActive: boolean;
}

export function TrainerPresetsScreen({ navigation }: { navigation: any }) {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<TrainerRoutineTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Member picker modal
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [pickerTemplate, setPickerTemplate] = useState<TrainerRoutineTemplate | null>(null);
  const [members, setMembers] = useState<GymMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      api
        .listTrainerTemplates(token)
        .then((res) => setTemplates(res.templates))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [token]),
  );

  const onNewTemplate = () => {
    navigation.navigate("TrainerRoutineBuilder", { mode: "preset" });
  };

  const onDelete = (template: TrainerRoutineTemplate) => {
    Alert.alert(
      "Eliminar plantilla",
      `¿Eliminar "${template.name}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setDeleting(template.id);
            try {
              await api.deleteTrainerTemplate(token, template.id);
              setTemplates((prev) => prev.filter((t) => t.id !== template.id));
            } catch (err) {
              Alert.alert(
                "Error",
                err instanceof Error ? err.message : "No se pudo eliminar la plantilla.",
              );
            } finally {
              setDeleting(null);
            }
          },
        },
      ],
    );
  };

  const onAssignFromTemplate = async (template: TrainerRoutineTemplate) => {
    if (!token) return;
    setPickerTemplate(template);
    setMemberPickerVisible(true);
    setLoadingMembers(true);
    try {
      const res = await api.listUsers(token, "member");
      setMembers(res.users.filter((u) => u.isActive));
    } catch {
      setMemberPickerVisible(false);
    } finally {
      setLoadingMembers(false);
    }
  };

  const onPickMember = (member: GymMember) => {
    setMemberPickerVisible(false);
    if (!pickerTemplate) return;
    navigation.navigate("TrainerRoutineBuilder", {
      mode: "assign",
      memberId: member.id,
      memberName: member.fullName,
      template: pickerTemplate,
    });
  };

  const renderTemplate = ({ item }: { item: TrainerRoutineTemplate }) => (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardPurpose} numberOfLines={2}>{item.purpose}</Text>
        <Text style={styles.cardExercises}>
          {item.exercises.length} ejercicio{item.exercises.length !== 1 ? "s" : ""}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.assignBtn}
          onPress={() => void onAssignFromTemplate(item)}
        >
          <Text style={styles.assignBtnText}>Asignar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() =>
            navigation.navigate("TrainerRoutineBuilder", {
              mode: "edit-preset",
              template: item,
            })
          }
        >
          <Text style={styles.editBtnText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteBtn, deleting === item.id && { opacity: 0.5 }]}
          onPress={() => onDelete(item)}
          disabled={deleting === item.id}
        >
          {deleting === item.id ? (
            <ActivityIndicator size="small" color={palette.coral} />
          ) : (
            <Text style={styles.deleteBtnText}>Eliminar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <View style={styles.shell}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Rutinas guardadas</Text>
          <TouchableOpacity style={styles.newBtn} onPress={onNewTemplate}>
            <Text style={styles.newBtnText}>+ Nueva</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={palette.cocoa} style={{ marginTop: 40 }} />
        ) : templates.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>Sin plantillas guardadas</Text>
            <Text style={styles.emptySubtext}>
              Guarda rutinas para asignarlas rápidamente a tus usuarios.
            </Text>
            <TouchableOpacity style={styles.emptyNewBtn} onPress={onNewTemplate}>
              <Text style={styles.emptyNewBtnText}>Crear primera plantilla</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={templates}
            keyExtractor={(item) => item.id}
            renderItem={renderTemplate}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Member picker modal */}
      <Modal
        visible={memberPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMemberPickerVisible(false)}
      >
        <Pressable style={styles.dimmer} onPress={() => setMemberPickerVisible(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>¿A quién asignar?</Text>
            <Text style={styles.pickerSubtitle}>{pickerTemplate?.name}</Text>

            {loadingMembers ? (
              <ActivityIndicator size="small" color={palette.cocoa} style={{ margin: 24 }} />
            ) : members.length === 0 ? (
              <Text style={styles.pickerEmpty}>No hay usuarios activos.</Text>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(m) => m.id}
                style={styles.pickerList}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.memberRow,
                      index < members.length - 1 && styles.memberRowBorder,
                    ]}
                    onPress={() => onPickMember(item)}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {item.fullName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.memberName}>{item.fullName}</Text>
                    <Text style={styles.memberChevron}>›</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.pickerCancel}
              onPress={() => setMemberPickerVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: palette.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: Platform.OS === "ios" ? 54 : 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    backgroundColor: palette.card,
  },
  backBtn: { paddingRight: 10 },
  backIcon: { fontSize: 28, color: palette.cocoa, lineHeight: 30 },
  screenTitle: { flex: 1, fontSize: 20, fontWeight: "800", color: palette.cocoa },
  newBtn: {
    backgroundColor: palette.cocoa,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  newBtnText: { color: palette.white, fontWeight: "700", fontSize: 13 },

  list: { padding: 16, paddingBottom: 40 },

  emptyWrap: { flex: 1, alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyText: { fontSize: 16, fontWeight: "700", color: palette.cocoa, marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: palette.textMuted, textAlign: "center", lineHeight: 18 },
  emptyNewBtn: {
    marginTop: 20,
    backgroundColor: palette.cocoa,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyNewBtnText: { color: palette.white, fontWeight: "700" },

  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    marginBottom: 12,
  },
  cardBody: { marginBottom: 12 },
  cardName: { fontSize: 15, fontWeight: "800", color: palette.cocoa, marginBottom: 4 },
  cardPurpose: { fontSize: 13, color: palette.textMuted, lineHeight: 18, marginBottom: 6 },
  cardExercises: { fontSize: 12, color: palette.moss, fontWeight: "700" },

  cardActions: { flexDirection: "row", gap: 10 },
  assignBtn: {
    flex: 1,
    backgroundColor: palette.cocoa,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  assignBtnText: { color: palette.white, fontWeight: "700", fontSize: 13 },
  editBtn: {
    borderWidth: 1,
    borderColor: palette.cocoa,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  editBtnText: { color: palette.cocoa, fontWeight: "700", fontSize: 13 },
  deleteBtn: {
    borderWidth: 1,
    borderColor: palette.coral,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  deleteBtnText: { color: palette.coral, fontWeight: "700", fontSize: 13 },

  // Member picker modal
  dimmer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pickerCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    width: "100%",
    maxHeight: "75%",
    paddingTop: 20,
    paddingBottom: 8,
    overflow: "hidden",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.cocoa,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  pickerSubtitle: {
    fontSize: 12,
    color: palette.textMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  pickerEmpty: {
    textAlign: "center",
    color: palette.textMuted,
    margin: 24,
  },
  pickerList: { maxHeight: 320 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.line },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.sand,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: { fontSize: 16, fontWeight: "700", color: palette.cocoa },
  memberName: { flex: 1, fontSize: 14, fontWeight: "600", color: palette.ink },
  memberChevron: { fontSize: 22, color: palette.textMuted },
  pickerCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  pickerCancelText: { color: palette.textMuted, fontSize: 15, fontWeight: "600" },
});
