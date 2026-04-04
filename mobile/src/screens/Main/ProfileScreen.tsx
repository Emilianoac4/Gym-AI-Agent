import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";

const GOAL_OPTIONS = [
  "Aumento de masa muscular",
  "Pérdida de peso",
  "Aumento de movilidad",
  "Mejora de resistencia",
  "Tonificación general",
  "Recomposición corporal",
  "Recuperación post-lesión",
  "Mejora de fuerza",
  "Salud general",
  "Rendimiento deportivo",
];

const LEVEL_OPTIONS = [
  "Principiante",
  "Básico",
  "Intermedio",
  "Avanzado",
  "Élite",
];

const AVAILABILITY_OPTIONS = Array.from({ length: 7 }, (_, i) =>
  i === 0 ? "1 día por semana" : `${i + 1} días por semana`,
);

function calculateAge(isoDate: string): number {
  const today = new Date();
  const birth = new Date(isoDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function formatDisplayDate(date: Date): string {
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

// ── Inline picker modal shown as a bottom sheet ────────────────────────────
function OptionPicker({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.backdrop} onPress={onClose} />
      <View style={pickerStyles.sheet}>
        <Text style={pickerStyles.sheetTitle}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[pickerStyles.option, selected === opt && pickerStyles.optionSelected]}
              onPress={() => { onSelect(opt); onClose(); }}
            >
              <Text style={[pickerStyles.optionText, selected === opt && pickerStyles.optionTextSelected]}>
                {opt}
              </Text>
              {selected === opt && <Text style={pickerStyles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export function ProfileScreen({ navigation }: { navigation: any }) {
  const { user, token } = useAuth();

  // Profile fields
  const [goal, setGoal] = useState("");
  const [availability, setAvailability] = useState("");
  const [experienceLvl, setExperienceLvl] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);

  // Avatar
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Membership
  const [membershipEndAt, setMembershipEndAt] = useState<string | null>(null);

  // Misc
  const [unreadThreads, setUnreadThreads] = useState(0);

  // Picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showAvailPicker, setShowAvailPicker] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user || !token) return;
      try {
        const [data, threadsData] = await Promise.all([
          api.getProfile(user.id, token),
          api.getMyThreads(token).catch(() => ({ threads: [] })),
        ]);
        setGoal(data.profile?.goal ?? "");
        setAvailability(data.profile?.availability ?? "");
        setExperienceLvl(data.profile?.experienceLvl ?? "");
        if (data.profile?.birthDate) setBirthDate(new Date(data.profile.birthDate));
        if (data.profile?.avatarUrl) setAvatarUri(data.profile.avatarUrl);
        setMembershipEndAt((data.user as any)?.membershipEndAt ?? null);
        setUnreadThreads(threadsData.threads.reduce((acc, item) => acc + item.unreadCount, 0));
      } catch {
        // Keep defaults
      }
    };
    void load();
  }, [token, user]);

  const onPickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para actualizar tu imagen de perfil.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      setUploadingAvatar(true);
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 320, height: 320 } }],
        { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64 || !user || !token) return;
      const res = await api.updateAvatar(user.id, token, manipulated.base64);
      setAvatarUri(res.avatarUrl);
      Alert.alert("Foto actualizada", "Tu foto de perfil se guardó correctamente.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "No se pudo actualizar la foto.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSave = async () => {
    if (!user || !token) return;
    try {
      await api.updateProfile(user.id, token, {
        goal,
        availability,
        experienceLvl,
        ...(birthDate ? { birthDate: birthDate.toISOString() } : {}),
      });
      Alert.alert("Perfil actualizado", "Tus preferencias se guardaron correctamente.");
    } catch (error) {
      Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const displayAge = birthDate ? calculateAge(birthDate.toISOString()) : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={onPickAvatar} disabled={uploadingAvatar} style={styles.avatarWrapper}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarCameraIcon}>📷</Text>
              <Text style={styles.avatarPlaceholderText}>Foto de perfil</Text>
            </View>
          )}
          {uploadingAvatar ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={palette.white} />
            </View>
          ) : null}
        </TouchableOpacity>
        <Text style={styles.avatarName}>{user?.fullName ?? ""}</Text>
        {displayAge !== null && displayAge >= 0 && displayAge < 120 ? (
          <Text style={styles.avatarAge}>{displayAge} años</Text>
        ) : null}
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Perfil base</Text>
        <Text style={styles.title}>Perfil Deportivo</Text>
        <Text style={styles.subtitle}>Estos datos alimentan la IA para rutinas y nutrición personalizadas.</Text>
      </View>

      {/* ─ Membership status (member only) ─ */}
      {user?.role === "member" && membershipEndAt ? (() => {
        const end = new Date(membershipEndAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffMs = end.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffMs / 86400000);
        const expired = daysLeft <= 0;
        const urgent = daysLeft <= 7 && !expired;
        return (
          <View style={[styles.membershipCard, expired && styles.membershipCardExpired, urgent && styles.membershipCardUrgent]}>
            <Text style={styles.membershipLabel}>Membresía</Text>
            {expired ? (
              <Text style={styles.membershipValueExpired}>Vencida</Text>
            ) : (
              <Text style={[styles.membershipValue, urgent && styles.membershipValueUrgent]}>
                {daysLeft} {daysLeft === 1 ? "día restante" : "días restantes"}
              </Text>
            )}
            <Text style={styles.membershipSub}>Vence: {end.toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" })}</Text>
          </View>
        );
      })() : null}

      <View style={styles.card}>
        {/* ─ Fecha de nacimiento ─ */}
        <Text style={styles.label}>Fecha de nacimiento</Text>
        <TouchableOpacity style={styles.pickerRow} onPress={() => setShowDatePicker(true)}>
          <Text style={[styles.pickerRowText, !birthDate && { color: palette.textSoft }]}>
            {birthDate ? formatDisplayDate(birthDate) : "Seleccionar fecha"}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>

        {/* iOS inline date picker */}
        {showDatePicker && Platform.OS === "ios" && (
          <View style={styles.iosDateWrapper}>
            <DateTimePicker
              value={birthDate ?? new Date(2000, 0, 1)}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_, date) => { if (date) setBirthDate(date); }}
            />
            <TouchableOpacity style={styles.iosDoneBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.iosDoneBtnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Android date picker (dialog) */}
        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={birthDate ?? new Date(2000, 0, 1)}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) setBirthDate(date);
            }}
          />
        )}

        {/* ─ Objetivo ─ */}
        <Text style={styles.label}>Objetivo</Text>
        <TouchableOpacity style={styles.pickerRow} onPress={() => setShowGoalPicker(true)}>
          <Text style={[styles.pickerRowText, !goal && { color: palette.textSoft }]}>
            {goal || "Seleccionar objetivo"}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>

        {/* ─ Disponibilidad ─ */}
        <Text style={styles.label}>Disponibilidad semanal</Text>
        <TouchableOpacity style={styles.pickerRow} onPress={() => setShowAvailPicker(true)}>
          <Text style={[styles.pickerRowText, !availability && { color: palette.textSoft }]}>
            {availability || "Seleccionar días"}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>

        {/* ─ Nivel ─ */}
        <Text style={styles.label}>Nivel</Text>
        <TouchableOpacity style={styles.pickerRow} onPress={() => setShowLevelPicker(true)}>
          <Text style={[styles.pickerRowText, !experienceLvl && { color: palette.textSoft }]}>
            {experienceLvl || "Seleccionar nivel"}
          </Text>
          <Text style={styles.pickerChevron}>▼</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
        <AppButton label="Guardar perfil" onPress={onSave} />

        <TouchableOpacity
          style={styles.messagesButton}
          onPress={() => navigation.navigate("MyMessages")}
        >
          <Text style={styles.messagesButtonText}>💬 Mis mensajes</Text>
          {unreadThreads > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadThreads}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* ─ Modals ─ */}
      <OptionPicker
        visible={showGoalPicker}
        title="Objetivo"
        options={GOAL_OPTIONS}
        selected={goal}
        onSelect={setGoal}
        onClose={() => setShowGoalPicker(false)}
      />
      <OptionPicker
        visible={showAvailPicker}
        title="Disponibilidad semanal"
        options={AVAILABILITY_OPTIONS}
        selected={availability}
        onSelect={setAvailability}
        onClose={() => setShowAvailPicker(false)}
      />
      <OptionPicker
        visible={showLevelPicker}
        title="Nivel de experiencia"
        options={LEVEL_OPTIONS}
        selected={experienceLvl}
        onSelect={setExperienceLvl}
        onClose={() => setShowLevelPicker(false)}
      />
    </ScrollView>
  );
}

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "60%",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 12,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  optionSelected: {
    backgroundColor: palette.moss + "18",
  },
  optionText: {
    fontSize: 15,
    color: palette.ink,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: "700",
    color: palette.moss,
  },
  checkmark: {
    color: palette.moss,
    fontWeight: "800",
    fontSize: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: palette.background,
    padding: 20,
  },
  avatarSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 16,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: palette.sand,
    borderWidth: 2,
    borderColor: palette.line,
    marginBottom: 10,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCameraIcon: { fontSize: 28 },
  avatarPlaceholderText: {
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 4,
    fontWeight: "600",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarName: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
  },
  avatarAge: {
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 16,
  },
  eyebrow: {
    color: palette.coral,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.ink,
    marginTop: 8,
  },
  subtitle: {
    marginTop: 8,
    color: palette.textMuted,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  label: {
    fontWeight: "700",
    color: palette.ink,
    marginBottom: 6,
    marginTop: 12,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.cream,
  },
  pickerRowText: {
    fontSize: 15,
    color: palette.ink,
    flex: 1,
  },
  pickerChevron: {
    fontSize: 11,
    color: palette.textMuted,
  },
  iosDateWrapper: {
    backgroundColor: palette.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    marginTop: 8,
    overflow: "hidden",
  },
  iosDoneBtn: {
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  iosDoneBtnText: {
    color: palette.moss,
    fontWeight: "700",
    fontSize: 15,
  },
  messagesButton: {
    marginTop: 14,
    backgroundColor: palette.sand,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.line,
    position: "relative",
  },
  messagesButtonText: { fontSize: 14, fontWeight: "700", color: palette.cocoa },
  unreadBadge: {
    position: "absolute",
    right: 10,
    top: "50%",
    marginTop: -11,
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
  membershipCard: {
    backgroundColor: palette.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 16,
    alignItems: "center",
  },
  membershipCardExpired: {
    borderColor: "#ef4444",
    backgroundColor: "#fff1f1",
  },
  membershipCardUrgent: {
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
  },
  membershipLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: palette.textMuted,
    marginBottom: 6,
  },
  membershipValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#22c55e",
  },
  membershipValueUrgent: {
    color: "#f59e0b",
  },
  membershipValueExpired: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ef4444",
  },
  membershipSub: {
    marginTop: 4,
    fontSize: 13,
    color: palette.textMuted,
  },
});

