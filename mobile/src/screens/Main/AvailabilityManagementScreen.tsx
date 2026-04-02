import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";
import {
  AvailabilityTrainerPermission,
  GymAvailabilityExceptionDay,
  GymAvailabilityPermissions,
  GymAvailabilityTemplateDay,
  GymDayOfWeek,
} from "../../types/api";

type TemplateDraft = {
  dayOfWeek: GymDayOfWeek;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  slotMinutes: string;
  capacityLabel: string;
  updatedAt: string | null;
  updatedByName: string | null;
};

const dayLabels: Record<GymDayOfWeek, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miercoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sabado",
  sunday: "Domingo",
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const plusDays = (amount: number) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};

const mapTemplateToDraft = (day: GymAvailabilityTemplateDay): TemplateDraft => ({
  dayOfWeek: day.dayOfWeek,
  isOpen: day.isOpen,
  opensAt: day.opensAt ?? "",
  closesAt: day.closesAt ?? "",
  slotMinutes: String(day.slotMinutes ?? 60),
  capacityLabel: day.capacityLabel ?? "",
  updatedAt: day.updatedAt,
  updatedByName: day.updatedBy?.fullName ?? null,
});

const emptyExceptionForm = {
  isClosed: false,
  opensAt: "06:00",
  closesAt: "22:00",
  slotMinutes: "60",
  capacityLabel: "alta",
  note: "",
};

export function AvailabilityManagementScreen() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [savingException, setSavingException] = useState(false);
  const [togglingTrainerId, setTogglingTrainerId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<GymAvailabilityPermissions>({
    canWrite: false,
    canGrant: false,
  });
  const [templateDrafts, setTemplateDrafts] = useState<TemplateDraft[]>([]);
  const [exceptions, setExceptions] = useState<GymAvailabilityExceptionDay[]>([]);
  const [trainers, setTrainers] = useState<AvailabilityTrainerPermission[]>([]);
  const [selectedExceptionDate, setSelectedExceptionDate] = useState(todayKey());
  const [exceptionForm, setExceptionForm] = useState(emptyExceptionForm);

  const selectedException = useMemo(
    () => exceptions.find((item) => item.date === selectedExceptionDate) ?? null,
    [exceptions, selectedExceptionDate],
  );

  useEffect(() => {
    if (!selectedException) {
      setExceptionForm(emptyExceptionForm);
      return;
    }

    setExceptionForm({
      isClosed: selectedException.isClosed,
      opensAt: selectedException.opensAt ?? "06:00",
      closesAt: selectedException.closesAt ?? "22:00",
      slotMinutes: String(selectedException.slotMinutes ?? 60),
      capacityLabel: selectedException.capacityLabel ?? "",
      note: selectedException.note ?? "",
    });
  }, [selectedException]);

  const load = useCallback(async (isRefresh = false) => {
    if (!token) {
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const templateResponse = await api.getAvailabilityTemplate(token);
      const exceptionsResponse = await api.getAvailabilityExceptions(token, todayKey(), plusDays(30));

      setPermissions(templateResponse.permissions);
      setTemplateDrafts(templateResponse.template.map(mapTemplateToDraft));
      setExceptions(exceptionsResponse.exceptions);

      if (templateResponse.permissions.canGrant) {
        const trainersResponse = await api.listAvailabilityPermissionTrainers(token);
        setTrainers(trainersResponse.trainers);
      } else {
        setTrainers([]);
      }
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "No se pudo cargar la configuracion");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateTemplateDraft = (dayOfWeek: GymDayOfWeek, patch: Partial<TemplateDraft>) => {
    setTemplateDrafts((current) =>
      current.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, ...patch } : item)),
    );
  };

  const onSaveTemplateDay = async (draft: TemplateDraft) => {
    if (!token || !permissions.canWrite) {
      return;
    }

    let slotMinutes: number | null = null;
    if (draft.isOpen) {
      const parsedSlotMinutes = Number(draft.slotMinutes);
      if (!Number.isFinite(parsedSlotMinutes) || parsedSlotMinutes <= 0) {
        Alert.alert("Franja invalida", "Debes indicar una duracion valida en minutos.");
        return;
      }

      slotMinutes = parsedSlotMinutes;
    }

    setSavingDay(draft.dayOfWeek);
    try {
      const response = await api.saveAvailabilityTemplateDay(token, draft.dayOfWeek, {
        isOpen: draft.isOpen,
        opensAt: draft.isOpen ? draft.opensAt : null,
        closesAt: draft.isOpen ? draft.closesAt : null,
        slotMinutes: draft.isOpen ? slotMinutes : null,
        capacityLabel: draft.capacityLabel.trim() || null,
      });

      setTemplateDrafts((current) =>
        current.map((item) =>
          item.dayOfWeek === draft.dayOfWeek ? mapTemplateToDraft(response.day) : item,
        ),
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "No se pudo guardar el horario");
    } finally {
      setSavingDay(null);
    }
  };

  const onSaveException = async () => {
    if (!token || !permissions.canWrite) {
      return;
    }

    let slotMinutes: number | null = null;
    if (!exceptionForm.isClosed) {
      const parsedSlotMinutes = Number(exceptionForm.slotMinutes);
      if (!Number.isFinite(parsedSlotMinutes) || parsedSlotMinutes <= 0) {
        Alert.alert("Franja invalida", "Debes indicar una duracion valida en minutos.");
        return;
      }

      slotMinutes = parsedSlotMinutes;
    }

    setSavingException(true);
    try {
      const response = await api.saveAvailabilityException(token, selectedExceptionDate, {
        isClosed: exceptionForm.isClosed,
        opensAt: exceptionForm.isClosed ? null : exceptionForm.opensAt,
        closesAt: exceptionForm.isClosed ? null : exceptionForm.closesAt,
        slotMinutes,
        capacityLabel: exceptionForm.capacityLabel.trim() || null,
        note: exceptionForm.note.trim() || null,
      });

      setExceptions((current) => {
        const filtered = current.filter((item) => item.date !== selectedExceptionDate);
        return [...filtered, response.exception].sort((left, right) => left.date.localeCompare(right.date));
      });
      Alert.alert("Dia especial guardado", "La excepcion quedo publicada correctamente.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "No se pudo guardar la excepcion");
    } finally {
      setSavingException(false);
    }
  };

  const onDeleteException = async () => {
    if (!token || !permissions.canWrite || !selectedException) {
      return;
    }

    setSavingException(true);
    try {
      await api.deleteAvailabilityException(token, selectedExceptionDate);
      setExceptions((current) => current.filter((item) => item.date !== selectedExceptionDate));
      setExceptionForm(emptyExceptionForm);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "No se pudo eliminar la excepcion");
    } finally {
      setSavingException(false);
    }
  };

  const onToggleTrainer = async (trainer: AvailabilityTrainerPermission) => {
    if (!token || !permissions.canGrant) {
      return;
    }

    setTogglingTrainerId(trainer.id);
    try {
      if (trainer.hasAvailabilityWrite) {
        await api.revokeAvailabilityWrite(token, trainer.id);
      } else {
        await api.grantAvailabilityWrite(token, trainer.id);
      }

      const trainersResponse = await api.listAvailabilityPermissionTrainers(token);
      setTrainers(trainersResponse.trainers);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "No se pudo actualizar la autorizacion");
    } finally {
      setTogglingTrainerId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.cocoa} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={palette.cocoa} />}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Disponibilidad operativa</Text>
        <Text style={styles.heroCopy}>
          Publica el horario semanal del gimnasio y corrige dias especiales sin tocar la base de datos.
        </Text>
        {!permissions.canWrite ? (
          <View style={styles.readOnlyBanner}>
            <Text style={styles.readOnlyText}>
              {user?.role === "trainer"
                ? "Tienes acceso de lectura. Un administrador debe autorizarte para editar horarios."
                : "Tienes acceso de lectura en este modulo."}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Horario estandar</Text>
        <Text style={styles.sectionCopy}>Configura el horario base de cada dia de la semana.</Text>

        {templateDrafts.map((draft) => (
          <View key={draft.dayOfWeek} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{dayLabels[draft.dayOfWeek]}</Text>
              <TouchableOpacity
                style={[styles.toggleChip, draft.isOpen ? styles.toggleChipOn : styles.toggleChipOff]}
                disabled={!permissions.canWrite}
                onPress={() => updateTemplateDraft(draft.dayOfWeek, { isOpen: !draft.isOpen })}
              >
                <Text style={[styles.toggleChipText, !draft.isOpen && styles.toggleChipTextOff]}>
                  {draft.isOpen ? "Abierto" : "Cerrado"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Apertura</Text>
                <TextInput
                  style={styles.input}
                  editable={permissions.canWrite && draft.isOpen}
                  value={draft.opensAt}
                  onChangeText={(value) => updateTemplateDraft(draft.dayOfWeek, { opensAt: value })}
                  placeholder="06:00"
                  placeholderTextColor={palette.textSoft}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Cierre</Text>
                <TextInput
                  style={styles.input}
                  editable={permissions.canWrite && draft.isOpen}
                  value={draft.closesAt}
                  onChangeText={(value) => updateTemplateDraft(draft.dayOfWeek, { closesAt: value })}
                  placeholder="22:00"
                  placeholderTextColor={palette.textSoft}
                />
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Franja (min)</Text>
                <TextInput
                  style={styles.input}
                  editable={permissions.canWrite && draft.isOpen}
                  keyboardType="numeric"
                  value={draft.slotMinutes}
                  onChangeText={(value) => updateTemplateDraft(draft.dayOfWeek, { slotMinutes: value })}
                  placeholder="60"
                  placeholderTextColor={palette.textSoft}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Capacidad</Text>
                <TextInput
                  style={styles.input}
                  editable={permissions.canWrite}
                  value={draft.capacityLabel}
                  onChangeText={(value) => updateTemplateDraft(draft.dayOfWeek, { capacityLabel: value })}
                  placeholder="alta / reducida"
                  placeholderTextColor={palette.textSoft}
                />
              </View>
            </View>

            {draft.updatedAt ? (
              <Text style={styles.auditText}>Ultima edicion: {draft.updatedByName ?? "Sin nombre"}</Text>
            ) : (
              <Text style={styles.auditText}>Aun no publicado</Text>
            )}

            {permissions.canWrite ? (
              <TouchableOpacity
                style={styles.saveInlineButton}
                disabled={savingDay === draft.dayOfWeek}
                onPress={() => void onSaveTemplateDay(draft)}
              >
                <Text style={styles.saveInlineButtonText}>
                  {savingDay === draft.dayOfWeek ? "Guardando..." : "Guardar dia"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Dia especial</Text>
        <Text style={styles.sectionCopy}>Sobrescribe el horario estandar para una fecha puntual.</Text>

        <Text style={styles.fieldLabel}>Fecha</Text>
        <TextInput
          style={styles.input}
          editable={permissions.canWrite}
          value={selectedExceptionDate}
          onChangeText={setSelectedExceptionDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={palette.textSoft}
        />

        <TouchableOpacity
          style={[styles.toggleChip, exceptionForm.isClosed ? styles.toggleChipOff : styles.toggleChipOn]}
          disabled={!permissions.canWrite}
          onPress={() => setExceptionForm((current) => ({ ...current, isClosed: !current.isClosed }))}
        >
          <Text style={[styles.toggleChipText, exceptionForm.isClosed && styles.toggleChipTextOff]}>
            {exceptionForm.isClosed ? "Dia cerrado" : "Dia abierto"}
          </Text>
        </TouchableOpacity>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Apertura</Text>
            <TextInput
              style={styles.input}
              editable={permissions.canWrite && !exceptionForm.isClosed}
              value={exceptionForm.opensAt}
              onChangeText={(value) => setExceptionForm((current) => ({ ...current, opensAt: value }))}
              placeholder="06:00"
              placeholderTextColor={palette.textSoft}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Cierre</Text>
            <TextInput
              style={styles.input}
              editable={permissions.canWrite && !exceptionForm.isClosed}
              value={exceptionForm.closesAt}
              onChangeText={(value) => setExceptionForm((current) => ({ ...current, closesAt: value }))}
              placeholder="22:00"
              placeholderTextColor={palette.textSoft}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Franja (min)</Text>
            <TextInput
              style={styles.input}
              editable={permissions.canWrite && !exceptionForm.isClosed}
              keyboardType="numeric"
              value={exceptionForm.slotMinutes}
              onChangeText={(value) => setExceptionForm((current) => ({ ...current, slotMinutes: value }))}
              placeholder="60"
              placeholderTextColor={palette.textSoft}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Capacidad</Text>
            <TextInput
              style={styles.input}
              editable={permissions.canWrite}
              value={exceptionForm.capacityLabel}
              onChangeText={(value) => setExceptionForm((current) => ({ ...current, capacityLabel: value }))}
              placeholder="alta / reducida"
              placeholderTextColor={palette.textSoft}
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Nota</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          editable={permissions.canWrite}
          multiline
          value={exceptionForm.note}
          onChangeText={(value) => setExceptionForm((current) => ({ ...current, note: value }))}
          placeholder="Ej: horario reducido por evento interno"
          placeholderTextColor={palette.textSoft}
        />

        {selectedException ? (
          <Text style={styles.auditText}>
            Editado por {selectedException.updatedBy?.fullName ?? "Sin nombre"}
          </Text>
        ) : (
          <Text style={styles.auditText}>No hay excepcion guardada para esta fecha.</Text>
        )}

        {permissions.canWrite ? (
          <View style={styles.exceptionActions}>
            <View style={styles.exceptionActionPrimary}>
              <AppButton
                label={savingException ? "Guardando..." : "Guardar dia especial"}
                onPress={() => void onSaveException()}
                disabled={savingException}
              />
            </View>
            {selectedException ? (
              <TouchableOpacity
                style={styles.deleteExceptionButton}
                disabled={savingException}
                onPress={() => void onDeleteException()}
              >
                <Text style={styles.deleteExceptionButtonText}>Eliminar excepcion</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      {permissions.canGrant ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Entrenadores autorizados</Text>
          <Text style={styles.sectionCopy}>
            Define que entrenadores pueden editar la disponibilidad operativa del gimnasio.
          </Text>

          {trainers.map((trainer) => (
            <View key={trainer.id} style={styles.trainerRow}>
              <View style={styles.trainerCopy}>
                <Text style={styles.trainerName}>{trainer.fullName}</Text>
                <Text style={styles.trainerEmail}>{trainer.email}</Text>
                <Text style={styles.auditText}>
                  {trainer.hasAvailabilityWrite
                    ? `Autorizado${trainer.grantedBy ? ` por ${trainer.grantedBy.fullName}` : ""}`
                    : "Sin autorizacion de edicion"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.permissionButton,
                  trainer.hasAvailabilityWrite ? styles.permissionButtonRevoke : styles.permissionButtonGrant,
                ]}
                disabled={togglingTrainerId === trainer.id}
                onPress={() => void onToggleTrainer(trainer)}
              >
                <Text
                  style={[
                    styles.permissionButtonText,
                    trainer.hasAvailabilityWrite ? styles.permissionButtonTextLight : styles.permissionButtonTextDark,
                  ]}
                >
                  {togglingTrainerId === trainer.id
                    ? "Actualizando..."
                    : trainer.hasAvailabilityWrite
                      ? "Revocar"
                      : "Autorizar"}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  heroTitle: {
    color: palette.cocoa,
    fontSize: 24,
    fontWeight: "800",
  },
  heroCopy: {
    marginTop: 8,
    color: palette.textMuted,
    lineHeight: 20,
  },
  readOnlyBanner: {
    marginTop: 14,
    borderRadius: 16,
    padding: 12,
    backgroundColor: palette.sand,
    borderWidth: 1,
    borderColor: palette.line,
  },
  readOnlyText: {
    color: palette.cocoa,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
    gap: 12,
  },
  sectionTitle: {
    color: palette.cocoa,
    fontSize: 22,
    fontWeight: "800",
  },
  sectionCopy: {
    color: palette.textMuted,
    lineHeight: 20,
  },
  dayCard: {
    borderTopWidth: 1,
    borderTopColor: palette.sand,
    paddingTop: 14,
    gap: 10,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  dayLabel: {
    color: palette.cocoa,
    fontSize: 18,
    fontWeight: "800",
  },
  toggleChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleChipOn: {
    backgroundColor: palette.moss,
  },
  toggleChipOff: {
    backgroundColor: palette.cocoa,
  },
  toggleChipText: {
    color: palette.cocoa,
    fontWeight: "800",
  },
  toggleChipTextOff: {
    color: palette.card,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 10,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    color: palette.cocoa,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.cream,
    color: palette.ink,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  auditText: {
    color: palette.textSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  saveInlineButton: {
    alignSelf: "flex-start",
    backgroundColor: palette.cocoa,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveInlineButtonText: {
    color: palette.gold,
    fontWeight: "800",
  },
  exceptionActions: {
    gap: 12,
  },
  exceptionActionPrimary: {
    marginTop: 2,
  },
  deleteExceptionButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.danger,
  },
  deleteExceptionButtonText: {
    color: palette.danger,
    fontWeight: "800",
  },
  trainerRow: {
    borderTopWidth: 1,
    borderTopColor: palette.sand,
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  trainerCopy: {
    flex: 1,
  },
  trainerName: {
    color: palette.cocoa,
    fontWeight: "800",
    fontSize: 16,
  },
  trainerEmail: {
    color: palette.textMuted,
    marginTop: 4,
  },
  permissionButton: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  permissionButtonGrant: {
    backgroundColor: palette.gold,
  },
  permissionButtonRevoke: {
    backgroundColor: palette.cocoa,
  },
  permissionButtonText: {
    fontWeight: "800",
  },
  permissionButtonTextDark: {
    color: palette.cocoa,
  },
  permissionButtonTextLight: {
    color: palette.card,
  },
});