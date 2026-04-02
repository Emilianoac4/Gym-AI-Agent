import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";

type UserRole = "trainer" | "member";

interface GymUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
  isActive: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  trainer: "Entrenador",
  member: "Usuario",
};

export function AdminUsersScreen() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<GymUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("member");

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const role = filterRole === "all" ? undefined : filterRole;
      const data = await api.listUsers(token, role);
      setUsers(data.users);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "No se pudo cargar la lista de usuarios");
    } finally {
      setLoading(false);
    }
  }, [token, filterRole]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const onCreateUser = async () => {
    if (!newEmail || !newFullName || !newPassword) {
      Alert.alert("Campos requeridos", "Todos los campos son obligatorios.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Contraseña débil", "La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!token) return;
    setCreating(true);
    try {
      await api.createUser(token, {
        email: newEmail.trim().toLowerCase(),
        fullName: newFullName.trim(),
        password: newPassword,
        role: newRole,
      });
      Alert.alert("Usuario creado", `${ROLE_LABELS[newRole]} registrado correctamente.`);
      setShowCreateModal(false);
      setNewEmail("");
      setNewFullName("");
      setNewPassword("");
      setNewRole("member");
      void loadUsers();
    } catch (e) {
      Alert.alert("Error al crear", e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setCreating(false);
    }
  };

  const onDeactivate = (target: GymUser) => {
    Alert.alert(
      "Desactivar usuario",
      `¿Seguro que deseas desactivar a ${target.fullName}? Esta acción puede revertirse.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desactivar",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              await api.deactivateUser(target.id, token);
              void loadUsers();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "No se pudo desactivar");
            }
          },
        },
      ],
    );
  };

  const filteredUsers = users.filter((u) => u.id !== user?.id);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Usuarios</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtro por rol */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {["all", "trainer", "member"].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.filterChip, filterRole === r && styles.filterChipActive]}
            onPress={() => setFilterRole(r)}
          >
            <Text style={[styles.filterChipText, filterRole === r && styles.filterChipTextActive]}>
              {r === "all" ? "Todos" : ROLE_LABELS[r]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator color={palette.moss} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {filteredUsers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No hay usuarios en este filtro.</Text>
            </View>
          ) : (
            filteredUsers.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.fullName}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <View style={[styles.roleBadge, (styles as Record<string, object>)[`role_${u.role}`] ?? styles.role_member]}>
                    <Text style={styles.roleBadgeText}>{ROLE_LABELS[u.role] ?? u.role}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.deactivateBtn} onPress={() => onDeactivate(u)}>
                  <Text style={styles.deactivateBtnText}>Desactivar</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal crear usuario */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Crear usuario</Text>

            {/* Selector de rol */}
            <View style={styles.roleSelector}>
              {(["member", "trainer"] as UserRole[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.rolePill, newRole === r && styles.rolePillActive]}
                  onPress={() => setNewRole(r)}
                >
                  <Text style={[styles.rolePillText, newRole === r && styles.rolePillTextActive]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor={palette.cocoa + "80"}
              value={newFullName}
              onChangeText={setNewFullName}
            />
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              placeholderTextColor={palette.cocoa + "80"}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña temporal (mín. 8 caracteres)"
              placeholderTextColor={palette.cocoa + "80"}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCreateModal(false)}
                disabled={creating}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={onCreateUser} disabled={creating}>
                {creating ? (
                  <ActivityIndicator color={palette.cream} size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Crear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.cream },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: palette.cream,
  },
  title: { fontSize: 22, fontWeight: "700", color: palette.cocoa },
  addBtn: {
    backgroundColor: palette.moss,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: palette.cream, fontWeight: "700", fontSize: 14 },
  filterRow: { paddingHorizontal: 20, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.moss,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: palette.moss },
  filterChipText: { color: palette.moss, fontWeight: "600", fontSize: 13 },
  filterChipTextActive: { color: palette.cream },
  list: { flex: 1, paddingHorizontal: 20 },
  emptyCard: {
    backgroundColor: palette.sand,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    marginTop: 20,
  },
  emptyText: { color: palette.cocoa + "80", fontSize: 14 },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: palette.cocoa,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: "700", color: palette.cocoa, marginBottom: 2 },
  userEmail: { fontSize: 13, color: palette.cocoa + "80", marginBottom: 6 },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  role_member: { backgroundColor: palette.moss + "20" },
  role_trainer: { backgroundColor: palette.gold + "30" },
  role_admin: { backgroundColor: palette.coral + "30" },
  roleBadgeText: { fontSize: 12, fontWeight: "600", color: palette.cocoa },
  deactivateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.coral,
  },
  deactivateBtnText: { color: palette.coral, fontWeight: "600", fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: palette.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: palette.cocoa, marginBottom: 20, textAlign: "center" },
  roleSelector: { flexDirection: "row", marginBottom: 20, gap: 12 },
  rolePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.moss,
    alignItems: "center",
  },
  rolePillActive: { backgroundColor: palette.moss },
  rolePillText: { color: palette.moss, fontWeight: "600", fontSize: 14 },
  rolePillTextActive: { color: palette.cream },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: palette.cocoa,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: palette.sand,
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.cocoa + "40",
    alignItems: "center",
  },
  cancelBtnText: { color: palette.cocoa, fontWeight: "600", fontSize: 15 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: palette.moss,
    alignItems: "center",
  },
  confirmBtnText: { color: palette.cream, fontWeight: "700", fontSize: 15 },
});
