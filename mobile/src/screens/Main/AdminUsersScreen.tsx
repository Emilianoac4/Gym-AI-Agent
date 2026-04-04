import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";

type UserRole = "trainer" | "member";
type PaymentMethod = "card" | "transfer" | "cash";
type GenderOption = "female" | "male" | "prefer_not_to_say";

interface GymUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
  isActive: boolean;
  membershipStartAt?: string | null;
  membershipEndAt?: string | null;
  profile?: { birthDate?: string | null; avatarUrl?: string | null } | null;
}

function calcAge(birthDateIso: string): number {
  const today = new Date();
  const birth = new Date(birthDateIso);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  trainer: "Entrenador",
  member: "Usuario",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Tarjeta",
  transfer: "Transferencia",
  cash: "Efectivo",
};

const GENDER_LABELS: Record<GenderOption, string> = {
  female: "Femenino",
  male: "Masculino",
  prefer_not_to_say: "Prefiero no decirlo",
};

const GOAL_OPTIONS = [
  "Aumento de masa muscular",
  "Pérdida de peso",
  "Aumento de movilidad",
  "Mejora de resistencia",
  "Tonificación general",
  "Recomposicion corporal",
  "Recuperacion post-lesion",
  "Mejora de fuerza",
  "Salud general",
  "Rendimiento deportivo",
];

export function AdminUsersScreen() {
  const { user, token } = useAuth();
  const isTrainer = user?.role === "trainer";
  const [users, setUsers] = useState<GymUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [creating, setCreating] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingUser, setRenewingUser] = useState<GymUser | null>(null);
  const [renewing, setRenewing] = useState(false);

  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("member");
  const [membershipMonths, setMembershipMonths] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [newGender, setNewGender] = useState<GenderOption>("prefer_not_to_say");
  const [newGoal, setNewGoal] = useState(GOAL_OPTIONS[0]);
  const [newAvailabilityDays, setNewAvailabilityDays] = useState(3);
  const [newLevel, setNewLevel] = useState(1);
  const [captureMeasurements, setCaptureMeasurements] = useState(false);
  const [measurementWeightKg, setMeasurementWeightKg] = useState("");
  const [measurementBodyFatPct, setMeasurementBodyFatPct] = useState("");
  const [measurementMuscleMass, setMeasurementMuscleMass] = useState("");
  const [measurementChestCm, setMeasurementChestCm] = useState("");
  const [measurementWaistCm, setMeasurementWaistCm] = useState("");
  const [measurementHipCm, setMeasurementHipCm] = useState("");
  const [measurementArmCm, setMeasurementArmCm] = useState("");

  const [renewMonths, setRenewMonths] = useState(1);
  const [renewPaymentMethod, setRenewPaymentMethod] = useState<PaymentMethod>("card");
  const [renewPaymentAmount, setRenewPaymentAmount] = useState("");

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

  const resetCreateForm = useCallback(() => {
    setShowCreateModal(false);
    setCreateStep(1);
    setNewEmail("");
    setNewFullName("");
    setNewPassword("");
    setNewRole("member");
    setMembershipMonths(1);
    setPaymentMethod("card");
    setPaymentAmount("");
    setNewGender("prefer_not_to_say");
    setNewGoal(GOAL_OPTIONS[0]);
    setNewAvailabilityDays(3);
    setNewLevel(1);
    setCaptureMeasurements(false);
    setMeasurementWeightKg("");
    setMeasurementBodyFatPct("");
    setMeasurementMuscleMass("");
    setMeasurementChestCm("");
    setMeasurementWaistCm("");
    setMeasurementHipCm("");
    setMeasurementArmCm("");
  }, []);

  const onCreateUser = async () => {
    if (!newEmail || !newFullName || !newPassword) {
      Alert.alert("Campos requeridos", "Todos los campos son obligatorios.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      Alert.alert("Correo inválido", "Ingresa un correo electrónico válido (ej: nombre@dominio.com).");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Contraseña débil", "La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newRole === "member") {
      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert("Monto inválido", "Debes indicar un monto válido para la activación.");
        return;
      }

      if (!newGoal.trim()) {
        Alert.alert("Objetivo requerido", "Selecciona un objetivo para el nuevo cliente.");
        return;
      }
    }

    if (!token) return;
    setCreating(true);
    try {
      const data = await api.createUser(token, {
        email: newEmail.trim().toLowerCase(),
        fullName: newFullName.trim(),
        password: newPassword,
        role: newRole,
        ...(newRole === "member" ? { membershipMonths } : {}),
        ...(newRole === "member"
          ? {
              paymentMethod,
              paymentAmount: Number(paymentAmount),
            }
          : {}),
        ...(newRole === "member"
          ? {
              profile: {
                gender: newGender,
                goal: newGoal,
                availabilityDays: newAvailabilityDays,
                level: newLevel,
              },
            }
          : {}),
        ...(newRole === "member" && captureMeasurements
          ? {
              initialMeasurement: {
                ...(measurementWeightKg ? { weightKg: Number(measurementWeightKg) } : {}),
                ...(measurementBodyFatPct ? { bodyFatPct: Number(measurementBodyFatPct) } : {}),
                ...(measurementMuscleMass ? { muscleMass: Number(measurementMuscleMass) } : {}),
                ...(measurementChestCm ? { chestCm: Number(measurementChestCm) } : {}),
                ...(measurementWaistCm ? { waistCm: Number(measurementWaistCm) } : {}),
                ...(measurementHipCm ? { hipCm: Number(measurementHipCm) } : {}),
                ...(measurementArmCm ? { armCm: Number(measurementArmCm) } : {}),
              },
            }
          : {}),
      });
      Alert.alert(
        "Usuario creado",
        `${data.message}${data.warning ? `\n\n${data.warning}` : ""}${
          data.devVerificationToken ? `\n\nToken verificacion (dev): ${data.devVerificationToken}` : ""
        }`,
      );
      resetCreateForm();
      void loadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado";
      if (msg.includes("409") || msg.toLowerCase().includes("already in use") || msg.toLowerCase().includes("already exists")) {
        Alert.alert("Correo en uso", "Ya existe una cuenta con ese correo electrónico. Usa otro correo.");
      } else {
        Alert.alert("Error al crear", msg);
      }
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

  const onReactivate = (target: GymUser) => {
    Alert.alert(
      "Reactivar usuario",
      `¿Deseas reactivar a ${target.fullName}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reactivar",
          onPress: async () => {
            if (!token) return;
            try {
              await api.reactivateUser(target.id, token);
              void loadUsers();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "No se pudo reactivar");
            }
          },
        },
      ],
    );
  };

  const onDelete = (target: GymUser) => {
    Alert.alert(
      "Eliminar usuario",
      `Esta acción eliminará permanentemente a ${target.fullName}. ¿Deseas continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            try {
              await api.deleteUser(target.id, token);
              void loadUsers();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "No se pudo eliminar");
            }
          },
        },
      ],
    );
  };

  const onOpenRenewModal = (target: GymUser) => {
    setRenewingUser(target);
    setRenewMonths(1);
    setRenewPaymentMethod("card");
    setRenewPaymentAmount("");
    setShowRenewModal(true);
  };

  const onRenewMembership = async () => {
    if (!token || !renewingUser) return;
    const amount = Number(renewPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Monto inválido", "Debes indicar un monto válido para la renovación.");
      return;
    }

    setRenewing(true);
    try {
      await api.renewMembership(renewingUser.id, token, {
        membershipMonths: renewMonths,
        paymentMethod: renewPaymentMethod,
        paymentAmount: amount,
      });
      Alert.alert("Renovación realizada", "La membresía fue renovada correctamente.");
      setShowRenewModal(false);
      setRenewingUser(null);
      void loadUsers();
    } catch (e) {
      Alert.alert("Error al renovar", e instanceof Error ? e.message : "No se pudo renovar la membresía");
    } finally {
      setRenewing(false);
    }
  };

  const visibleRoleFilters = isTrainer ? ["all", "member"] : ["all", "trainer", "member"];

  const filteredUsers = users.filter((u) => {
    if (u.id === user?.id) {
      return false;
    }
    // Defensive UI filter: trainers should never see admin accounts.
    if (isTrainer && u.role === "admin") {
      return false;
    }
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (normalizedQuery.length > 0 && !u.fullName.toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Usuarios</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setCreateStep(1);
            setShowCreateModal(true);
          }}
        >
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtro por rol */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {visibleRoleFilters.map((r) => (
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

      <View style={styles.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={20} color={palette.cocoa + "99"} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre"
          placeholderTextColor={palette.cocoa + "88"}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="words"
        />
        {searchQuery.trim().length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <MaterialCommunityIcons name="close-circle" size={18} color={palette.cocoa + "99"} />
          </TouchableOpacity>
        ) : null}
      </View>

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
                  <Text style={styles.userName}>
                    {u.fullName}
                    {u.profile?.birthDate ? ` · ${calcAge(u.profile.birthDate)} años` : ""}
                  </Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <View style={[styles.roleBadge, (styles as Record<string, object>)[`role_${u.role}`] ?? styles.role_member]}>
                    <Text style={styles.roleBadgeText}>{ROLE_LABELS[u.role] ?? u.role}</Text>
                  </View>
                  <View style={[styles.statusBadge, u.isActive ? styles.statusActive : styles.statusInactive]}>
                    <Text style={styles.statusBadgeText}>{u.isActive ? "Activo" : "Desactivado"}</Text>
                  </View>
                  {u.role === "member" && u.membershipEndAt && (
                    <Text style={styles.membershipText}>
                      Membresía hasta: {new Date(u.membershipEndAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={styles.userActions}>
                  {u.role === "member" && (
                    <TouchableOpacity style={styles.renewBtn} onPress={() => onOpenRenewModal(u)}>
                      <Text style={styles.renewBtnText}>Renovar</Text>
                    </TouchableOpacity>
                  )}
                  {u.isActive ? (
                    <TouchableOpacity style={styles.deactivateBtn} onPress={() => onDeactivate(u)}>
                      <Text style={styles.deactivateBtnText}>Desactivar</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.reactivateBtn} onPress={() => onReactivate(u)}>
                      <Text style={styles.reactivateBtnText}>Reactivar</Text>
                    </TouchableOpacity>
                  )}
                  {user?.role === "admin" && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(u)}>
                      <Text style={styles.deleteBtnText}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal crear usuario */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={resetCreateForm}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={resetCreateForm}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <ScrollView
                style={styles.modalCard}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
            <Text style={styles.modalTitle}>Crear usuario</Text>
            <Text style={styles.modalSubTitle}>Paso {createStep} de 2</Text>

            {/* Selector de rol */}
            <View style={styles.roleSelector}>
              {((isTrainer ? ["member"] : ["member", "trainer"]) as UserRole[]).map((r) => (
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

            {newRole === "member" && createStep === 1 && (
              <View style={styles.membershipSelectorWrap}>
                <Text style={styles.membershipLabel}>Duración de membresía (meses)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((months) => (
                    <TouchableOpacity
                      key={months}
                      style={[
                        styles.membershipChip,
                        membershipMonths === months && styles.membershipChipActive,
                      ]}
                      onPress={() => setMembershipMonths(months)}
                    >
                      <Text
                        style={[
                          styles.membershipChipText,
                          membershipMonths === months && styles.membershipChipTextActive,
                        ]}
                      >
                        {months}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.membershipLabel, { marginTop: 12 }]}>Metodo de pago</Text>
                <View style={styles.paymentMethodsRow}>
                  {(["card", "transfer", "cash"] as PaymentMethod[]).map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentMethodChip,
                        paymentMethod === method && styles.paymentMethodChipActive,
                      ]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text
                        style={[
                          styles.paymentMethodChipText,
                          paymentMethod === method && styles.paymentMethodChipTextActive,
                        ]}
                      >
                        {PAYMENT_METHOD_LABELS[method]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.input, { marginTop: 12, marginBottom: 0 }]}
                  placeholder="Monto pagado"
                  placeholderTextColor={palette.cocoa + "80"}
                  keyboardType="decimal-pad"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                />
              </View>
            )}

            {createStep === 1 ? (
              <>
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
                <Text style={styles.modalHint}>
                  Al primer ingreso, el usuario deberá cambiar esta contraseña temporal por una contraseña permanente.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.membershipLabel}>Genero</Text>
                <View style={styles.paymentMethodsRow}>
                  {(["female", "male", "prefer_not_to_say"] as GenderOption[]).map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.paymentMethodChip,
                        newGender === option && styles.paymentMethodChipActive,
                      ]}
                      onPress={() => setNewGender(option)}
                    >
                      <Text
                        style={[
                          styles.paymentMethodChipText,
                          newGender === option && styles.paymentMethodChipTextActive,
                        ]}
                      >
                        {GENDER_LABELS[option]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.membershipLabel, { marginTop: 12 }]}>Objetivo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {GOAL_OPTIONS.map((goalOption) => (
                    <TouchableOpacity
                      key={goalOption}
                      style={[
                        styles.paymentMethodChip,
                        newGoal === goalOption && styles.paymentMethodChipActive,
                        { marginRight: 8 },
                      ]}
                      onPress={() => setNewGoal(goalOption)}
                    >
                      <Text
                        style={[
                          styles.paymentMethodChipText,
                          newGoal === goalOption && styles.paymentMethodChipTextActive,
                        ]}
                      >
                        {goalOption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.membershipLabel, { marginTop: 12 }]}>Disponibilidad (dias)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({ length: 7 }, (_, i) => i + 1).map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.membershipChip,
                        newAvailabilityDays === days && styles.membershipChipActive,
                      ]}
                      onPress={() => setNewAvailabilityDays(days)}
                    >
                      <Text
                        style={[
                          styles.membershipChipText,
                          newAvailabilityDays === days && styles.membershipChipTextActive,
                        ]}
                      >
                        {days}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.membershipLabel, { marginTop: 12 }]}>Nivel (1 a 5)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({ length: 5 }, (_, i) => i + 1).map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.membershipChip,
                        newLevel === level && styles.membershipChipActive,
                      ]}
                      onPress={() => setNewLevel(level)}
                    >
                      <Text
                        style={[
                          styles.membershipChipText,
                          newLevel === level && styles.membershipChipTextActive,
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ marginTop: 14 }}>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodChip,
                      captureMeasurements && styles.paymentMethodChipActive,
                    ]}
                    onPress={() => setCaptureMeasurements((v) => !v)}
                  >
                    <Text
                      style={[
                        styles.paymentMethodChipText,
                        captureMeasurements && styles.paymentMethodChipTextActive,
                      ]}
                    >
                      {captureMeasurements
                        ? "Mediciones manuales activadas"
                        : "Agregar mediciones ahora (opcional)"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {captureMeasurements && (
                  <>
                    <TextInput
                      style={[styles.input, { marginTop: 12 }]}
                      placeholder="Peso (kg)"
                      placeholderTextColor={palette.cocoa + "80"}
                      keyboardType="decimal-pad"
                      value={measurementWeightKg}
                      onChangeText={setMeasurementWeightKg}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Grasa corporal (%)"
                      placeholderTextColor={palette.cocoa + "80"}
                      keyboardType="decimal-pad"
                      value={measurementBodyFatPct}
                      onChangeText={setMeasurementBodyFatPct}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Masa muscular"
                      placeholderTextColor={palette.cocoa + "80"}
                      keyboardType="decimal-pad"
                      value={measurementMuscleMass}
                      onChangeText={setMeasurementMuscleMass}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Pecho (cm)"
                      placeholderTextColor={palette.cocoa + "80"}
                      keyboardType="decimal-pad"
                      value={measurementChestCm}
                      onChangeText={setMeasurementChestCm}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Cintura (cm)"
                      placeholderTextColor={palette.cocoa + "80"}
                      keyboardType="decimal-pad"
                      value={measurementWaistCm}
                      onChangeText={setMeasurementWaistCm}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Cadera (cm)"
                      placeholderTextColor={palette.cocoa + "80"}
                      keyboardType="decimal-pad"
                      value={measurementHipCm}
                      onChangeText={setMeasurementHipCm}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Brazo (cm)"
                      placeholderTextColor={palette.cocoa + "80"}
                      keyboardType="decimal-pad"
                      value={measurementArmCm}
                      onChangeText={setMeasurementArmCm}
                    />
                  </>
                )}
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  if (createStep === 2) {
                    setCreateStep(1);
                  } else {
                    resetCreateForm();
                  }
                }}
                disabled={creating}
              >
                <Text style={styles.cancelBtnText}>{createStep === 2 ? "Volver" : "Cancelar"}</Text>
              </TouchableOpacity>
              {createStep === 1 && newRole === "member" ? (
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => setCreateStep(2)}
                  disabled={creating}
                >
                  <Text style={styles.confirmBtnText}>Siguiente</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.confirmBtn} onPress={onCreateUser} disabled={creating}>
                  {creating ? (
                    <ActivityIndicator color={palette.cream} size="small" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Crear</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showRenewModal} animationType="slide" transparent onRequestClose={() => setShowRenewModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRenewModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Renovar membresía</Text>
                <Text style={styles.modalSubTitle}>{renewingUser?.fullName ?? ""}</Text>

                <Text style={styles.membershipLabel}>Duración de renovación (meses)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((months) => (
                    <TouchableOpacity
                      key={months}
                      style={[
                        styles.membershipChip,
                        renewMonths === months && styles.membershipChipActive,
                      ]}
                      onPress={() => setRenewMonths(months)}
                    >
                      <Text
                        style={[
                          styles.membershipChipText,
                          renewMonths === months && styles.membershipChipTextActive,
                        ]}
                      >
                        {months}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.membershipLabel, { marginTop: 12 }]}>Metodo de pago</Text>
                <View style={styles.paymentMethodsRow}>
                  {(["card", "transfer", "cash"] as PaymentMethod[]).map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentMethodChip,
                        renewPaymentMethod === method && styles.paymentMethodChipActive,
                      ]}
                      onPress={() => setRenewPaymentMethod(method)}
                    >
                      <Text
                        style={[
                          styles.paymentMethodChipText,
                          renewPaymentMethod === method && styles.paymentMethodChipTextActive,
                        ]}
                      >
                        {PAYMENT_METHOD_LABELS[method]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.input, { marginTop: 12 }]}
                  placeholder="Monto pagado"
                  placeholderTextColor={palette.cocoa + "80"}
                  keyboardType="decimal-pad"
                  value={renewPaymentAmount}
                  onChangeText={setRenewPaymentAmount}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowRenewModal(false)}
                    disabled={renewing}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={onRenewMembership} disabled={renewing}>
                    {renewing ? (
                      <ActivityIndicator color={palette.cream} size="small" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Renovar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.sand,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: palette.cocoa,
    fontSize: 14,
    paddingVertical: 0,
  },
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
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  statusActive: { backgroundColor: palette.moss + "20" },
  statusInactive: { backgroundColor: palette.coral + "25" },
  statusBadgeText: { fontSize: 12, fontWeight: "600", color: palette.cocoa },
  renewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.gold,
    marginBottom: 8,
  },
  renewBtnText: { color: palette.cocoa, fontWeight: "700", fontSize: 12 },
  membershipText: {
    marginTop: 6,
    fontSize: 12,
    color: palette.cocoa + "B0",
  },
  deactivateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.coral,
    marginBottom: 8,
  },
  deactivateBtnText: { color: palette.coral, fontWeight: "600", fontSize: 12 },
  reactivateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.moss,
    marginBottom: 8,
  },
  reactivateBtnText: { color: palette.moss, fontWeight: "700", fontSize: 12 },
  userActions: {
    alignItems: "flex-end",
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#9c1f1f",
  },
  deleteBtnText: { color: "#9c1f1f", fontWeight: "700", fontSize: 12 },
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
    maxHeight: "90%",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: palette.cocoa, marginBottom: 20, textAlign: "center" },
  modalSubTitle: { fontSize: 14, color: palette.cocoa + "B0", marginBottom: 14, textAlign: "center" },
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
  membershipSelectorWrap: {
    marginBottom: 12,
  },
  membershipLabel: {
    fontSize: 13,
    color: palette.cocoa + "CC",
    marginBottom: 8,
    fontWeight: "600",
  },
  membershipChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.cocoa + "40",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: palette.cream,
  },
  membershipChipActive: {
    backgroundColor: palette.coral,
    borderColor: palette.coral,
  },
  membershipChipText: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 13,
  },
  membershipChipTextActive: {
    color: palette.cream,
  },
  paymentMethodsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  paymentMethodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.cocoa + "40",
    backgroundColor: palette.cream,
  },
  paymentMethodChipActive: {
    backgroundColor: palette.moss,
    borderColor: palette.moss,
  },
  paymentMethodChipText: {
    color: palette.cocoa,
    fontWeight: "600",
    fontSize: 13,
  },
  paymentMethodChipTextActive: {
    color: palette.cream,
  },
  modalHint: {
    marginTop: -4,
    marginBottom: 12,
    color: palette.textMuted,
    lineHeight: 18,
  },
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
