import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
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
  hasSplitSchedule: boolean;
  opensAtSecondary: string;
  closesAtSecondary: string;
  updatedAt: string | null;
  updatedByName: string | null;
};

type ExceptionDraft = {
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
  hasSplitSchedule: boolean;
  opensAtSecondary: string;
  closesAtSecondary: string;
  note: string;
};

type TimePickerTarget =
  | {
      kind: "template";
      dayOfWeek: GymDayOfWeek;
      field: "opensAt" | "closesAt" | "opensAtSecondary" | "closesAtSecondary";
    }
  | {
      kind: "exception";
      field: "opensAt" | "closesAt" | "opensAtSecondary" | "closesAtSecondary";
    }
  | null;

const dayLabels: Record<GymDayOfWeek, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const daySequence: GymDayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const monthLabels = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const weekHeaders = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const toDayOfWeek = (date: Date): GymDayOfWeek => {
  const value = date.getDay();
  if (value === 0) {
    return "sunday";
  }

  return daySequence[value - 1];
};

const addThirtyMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "14:00";
  const total = ((h * 60 + m + 30) % (24 * 60));
  const hour = Math.floor(total / 60).toString().padStart(2, "0");
  const minute = (total % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
};

const timeStringToDate = (time: string): Date => {
  const [h, m] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(Number.isNaN(h) ? 8 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  return date;
};

const dateToTimeString = (date: Date): string =>
  `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

const isTimeConflict = (closesAt: string, opensAtSecondary: string): boolean => {
  if (!closesAt || !opensAtSecondary) return false;
  return closesAt >= opensAtSecondary;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const plusDays = (amount: number) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
};

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);

const formatDateForDisplay = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const shiftMonth = (base: Date, amount: number) =>
  new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + amount, 1));

const buildMonthMatrix = (monthStart: Date) => {
  const start = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1));
  const firstWeekday = (start.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const result: Array<Date | null> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    result.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    result.push(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day)));
  }

  while (result.length % 7 !== 0) {
    result.push(null);
  }

  return result;
};

const mapTemplateToDraft = (day: GymAvailabilityTemplateDay): TemplateDraft => ({
  dayOfWeek: day.dayOfWeek,
  isOpen: day.isOpen,
  opensAt: day.opensAt ?? "",
  closesAt: day.closesAt ?? "",
  hasSplitSchedule: Boolean(day.opensAtSecondary && day.closesAtSecondary),
  opensAtSecondary: day.opensAtSecondary ?? "",
  closesAtSecondary: day.closesAtSecondary ?? "",
  updatedAt: day.updatedAt,
  updatedByName: day.updatedBy?.fullName ?? null,
});

const emptyExceptionForm: ExceptionDraft = {
  isClosed: false,
  opensAt: "06:00",
  closesAt: "22:00",
  hasSplitSchedule: false,
  opensAtSecondary: "",
  closesAtSecondary: "",
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
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  });
  const [exceptionForm, setExceptionForm] = useState<ExceptionDraft>(emptyExceptionForm);
  const [timePickerTarget, setTimePickerTarget] = useState<TimePickerTarget>(null);
  const [timePickerDate, setTimePickerDate] = useState<Date>(new Date());
  const [expandedTemplateDays, setExpandedTemplateDays] = useState<Record<GymDayOfWeek, boolean>>({
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
  });

  const calendarDays = useMemo(() => buildMonthMatrix(calendarMonth), [calendarMonth]);

  const selectedException = useMemo(
    () => exceptions.find((item) => item.date === selectedExceptionDate) ?? null,
    [exceptions, selectedExceptionDate],
  );

  const orderedTemplateDrafts = useMemo(() => {
    const today = toDayOfWeek(new Date());
    const startIndex = daySequence.indexOf(today);
    const rotatedDays = [...daySequence.slice(startIndex), ...daySequence.slice(0, startIndex)];
    const byDay = new Map(templateDrafts.map((item) => [item.dayOfWeek, item]));

    return rotatedDays
      .map((dayOfWeek) => byDay.get(dayOfWeek))
      .filter((item): item is TemplateDraft => item !== undefined);
  }, [templateDrafts]);

  useEffect(() => {
    if (!selectedException) {
      setExceptionForm(emptyExceptionForm);
      return;
    }

    setExceptionForm({
      isClosed: selectedException.isClosed,
      opensAt: selectedException.opensAt ?? "06:00",
      closesAt: selectedException.closesAt ?? "22:00",
      hasSplitSchedule: Boolean(selectedException.opensAtSecondary && selectedException.closesAtSecondary),
      opensAtSecondary: selectedException.opensAtSecondary ?? "",
      closesAtSecondary: selectedException.closesAtSecondary ?? "",
      note: selectedException.note ?? "",
    });
  }, [selectedException]);

  const load = useCallback(
    async (isRefresh = false) => {
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
        Alert.alert("Error", error instanceof Error ? error.message : "No se pudo cargar la configuración");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

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

  const toggleTemplateExpanded = (dayOfWeek: GymDayOfWeek) => {
    setExpandedTemplateDays((current) => ({
      ...current,
      [dayOfWeek]: !current[dayOfWeek],
    }));
  };

  const onToggleTemplateOpen = (draft: TemplateDraft) => {
    if (!permissions.canWrite) {
      return;
    }

    if (draft.isOpen) {
      const nextDraft: TemplateDraft = {
        ...draft,
        isOpen: false,
        hasSplitSchedule: false,
        opensAtSecondary: "",
        closesAtSecondary: "",
      };
      updateTemplateDraft(draft.dayOfWeek, nextDraft);
      void onSaveTemplateDay(nextDraft);
      return;
    }

    const nextDraft: TemplateDraft = {
      ...draft,
      isOpen: true,
      opensAt: draft.opensAt || "06:00",
      closesAt: draft.closesAt || "22:00",
    };
    updateTemplateDraft(draft.dayOfWeek, nextDraft);
    void onSaveTemplateDay(nextDraft);
  };

  const onToggleTemplateSplitSchedule = (draft: TemplateDraft) => {
    if (!permissions.canWrite || !draft.isOpen) {
      return;
    }

    if (draft.hasSplitSchedule) {
      const nextDraft: TemplateDraft = {
        ...draft,
        hasSplitSchedule: false,
        opensAtSecondary: "",
        closesAtSecondary: "",
      };
      updateTemplateDraft(draft.dayOfWeek, nextDraft);
      void onSaveTemplateDay(nextDraft);
      return;
    }

    const defaultSecondaryOpen = draft.opensAtSecondary || addThirtyMinutes(draft.closesAt || "13:30");
    const defaultSecondaryClose = draft.closesAtSecondary || addThirtyMinutes(addThirtyMinutes(defaultSecondaryOpen));

    const nextDraft: TemplateDraft = {
      ...draft,
      hasSplitSchedule: true,
      opensAtSecondary: defaultSecondaryOpen,
      closesAtSecondary: defaultSecondaryClose,
    };
    updateTemplateDraft(draft.dayOfWeek, nextDraft);
    void onSaveTemplateDay(nextDraft);
  };

  const onToggleExceptionClosed = () => {
    if (!permissions.canWrite) {
      return;
    }

    setExceptionForm((current) => {
      const nextClosed = !current.isClosed;
      return {
        ...current,
        isClosed: nextClosed,
        opensAt: nextClosed ? current.opensAt : current.opensAt || "06:00",
        closesAt: nextClosed ? current.closesAt : current.closesAt || "22:00",
        hasSplitSchedule: nextClosed ? false : current.hasSplitSchedule,
        opensAtSecondary: nextClosed ? "" : current.opensAtSecondary,
        closesAtSecondary: nextClosed ? "" : current.closesAtSecondary,
      };
    });
  };

  const onToggleExceptionSplitSchedule = () => {
    if (!permissions.canWrite || exceptionForm.isClosed) {
      return;
    }

    setExceptionForm((current) => {
      if (current.hasSplitSchedule) {
        return {
          ...current,
          hasSplitSchedule: false,
          opensAtSecondary: "",
          closesAtSecondary: "",
        };
      }

      const defaultSecondaryOpen = current.opensAtSecondary || addThirtyMinutes(current.closesAt || "13:30");
      const defaultSecondaryClose = current.closesAtSecondary || addThirtyMinutes(addThirtyMinutes(defaultSecondaryOpen));

      return {
        ...current,
        hasSplitSchedule: true,
        opensAtSecondary: defaultSecondaryOpen,
        closesAtSecondary: defaultSecondaryClose,
      };
    });
  };

  const getCurrentFieldValue = (target: NonNullable<TimePickerTarget>): string => {
    if (target.kind === "template") {
      const draft = templateDrafts.find((item) => item.dayOfWeek === target.dayOfWeek);
      return draft ? (draft[target.field] ?? "") : "";
    }
    return exceptionForm[target.field] ?? "";
  };

  const openTimePicker = (target: NonNullable<TimePickerTarget>) => {
    const currentValue = getCurrentFieldValue(target);
    setTimePickerDate(timeStringToDate(currentValue || "08:00"));
    setTimePickerTarget(target);
  };

  const applySelectedTime = (value: string) => {
    if (!timePickerTarget) {
      return;
    }

    if (timePickerTarget.kind === "template") {
      const targetDraft = templateDrafts.find((item) => item.dayOfWeek === timePickerTarget.dayOfWeek);
      if (targetDraft) {
        const nextDraft = {
          ...targetDraft,
          [timePickerTarget.field]: value,
        } as TemplateDraft;
        updateTemplateDraft(timePickerTarget.dayOfWeek, nextDraft);
        void onSaveTemplateDay(nextDraft);
      }
    } else {
      setExceptionForm((current) => ({
        ...current,
        [timePickerTarget.field]: value,
      }));
    }

    setTimePickerTarget(null);
  };

  const onTimePickerChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      setTimePickerTarget(null);
    }
    if (date) {
      setTimePickerDate(date);
      if (Platform.OS === "android") {
        applySelectedTime(dateToTimeString(date));
      }
    } else if (Platform.OS === "android") {
      setTimePickerTarget(null);
    }
  };

  const onTimePickerConfirm = () => {
    applySelectedTime(dateToTimeString(timePickerDate));
  };

  const onSaveTemplateDay = async (draft: TemplateDraft) => {
    if (!token || !permissions.canWrite) {
      return;
    }

    if (draft.isOpen && draft.opensAt && draft.closesAt && draft.opensAt >= draft.closesAt) {
      Alert.alert(
        "Horario inválido",
        "La hora de cierre debe ser posterior a la hora de apertura.",
      );
      return;
    }

    if (draft.hasSplitSchedule && isTimeConflict(draft.closesAt, draft.opensAtSecondary)) {
      Alert.alert(
        "Horario inválido",
        "La hora de cierre del primer turno debe ser anterior a la apertura del segundo turno.",
      );
      return;
    }

    setSavingDay(draft.dayOfWeek);
    try {
      const response = await api.saveAvailabilityTemplateDay(token, draft.dayOfWeek, {
        isOpen: draft.isOpen,
        opensAt: draft.isOpen ? draft.opensAt : null,
        closesAt: draft.isOpen ? draft.closesAt : null,
        opensAtSecondary: draft.isOpen && draft.hasSplitSchedule ? draft.opensAtSecondary : null,
        closesAtSecondary: draft.isOpen && draft.hasSplitSchedule ? draft.closesAtSecondary : null,
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

    if (
      !exceptionForm.isClosed &&
      exceptionForm.opensAt &&
      exceptionForm.closesAt &&
      exceptionForm.opensAt >= exceptionForm.closesAt
    ) {
      Alert.alert(
        "Horario inválido",
        "La hora de cierre debe ser posterior a la hora de apertura.",
      );
      return;
    }

    if (
      !exceptionForm.isClosed &&
      exceptionForm.hasSplitSchedule &&
      isTimeConflict(exceptionForm.closesAt, exceptionForm.opensAtSecondary)
    ) {
      Alert.alert(
        "Horario inválido",
        "La hora de cierre del primer turno debe ser anterior a la apertura del segundo turno.",
      );
      return;
    }

    setSavingException(true);
    try {
      const response = await api.saveAvailabilityException(token, selectedExceptionDate, {
        isClosed: exceptionForm.isClosed,
        opensAt: exceptionForm.isClosed ? null : exceptionForm.opensAt,
        closesAt: exceptionForm.isClosed ? null : exceptionForm.closesAt,
        opensAtSecondary:
          exceptionForm.isClosed || !exceptionForm.hasSplitSchedule
            ? null
            : exceptionForm.opensAtSecondary,
        closesAtSecondary:
          exceptionForm.isClosed || !exceptionForm.hasSplitSchedule
            ? null
            : exceptionForm.closesAtSecondary,
        note: exceptionForm.note.trim() || null,
      });

      setExceptions((current) => {
        const filtered = current.filter((item) => item.date !== selectedExceptionDate);
        return [...filtered, response.exception].sort((left, right) =>
          left.date.localeCompare(right.date),
        );
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

  const onToggleTrainerNotifications = async (trainer: AvailabilityTrainerPermission) => {
    if (!token || !permissions.canGrant) {
      return;
    }

    setTogglingTrainerId(trainer.id);
    try {
      if (trainer.hasNotificationsSend) {
        await api.revokeNotificationsSend(token, trainer.id);
      } else {
        await api.grantNotificationsSend(token, trainer.id);
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={palette.cocoa}
        />
      }
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

        {orderedTemplateDrafts.map((draft) => (
          <View key={draft.dayOfWeek} style={styles.dayCard}>
            <TouchableOpacity style={styles.dayHeader} onPress={() => toggleTemplateExpanded(draft.dayOfWeek)}>
              <Text style={styles.dayLabel}>{dayLabels[draft.dayOfWeek]}</Text>
              <View style={styles.dayHeaderRight}>
                <TouchableOpacity
                  style={[styles.toggleChip, draft.isOpen ? styles.toggleChipOn : styles.toggleChipOff]}
                  disabled={!permissions.canWrite}
                  onPress={() => onToggleTemplateOpen(draft)}
                >
                  <Text style={[styles.toggleChipText, !draft.isOpen && styles.toggleChipTextOff]}>
                    {draft.isOpen ? "Abierto" : "Cerrado"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.expandIndicator}>{expandedTemplateDays[draft.dayOfWeek] ? "▾" : "▸"}</Text>
              </View>
            </TouchableOpacity>

            {expandedTemplateDays[draft.dayOfWeek] ? (
              <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Apertura</Text>
                <Pressable
                  style={[styles.selectInput, (!permissions.canWrite || !draft.isOpen) && styles.selectInputDisabled]}
                  disabled={!permissions.canWrite || !draft.isOpen}
                  onPress={() =>
                    openTimePicker({
                      kind: "template",
                      dayOfWeek: draft.dayOfWeek,
                      field: "opensAt",
                    })
                  }
                >
                  <Text style={styles.selectInputText}>{draft.opensAt || "Seleccionar"}</Text>
                </Pressable>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>Cierre</Text>
                <Pressable
                  style={[styles.selectInput, (!permissions.canWrite || !draft.isOpen) && styles.selectInputDisabled]}
                  disabled={!permissions.canWrite || !draft.isOpen}
                  onPress={() =>
                    openTimePicker({
                      kind: "template",
                      dayOfWeek: draft.dayOfWeek,
                      field: "closesAt",
                    })
                  }
                >
                  <Text style={styles.selectInputText}>{draft.closesAt || "Seleccionar"}</Text>
                </Pressable>
              </View>
              </View>
            ) : null}

            {draft.isOpen && expandedTemplateDays[draft.dayOfWeek] ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.toggleChip,
                    draft.hasSplitSchedule ? styles.toggleChipOn : styles.toggleChipOff,
                    !permissions.canWrite && styles.selectInputDisabled,
                  ]}
                  disabled={!permissions.canWrite}
                  onPress={() => onToggleTemplateSplitSchedule(draft)}
                >
                  <Text style={[styles.toggleChipText, !draft.hasSplitSchedule && styles.toggleChipTextOff]}>
                    {draft.hasSplitSchedule ? "Horario diferido activado" : "Activar horario diferido"}
                  </Text>
                </TouchableOpacity>

                {draft.hasSplitSchedule ? (
                  <View style={styles.fieldRow}>
                    <View style={styles.fieldHalf}>
                      <Text style={styles.fieldLabel}>Apertura 2</Text>
                      <Pressable
                        style={styles.selectInput}
                        disabled={!permissions.canWrite}
                        onPress={() =>
                          openTimePicker({
                            kind: "template",
                            dayOfWeek: draft.dayOfWeek,
                            field: "opensAtSecondary",
                          })
                        }
                      >
                        <Text style={styles.selectInputText}>{draft.opensAtSecondary || "Seleccionar"}</Text>
                      </Pressable>
                    </View>
                    <View style={styles.fieldHalf}>
                      <Text style={styles.fieldLabel}>Cierre 2</Text>
                      <Pressable
                        style={[
                          styles.selectInput,
                          isTimeConflict(draft.closesAt, draft.opensAtSecondary) && styles.selectInputError,
                        ]}
                        disabled={!permissions.canWrite}
                        onPress={() =>
                          openTimePicker({
                            kind: "template",
                            dayOfWeek: draft.dayOfWeek,
                            field: "closesAtSecondary",
                          })
                        }
                      >
                        <Text style={styles.selectInputText}>{draft.closesAtSecondary || "Seleccionar"}</Text>
                      </Pressable>
                      {isTimeConflict(draft.closesAt, draft.opensAtSecondary) ? (
                        <Text style={styles.fieldError}>El cierre del turno 1 debe ser anterior a la apertura del turno 2</Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            {draft.updatedAt ? (
              <Text style={styles.auditText}>Ultima edicion: {draft.updatedByName ?? "Sin nombre"}</Text>
            ) : (
              <Text style={styles.auditText}>Aun no publicado</Text>
            )}

            {savingDay === draft.dayOfWeek ? <Text style={styles.savingHint}>Guardando cambios...</Text> : null}
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Dia especial</Text>
        <Text style={styles.sectionCopy}>Sobrescribe el horario estandar para una fecha puntual.</Text>

        <Text style={styles.fieldLabel}>Fecha</Text>
        <Pressable
          style={[styles.selectInput, !permissions.canWrite && styles.selectInputDisabled]}
          disabled={!permissions.canWrite}
          onPress={() => {
            const current = parseDateKey(selectedExceptionDate);
            setCalendarMonth(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)));
            setCalendarVisible(true);
          }}
        >
          <Text style={styles.selectInputText}>{formatDateForDisplay(selectedExceptionDate)}</Text>
        </Pressable>

        <TouchableOpacity
          style={[styles.toggleChip, exceptionForm.isClosed ? styles.toggleChipOff : styles.toggleChipOn]}
          disabled={!permissions.canWrite}
          onPress={onToggleExceptionClosed}
        >
          <Text style={[styles.toggleChipText, exceptionForm.isClosed && styles.toggleChipTextOff]}>
            {exceptionForm.isClosed ? "Dia cerrado" : "Dia abierto"}
          </Text>
        </TouchableOpacity>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Apertura</Text>
            <Pressable
              style={[styles.selectInput, (!permissions.canWrite || exceptionForm.isClosed) && styles.selectInputDisabled]}
              disabled={!permissions.canWrite || exceptionForm.isClosed}
              onPress={() => openTimePicker({ kind: "exception", field: "opensAt" })}
            >
              <Text style={styles.selectInputText}>{exceptionForm.opensAt || "Seleccionar"}</Text>
            </Pressable>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.fieldLabel}>Cierre</Text>
            <Pressable
              style={[styles.selectInput, (!permissions.canWrite || exceptionForm.isClosed) && styles.selectInputDisabled]}
              disabled={!permissions.canWrite || exceptionForm.isClosed}
              onPress={() => openTimePicker({ kind: "exception", field: "closesAt" })}
            >
              <Text style={styles.selectInputText}>{exceptionForm.closesAt || "Seleccionar"}</Text>
            </Pressable>
          </View>
        </View>

        {!exceptionForm.isClosed ? (
          <>
            <TouchableOpacity
              style={[styles.toggleChip, exceptionForm.hasSplitSchedule ? styles.toggleChipOn : styles.toggleChipOff]}
              disabled={!permissions.canWrite}
              onPress={onToggleExceptionSplitSchedule}
            >
              <Text style={[styles.toggleChipText, !exceptionForm.hasSplitSchedule && styles.toggleChipTextOff]}>
                {exceptionForm.hasSplitSchedule ? "Horario diferido activado" : "Activar horario diferido"}
              </Text>
            </TouchableOpacity>

            {exceptionForm.hasSplitSchedule ? (
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Apertura 2</Text>
                  <Pressable
                    style={[styles.selectInput, !permissions.canWrite && styles.selectInputDisabled]}
                    disabled={!permissions.canWrite}
                    onPress={() => openTimePicker({ kind: "exception", field: "opensAtSecondary" })}
                  >
                    <Text style={styles.selectInputText}>{exceptionForm.opensAtSecondary || "Seleccionar"}</Text>
                  </Pressable>
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Cierre 2</Text>
                  <Pressable
                    style={[
                      styles.selectInput,
                      !permissions.canWrite && styles.selectInputDisabled,
                      isTimeConflict(exceptionForm.closesAt, exceptionForm.opensAtSecondary) && styles.selectInputError,
                    ]}
                    disabled={!permissions.canWrite}
                    onPress={() => openTimePicker({ kind: "exception", field: "closesAtSecondary" })}
                  >
                    <Text style={styles.selectInputText}>{exceptionForm.closesAtSecondary || "Seleccionar"}</Text>
                  </Pressable>
                  {isTimeConflict(exceptionForm.closesAt, exceptionForm.opensAtSecondary) ? (
                    <Text style={styles.fieldError}>El cierre del turno 1 debe ser anterior a la apertura del turno 2</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

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
                <Text style={styles.auditText}>
                  {trainer.hasNotificationsSend
                    ? `Puede enviar notificaciones${trainer.notificationsGrantedBy ? ` (por ${trainer.notificationsGrantedBy.fullName})` : ""}`
                    : "Sin autorización para enviar notificaciones"}
                </Text>
              </View>
              <View style={styles.permissionButtonsWrap}>
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
                      trainer.hasAvailabilityWrite
                        ? styles.permissionButtonTextLight
                        : styles.permissionButtonTextDark,
                    ]}
                  >
                    {togglingTrainerId === trainer.id
                      ? "Actualizando..."
                      : trainer.hasAvailabilityWrite
                        ? "Revocar horario"
                        : "Autorizar horario"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.permissionButton,
                    trainer.hasNotificationsSend ? styles.permissionButtonRevoke : styles.permissionButtonGrant,
                  ]}
                  disabled={togglingTrainerId === trainer.id}
                  onPress={() => void onToggleTrainerNotifications(trainer)}
                >
                  <Text
                    style={[
                      styles.permissionButtonText,
                      trainer.hasNotificationsSend
                        ? styles.permissionButtonTextLight
                        : styles.permissionButtonTextDark,
                    ]}
                  >
                    {togglingTrainerId === trainer.id
                      ? "Actualizando..."
                      : trainer.hasNotificationsSend
                        ? "Revocar notificaciones"
                        : "Autorizar notificaciones"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Native time picker — Android shows dialog directly */}
      {Boolean(timePickerTarget) && Platform.OS === "android" ? (
        <DateTimePicker
          value={timePickerDate}
          mode="time"
          is24Hour
          display="default"
          onChange={onTimePickerChange}
        />
      ) : null}

      {/* Native time picker — iOS spinner in modal */}
      <Modal
        visible={Boolean(timePickerTarget) && Platform.OS === "ios"}
        animationType="slide"
        transparent
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona una hora</Text>
            <DateTimePicker
              value={timePickerDate}
              mode="time"
              is24Hour
              display="spinner"
              themeVariant="light"
              onChange={onTimePickerChange}
              style={{ width: "100%" }}
            />
            <View style={styles.iosTimePickerActions}>
              <Pressable style={styles.modalCloseButton} onPress={() => setTimePickerTarget(null)}>
                <Text style={styles.modalCloseButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.iosTimePickerConfirm} onPress={onTimePickerConfirm}>
                <Text style={styles.iosTimePickerConfirmText}>Listo</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={calendarVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.calendarHeader}>
              <Pressable
                style={styles.calendarArrowButton}
                onPress={() => setCalendarMonth((current) => shiftMonth(current, -1))}
              >
                <Text style={styles.calendarArrowText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.calendarMonthTitle}>
                {monthLabels[calendarMonth.getUTCMonth()]} {calendarMonth.getUTCFullYear()}
              </Text>
              <Pressable
                style={styles.calendarArrowButton}
                onPress={() => setCalendarMonth((current) => shiftMonth(current, 1))}
              >
                <Text style={styles.calendarArrowText}>{">"}</Text>
              </Pressable>
            </View>

            <View style={styles.calendarWeekHeaderRow}>
              {weekHeaders.map((header) => (
                <Text key={header} style={styles.calendarWeekHeaderCell}>
                  {header}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((dateValue, index) => {
                if (!dateValue) {
                  return <View key={`empty-${index}`} style={styles.calendarDayCellEmpty} />;
                }

                const dateKey = toDateKey(dateValue);
                const isSelected = dateKey === selectedExceptionDate;

                return (
                  <Pressable
                    key={dateKey}
                    style={[styles.calendarDayCell, isSelected && styles.calendarDayCellSelected]}
                    onPress={() => {
                      setSelectedExceptionDate(dateKey);
                      setCalendarVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {dateValue.getUTCDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.modalCloseButton} onPress={() => setCalendarVisible(false)}>
              <Text style={styles.modalCloseButtonText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  dayHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expandIndicator: {
    color: palette.cocoa,
    fontSize: 16,
    fontWeight: "800",
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
    alignSelf: "flex-start",
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
  selectInput: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: palette.cream,
  },
  selectInputDisabled: {
    opacity: 0.6,
  },
  selectInputError: {
    borderColor: "#EF4444",
    borderWidth: 1.5,
  },
  fieldError: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  selectInputText: {
    color: palette.ink,
    fontWeight: "700",
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
  savingHint: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 12,
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
  permissionButtonsWrap: {
    width: 190,
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(42, 35, 28, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    backgroundColor: palette.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    color: palette.cocoa,
    fontSize: 18,
    fontWeight: "800",
  },
  modalList: {
    maxHeight: 320,
  },
  modalListContent: {
    gap: 8,
  },
  modalOption: {
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cream,
  },
  modalOptionText: {
    color: palette.cocoa,
    fontWeight: "700",
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  modalCloseButtonText: {
    color: palette.cocoa,
    fontWeight: "800",
  },
  iosTimePickerActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  iosTimePickerConfirm: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: palette.cocoa,
  },
  iosTimePickerConfirmText: {
    color: "#fff",
    fontWeight: "800",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.cream,
  },
  calendarArrowText: {
    color: palette.cocoa,
    fontWeight: "800",
    fontSize: 16,
  },
  calendarMonthTitle: {
    color: palette.cocoa,
    fontSize: 17,
    fontWeight: "800",
  },
  calendarWeekHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calendarWeekHeaderCell: {
    width: "14.285%",
    textAlign: "center",
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
  },
  calendarDayCell: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.cream,
  },
  calendarDayCellEmpty: {
    width: "14.285%",
    aspectRatio: 1,
  },
  calendarDayCellSelected: {
    backgroundColor: palette.cocoa,
    borderColor: palette.cocoa,
  },
  calendarDayText: {
    color: palette.cocoa,
    fontWeight: "700",
  },
  calendarDayTextSelected: {
    color: palette.card,
  },
});
