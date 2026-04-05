import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

const GOAL_OPTIONS = [
  "Aumento de masa muscular",
  "Perdida de peso",
  "Aumento de movilidad",
  "Mejora de resistencia",
  "Tonificacion general",
  "Recomposicion corporal",
  "Recuperacion post-lesion",
  "Mejora de fuerza",
  "Salud general",
  "Rendimiento deportivo",
];

const LEVEL_OPTIONS = ["Principiante", "Basico", "Intermedio", "Avanzado", "Elite"];

const AVAILABILITY_OPTIONS = Array.from({ length: 7 }, (_, i) =>
  i === 0 ? "1 dia por semana" : `${i + 1} dias por semana`,
);

const PREFERRED_DAYS: { value: string; label: string }[] = [
  { value: "monday",    label: "Lunes" },
  { value: "tuesday",   label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday",  label: "Jueves" },
  { value: "friday",    label: "Viernes" },
  { value: "saturday",  label: "Sábado" },
  { value: "sunday",    label: "Domingo" },
];

const design = {
  color: {
    primary: "#22C55E",
    background: "#F9FAFB",
    card: "#FFFFFF",
    textPrimary: "#111827",
    textSecondary: "#6B7280",
    border: "#E5E7EB",
    input: "#F3F4F6",
    white: "#FFFFFF",
    danger: "#EF4444",
    warning: "#6B7280",
  },
  spacing: {
    x1: 8,
    x2: 16,
    x3: 24,
    x4: 32,
  },
  radius: {
    input: 12,
    card: 16,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: "#111827",
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 14,
      elevation: 3,
    },
    soft: {
      shadowColor: "#111827",
      shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 2,
    },
  },
  fontFamily: Platform.select({
    ios: "SF Pro Text",
    android: "Inter",
    default: undefined,
  }),
} as const;

function calculateAge(isoDate: string): number {
  const today = new Date();
  const birth = new Date(isoDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function formatDate(date: Date): string {
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function TapSurface({
  onPress,
  children,
  style,
  disabled,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: 170,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animate(0.985)}
      onPressOut={() => animate(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && styles.disabled]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

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
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <Text style={styles.modalTitle}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((option) => {
            const active = option === selected;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
                style={({ pressed }) => [styles.modalOption, active && styles.modalOptionActive, pressed && styles.modalOptionPressed]}
              >
                <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{option}</Text>
                {active ? <Text style={styles.modalCheck}>Seleccionado</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function ProfileScreen({ navigation }: { navigation: any }) {
  const { user, token, logout } = useAuth();

  const [goal, setGoal] = useState("");
  const [availability, setAvailability] = useState("");
  const [experienceLvl, setExperienceLvl] = useState("");
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const originalPreferredDaysRef = useRef<string[]>([]);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [membershipEndAt, setMembershipEndAt] = useState<string | null>(null);
  const [unreadThreads, setUnreadThreads] = useState(0);

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
        setPreferredDays(Array.isArray(data.profile?.preferredDays) ? data.profile.preferredDays : []);
        originalPreferredDaysRef.current = Array.isArray(data.profile?.preferredDays) ? data.profile.preferredDays : [];
        if (data.profile?.birthDate) setBirthDate(new Date(data.profile.birthDate));
        if (data.profile?.avatarUrl) setAvatarUri(data.profile.avatarUrl);
        setMembershipEndAt((data.user as any)?.membershipEndAt ?? null);
        setUnreadThreads(threadsData.threads.reduce((acc, item) => acc + item.unreadCount, 0));
      } catch {
        // Keep defaults when profile loading fails.
      }
    };

    void load();
  }, [token, user]);

  const membershipInfo = useMemo(() => {
    if (user?.role !== "member" || !membershipEndAt) return null;

    const end = new Date(membershipEndAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / 86400000);

    if (daysLeft <= 0) {
      return {
        status: "Vencida",
        detail: `Vencio el ${end.toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" })}`,
        color: design.color.danger,
      };
    }

    if (daysLeft <= 7) {
      return {
        status: `${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"}`,
        detail: `Renovacion sugerida antes del ${end.toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" })}`,
        color: design.color.warning,
      };
    }

    return {
      status: `${daysLeft} dias restantes`,
      detail: `Vence el ${end.toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" })}`,
      color: design.color.primary,
    };
  }, [membershipEndAt, user?.role]);

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
      Alert.alert("Foto actualizada", "Tu foto de perfil se guardo correctamente.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "No se pudo actualizar la foto.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSave = async () => {
    if (!user || !token) return;
    const daysChanged =
      preferredDays.length !== originalPreferredDaysRef.current.length ||
      preferredDays.some((d) => !originalPreferredDaysRef.current.includes(d));
    try {
      await api.updateProfile(user.id, token, {
        goal,
        availability,
        experienceLvl,
        preferredDays,
        ...(birthDate ? { birthDate: birthDate.toISOString() } : {}),
      });
      originalPreferredDaysRef.current = [...preferredDays];
      if (daysChanged && preferredDays.length > 0) {
        Alert.alert(
          "Perfil actualizado",
          "\u00bfQuieres que Tuco regenere tu plan con los nuevos d\u00edas de entrenamiento?",
          [
            {
              text: "S\u00ed, regenerar",
              onPress: () => navigation.navigate("Rutina"),
            },
            { text: "No, despu\u00e9s", style: "cancel" },
          ]
        );
      } else {
        Alert.alert("Perfil actualizado", "Tus preferencias se guardaron correctamente.");
      }
    } catch (error) {
      Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : "Error inesperado");
    }
  };

  const displayAge = birthDate ? calculateAge(birthDate.toISOString()) : null;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <TapSurface onPress={onPickAvatar} disabled={uploadingAvatar} style={styles.avatarButton}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
          )}
          {uploadingAvatar ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={design.color.white} />
            </View>
          ) : null}
        </TapSurface>

        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>{user?.fullName ?? "Mi perfil"}</Text>
          <Text style={styles.headerSubtitle}>
            {displayAge !== null && displayAge >= 0 && displayAge < 120
              ? `${displayAge} anos`
              : "Actualiza tus datos deportivos"}
          </Text>
        </View>
      </View>

      <View style={styles.highlightCard}>
        <Text style={styles.highlightLabel}>Estado de membresia</Text>
        <Text style={[styles.highlightStatus, { color: membershipInfo?.color ?? design.color.primary }]}>
          {membershipInfo?.status ?? "Activa"}
        </Text>
        <Text style={styles.highlightDetail}>{membershipInfo?.detail ?? "Plan vigente y listo para entrenar"}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Datos de perfil</Text>

        <Text style={styles.inputLabel}>Fecha de nacimiento</Text>
        <TapSurface
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.inputSurface,
            showDatePicker && styles.inputSurfaceFocus,
          ]}
        >
          <Text style={[styles.inputValue, !birthDate && styles.inputPlaceholder]}>
            {birthDate ? formatDate(birthDate) : "Seleccionar fecha"}
          </Text>
        </TapSurface>

        {showDatePicker && Platform.OS === "ios" ? (
          <View style={styles.iosDateWrapper}>
            <DateTimePicker
              value={birthDate ?? new Date(2000, 0, 1)}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_, date) => {
                if (date) setBirthDate(date);
              }}
            />
            <TapSurface onPress={() => setShowDatePicker(false)} style={styles.iosDateDoneButton}>
              <Text style={styles.iosDateDoneText}>Listo</Text>
            </TapSurface>
          </View>
        ) : null}

        {showDatePicker && Platform.OS === "android" ? (
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
        ) : null}

        <Text style={styles.inputLabel}>Objetivo</Text>
        <TapSurface
          onPress={() => setShowGoalPicker(true)}
          style={[styles.inputSurface, showGoalPicker && styles.inputSurfaceFocus]}
        >
          <Text style={[styles.inputValue, !goal && styles.inputPlaceholder]}>
            {goal || "Seleccionar objetivo"}
          </Text>
        </TapSurface>

        <Text style={styles.inputLabel}>Disponibilidad semanal</Text>
        <TapSurface
          onPress={() => setShowAvailPicker(true)}
          style={[styles.inputSurface, showAvailPicker && styles.inputSurfaceFocus]}
        >
          <Text style={[styles.inputValue, !availability && styles.inputPlaceholder]}>
            {availability || "Seleccionar dias"}
          </Text>
        </TapSurface>

        <Text style={styles.inputLabel}>Nivel</Text>
        <TapSurface
          onPress={() => setShowLevelPicker(true)}
          style={[styles.inputSurface, showLevelPicker && styles.inputSurfaceFocus]}
        >
          <Text style={[styles.inputValue, !experienceLvl && styles.inputPlaceholder]}>
            {experienceLvl || "Seleccionar nivel"}
          </Text>
        </TapSurface>

        <Text style={styles.inputLabel}>Días de entrenamiento</Text>
        <View style={styles.daysGrid}>
          {PREFERRED_DAYS.map((day) => {
            const active = preferredDays.includes(day.value);
            return (
              <TouchableOpacity
                key={day.value}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() =>
                  setPreferredDays((prev) => {
                    const next = active ? prev.filter((d) => d !== day.value) : [...prev, day.value];
                    if (next.length > 0) {
                      setAvailability(`${next.length} ${next.length === 1 ? "dia" : "dias"} por semana`);
                    }
                    return next;
                  })
                }
              >
                <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {preferredDays.length > 0 ? (
          <Text style={styles.preferredDaysInfo}>
            {preferredDays.length} día(s) seleccionado(s) · Tuco creará un plan de {preferredDays.length} sesión(es) por semana
          </Text>
        ) : null}

        <View style={styles.buttonRow}>
          <TapSurface onPress={onSave} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Guardar perfil</Text>
          </TapSurface>

          <TapSurface onPress={() => navigation.navigate("MyMessages")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Mis mensajes</Text>
            {unreadThreads > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadThreads}</Text>
              </View>
            ) : null}
          </TapSurface>
        </View>
      </View>
        <TapSurface onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
        </TapSurface>
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

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: design.color.background,
    paddingHorizontal: design.spacing.x2,
    paddingTop: design.spacing.x3,
    paddingBottom: design.spacing.x4,
  },
  disabled: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: design.spacing.x3,
  },
  avatarButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: design.color.card,
    ...design.shadow.soft,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: design.color.input,
  },
  avatarFallbackText: {
    color: design.color.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: design.fontFamily,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBlock: {
    marginLeft: design.spacing.x2,
    flex: 1,
  },
  headerTitle: {
    color: design.color.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: design.fontFamily,
  },
  headerSubtitle: {
    marginTop: design.spacing.x1,
    color: design.color.textSecondary,
    fontSize: 14,
    fontWeight: "400",
    fontFamily: design.fontFamily,
  },
  highlightCard: {
    backgroundColor: design.color.card,
    borderRadius: design.radius.card,
    padding: design.spacing.x3,
    marginBottom: design.spacing.x3,
    ...design.shadow.card,
  },
  highlightLabel: {
    color: design.color.textSecondary,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: design.fontFamily,
  },
  highlightStatus: {
    marginTop: design.spacing.x1,
    color: design.color.primary,
    fontSize: 30,
    fontWeight: "700",
    fontFamily: design.fontFamily,
  },
  highlightDetail: {
    marginTop: design.spacing.x1,
    color: design.color.textSecondary,
    fontSize: 14,
    fontWeight: "400",
    fontFamily: design.fontFamily,
  },
  sectionCard: {
    backgroundColor: design.color.card,
    borderRadius: design.radius.card,
    padding: design.spacing.x2,
    ...design.shadow.card,
  },
  sectionTitle: {
    color: design.color.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: design.spacing.x2,
    fontFamily: design.fontFamily,
  },
  inputLabel: {
    color: design.color.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: design.spacing.x1,
    marginTop: design.spacing.x2,
    fontFamily: design.fontFamily,
  },
  inputSurface: {
    borderRadius: design.radius.input,
    backgroundColor: design.color.input,
    borderWidth: 1,
    borderColor: design.color.border,
    paddingHorizontal: design.spacing.x2,
    paddingVertical: 16,
    minHeight: 48,
    justifyContent: "center",
  },
  inputSurfaceFocus: {
    borderColor: design.color.primary,
    shadowColor: design.color.primary,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 1,
  },
  inputValue: {
    color: design.color.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    fontFamily: design.fontFamily,
  },
  inputPlaceholder: {
    color: design.color.textSecondary,
    fontWeight: "400",
  },
  iosDateWrapper: {
    backgroundColor: design.color.card,
    borderRadius: design.radius.input,
    marginTop: design.spacing.x2,
    padding: design.spacing.x1,
    ...design.shadow.soft,
  },
  iosDateDoneButton: {
    alignSelf: "flex-end",
    backgroundColor: design.color.input,
    borderRadius: design.radius.input,
    paddingHorizontal: design.spacing.x2,
    paddingVertical: 8,
    marginTop: design.spacing.x1,
  },
  iosDateDoneText: {
    color: design.color.textPrimary,
    fontWeight: "600",
    fontFamily: design.fontFamily,
  },
  buttonRow: {
    marginTop: design.spacing.x3,
    rowGap: design.spacing.x2,
  },
  primaryButton: {
    backgroundColor: design.color.primary,
    borderRadius: design.radius.input,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    ...design.shadow.soft,
  },
  primaryButtonText: {
    color: design.color.white,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: design.fontFamily,
  },
  secondaryButton: {
    backgroundColor: design.color.input,
    borderRadius: design.radius.input,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  secondaryButtonText: {
    color: design.color.textPrimary,
    fontSize: 16,
    fontWeight: "500",
    fontFamily: design.fontFamily,
  },
  logoutButton: {
    marginTop: design.spacing.x2,
    borderRadius: design.radius.input,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: design.color.primary,
    backgroundColor: "transparent",
  },
  logoutButtonText: {
    color: design.color.primary,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: design.fontFamily,
  },
  badge: {
    position: "absolute",
    right: design.spacing.x2,
    top: 8,
    minWidth: 24,
    height: 24,
    borderRadius: design.radius.pill,
    backgroundColor: design.color.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    color: design.color.white,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: design.fontFamily,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.28)",
  },
  modalSheet: {
    maxHeight: "62%",
    backgroundColor: design.color.card,
    borderTopLeftRadius: design.radius.card,
    borderTopRightRadius: design.radius.card,
    padding: design.spacing.x2,
    ...design.shadow.card,
  },
  modalTitle: {
    color: design.color.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: design.spacing.x2,
    fontFamily: design.fontFamily,
  },
  modalOption: {
    borderRadius: design.radius.input,
    backgroundColor: design.color.input,
    borderWidth: 1,
    borderColor: design.color.border,
    paddingHorizontal: design.spacing.x2,
    paddingVertical: 16,
    marginBottom: design.spacing.x1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOptionPressed: {
    opacity: 0.92,
  },
  modalOptionActive: {
    borderColor: design.color.primary,
  },
  modalOptionText: {
    color: design.color.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    fontFamily: design.fontFamily,
  },
  modalOptionTextActive: {
    color: design.color.primary,
    fontWeight: "600",
  },
  modalCheck: {
    color: design.color.primary,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: design.fontFamily,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  preferredDaysInfo: {
    fontSize: 12,
    color: design.color.textSecondary,
    marginBottom: design.spacing.x2,
    textAlign: "center",
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: design.color.border,
    backgroundColor: design.color.input,
  },
  dayChipActive: {
    borderColor: design.color.primary,
    backgroundColor: design.color.primary + "18",
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: design.color.textSecondary,
  },
  dayChipTextActive: {
    color: design.color.primary,
  },
});

