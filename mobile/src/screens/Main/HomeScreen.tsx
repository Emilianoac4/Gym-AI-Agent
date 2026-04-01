import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { AppButton } from "../../components/AppButton";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { palette } from "../../theme/palette";
import { ProgressSummary, StrengthProgressSummary } from "../../types/api";

const memberHighlights = [
  {
    title: "Medicion corporal inteligente",
    detail: "Registro automatico, carga manual y progreso semanal en un solo flujo.",
  },
  {
    title: "Rutina por objetivo",
    detail: "Planes ajustados por lesiones, disponibilidad y cargas historicas.",
  },
  {
    title: "Coach y asistencia",
    detail: "Boton para pedir ayuda al coach y luego calificar su respuesta.",
  },
];

const adminHighlights = [
  {
    title: "Actividad del gimnasio",
    detail: "Picos de afluencia, horas fuertes y lectura de asistencia por biometria.",
  },
  {
    title: "Retencion de clientes",
    detail: "Alertas de abandono antes de vencer la suscripcion y campanas de reactivacion.",
  },
  {
    title: "Satisfaccion operacional",
    detail: "Uso de maquinas, llegada de colaboradores y score de resolucion del coach.",
  },
];

export function HomeScreen() {
  const { user, token, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const highlights = isAdmin ? adminHighlights : memberHighlights;
  const roleLabel = isAdmin ? "Dueno del gimnasio" : "Miembro";
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [strengthSummary, setStrengthSummary] =
    useState<StrengthProgressSummary | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!user || !token || isAdmin) {
        setSummary(null);
        setStrengthSummary(null);
        return;
      }

      try {
        const [progress, strength] = await Promise.all([
          api.getProgressSummary(user.id, token),
          api.getStrengthProgress(user.id, token, 90),
        ]);
        setSummary(progress.summary);
        setStrengthSummary(strength.summary);
      } catch {
        setSummary(null);
        setStrengthSummary(null);
      }
    };

    void loadSummary();
  }, [isAdmin, token, user]);

  // Refresh data whenever the Home tab gains focus (e.g. coming back from Routine/Measurements)
  useFocusEffect(
    useCallback(() => {
      if (!user || !token || isAdmin) return;
      let cancelled = false;
      const reload = async () => {
        try {
          const [progress, strength] = await Promise.all([
            api.getProgressSummary(user.id, token),
            api.getStrengthProgress(user.id, token, 90),
          ]);
          if (!cancelled) {
            setSummary(progress.summary);
            setStrengthSummary(strength.summary);
          }
        } catch {
          // keep previous values if refresh fails
        }
      };
      void reload();
      return () => { cancelled = true; };
    }, [isAdmin, token, user])
  );

  const memberMainText = useMemo(() => {
    if (isAdmin) {
      return "Retener clientes en riesgo";
    }

    if (!summary) {
      return "Completa tu perfil, rutina y primer check-in";
    }

    return summary.nextAction;
  }, [isAdmin, summary]);

  const memberSecondaryText = useMemo(() => {
    if (isAdmin) {
      return "84% satisfaccion coach";
    }

    if (!summary) {
      return "Coach disponible para rutina, dieta y lesion";
    }

    const streak = summary.weeklyCheckInStreak;
    const pending = summary.hasMeasurementThisWeek ? "check-in al dia" : "check-in pendiente";
    const strengthPart = strengthSummary
      ? ` | ${strengthSummary.improvingExercises} ejercicios mejorando`
      : "";
    return `${streak} semana(s) de racha, ${pending}${strengthPart}`;
  }, [isAdmin, strengthSummary, summary]);

  return (
    <LinearGradient colors={[palette.cream, palette.gold, palette.coral]} style={styles.shell}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.welcome}>Hola, {user?.fullName ?? "Atleta"}</Text>
          <Text style={styles.hero}>GymAI con foco claro por tipo de usuario</Text>
          <Text style={styles.heroSubtitle}>
            Esta vista prueba la identidad visual con la nueva paleta y aterriza las funciones clave para {roleLabel.toLowerCase()}.
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>MVP visual</Text>
            </View>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCardPrimary}>
            <Text style={styles.kpiLabelDark}>{isAdmin ? "Insight principal" : "Siguiente accion"}</Text>
            <Text style={styles.kpiValueDark}>{memberMainText}</Text>
          </View>
          <View style={styles.kpiCardSecondary}>
            <Text style={styles.kpiLabelLight}>{isAdmin ? "Indicador" : "Coach IA"}</Text>
            <Text style={styles.kpiValueLight}>{memberSecondaryText}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>{isAdmin ? "Panel de gestion" : "Experiencia del miembro"}</Text>
          <Text style={styles.sectionTitle}>{isAdmin ? "Funciones que debe dominar el dueno" : "Funciones que mas valor entregan al atleta"}</Text>
          {highlights.map((item) => (
            <View key={item.title} style={styles.featureItem}>
              <View style={styles.featureDot} />
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.twoColumnRow}>
          <View style={styles.miniCardWarm}>
            <Text style={styles.miniLabel}>Plus</Text>
            <Text style={styles.miniValue}>Gimnasio tecnologico y diferenciador</Text>
          </View>
          <View style={styles.miniCardDark}>
            <Text style={styles.miniLabelDark}>Operacion</Text>
            <Text style={styles.miniValueDark}>Optimizacion de planilla y acompanamiento medible</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton label="Cerrar sesion" onPress={logout} />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: palette.card,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.cocoa,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  welcome: {
    color: palette.coral,
    fontWeight: "700",
    fontSize: 14,
  },
  hero: {
    color: palette.cocoa,
    fontSize: 32,
    lineHeight: 38,
    marginTop: 8,
    fontWeight: "800",
    maxWidth: 320,
  },
  heroSubtitle: {
    marginTop: 12,
    color: "#6B5B4B",
    lineHeight: 21,
    fontSize: 14,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
  },
  roleBadge: {
    backgroundColor: palette.moss,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleBadgeText: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 12,
  },
  statusBadge: {
    backgroundColor: palette.cocoa,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeText: {
    color: palette.gold,
    fontWeight: "700",
    fontSize: 12,
  },
  kpiRow: {
    flexDirection: "column",
    marginTop: 26,
    gap: 12,
  },
  kpiCardPrimary: {
    backgroundColor: palette.moss,
    borderRadius: 24,
    padding: 18,
  },
  kpiCardSecondary: {
    backgroundColor: palette.cocoa,
    borderRadius: 24,
    padding: 18,
  },
  kpiLabelDark: {
    color: "#5A4C40",
    fontSize: 12,
    fontWeight: "700",
  },
  kpiValueDark: {
    color: palette.cocoa,
    marginTop: 6,
    fontWeight: "800",
    fontSize: 18,
  },
  kpiLabelLight: {
    color: "#EEDDB6",
    fontSize: 12,
    fontWeight: "700",
  },
  kpiValueLight: {
    color: palette.cream,
    marginTop: 6,
    fontWeight: "800",
    fontSize: 18,
  },
  sectionCard: {
    marginTop: 18,
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.line,
  },
  sectionEyebrow: {
    color: palette.coral,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionTitle: {
    color: palette.cocoa,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 14,
  },
  featureItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: palette.sand,
  },
  featureDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: palette.gold,
    marginTop: 4,
  },
  featureCopy: {
    flex: 1,
  },
  featureTitle: {
    color: palette.cocoa,
    fontWeight: "800",
    fontSize: 15,
  },
  featureDetail: {
    color: "#6B5B4B",
    marginTop: 4,
    lineHeight: 20,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  miniCardWarm: {
    flex: 1,
    backgroundColor: palette.gold,
    borderRadius: 20,
    padding: 16,
  },
  miniCardDark: {
    flex: 1,
    backgroundColor: palette.cocoa,
    borderRadius: 20,
    padding: 16,
  },
  miniLabel: {
    color: "#72552E",
    fontWeight: "700",
    fontSize: 12,
  },
  miniValue: {
    color: palette.cocoa,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  miniLabelDark: {
    color: "#EEDDB6",
    fontWeight: "700",
    fontSize: 12,
  },
  miniValueDark: {
    color: palette.cream,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  actions: {
    marginTop: 24,
    marginBottom: 12,
  },
});
