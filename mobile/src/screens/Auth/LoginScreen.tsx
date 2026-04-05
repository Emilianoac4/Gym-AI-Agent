import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { AppButton } from "../../components/AppButton";
import { palette } from "../../theme/palette";
import { api } from "../../services/api";

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login, loginWithGoogle, loginWithApple, loading } = useAuth();

  const [identifier, setIdentifier] = useState("admin@gymiai.com");
  const [password, setPassword] = useState("Admin123456");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sendingRecovery, setSendingRecovery] = useState(false);

  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

  const googleExpoClientId = env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  const googleIosClientId = env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? googleExpoClientId;
  const googleAndroidClientId = env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? googleExpoClientId;
  const googleWebClientId = env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? googleExpoClientId;
  const shouldPreferExpoClient = Boolean(googleExpoClientId || googleWebClientId);
  const runningInExpoGo = Constants.executionEnvironment === "storeClient";

  const hasGoogleClientId = Boolean(
    googleExpoClientId || googleWebClientId || googleIosClientId || googleAndroidClientId,
  );
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    clientId: googleExpoClientId ?? googleWebClientId ?? googleIosClientId,
    iosClientId: shouldPreferExpoClient ? undefined : (googleIosClientId ?? undefined),
    androidClientId: googleAndroidClientId ?? undefined,
    webClientId: googleWebClientId ?? undefined,
  });

  const onLogin = async () => {
    try {
      setAuthError(null);
      await login(identifier.trim(), password);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No fue posible iniciar sesión.");
    }
  };

  const onResendVerification = async () => {
    const normalizedEmail = identifier.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert("Correo requerido", "Ingresa tu correo para reenviar la verificación.");
      return;
    }
    if (!normalizedEmail.includes("@")) {
      Alert.alert("Correo requerido", "Para reenviar verificación debes ingresar tu correo electrónico.");
      return;
    }

    try {
      const data = await api.requestEmailVerification({ email: normalizedEmail });
      Alert.alert(
        "Verificación enviada",
        `${data.message}${data.devToken ? `\n\nToken (dev): ${data.devToken}` : ""}`,
      );
    } catch (error) {
      Alert.alert(
        "Error",
          error instanceof Error ? error.message : "No se pudo reenviar la verificación.",
      );
    }
  };

  const onForgotPassword = async () => {
    const normalizedEmail = identifier.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert("Correo requerido", "Ingresa tu correo para recuperar la contraseña.");
      return;
    }
    if (!normalizedEmail.includes("@")) {
      Alert.alert("Correo requerido", "Para recuperar contraseña debes ingresar tu correo electrónico.");
      return;
    }

    try {
      setSendingRecovery(true);
      const data = await api.forgotPassword({ email: normalizedEmail });
      Alert.alert(
        "Recuperación enviada",
        `${data.message}${data.devToken ? `\n\nToken (dev): ${data.devToken}` : ""}`,
      );
    } catch (error) {
      Alert.alert(
        "Error",
         error instanceof Error ? error.message : "No se pudo iniciar la recuperación de contraseña.",
      );
    } finally {
      setSendingRecovery(false);
    }
  };

  const onGoogleLogin = async () => {
    if (!hasGoogleClientId || !googleRequest) {
      Alert.alert(
        "Google no configurado",
        "Falta configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID o EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID en mobile/.env y reiniciar Expo.",
      );
      return;
    }

    if (runningInExpoGo) {
      Alert.alert(
        "Google no disponible en Expo Go",
        "Google OAuth requiere un Development Build en iOS. En Expo Go este flujo es bloqueado por política de OAuth.",
      );
      return;
    }

    const result = await promptGoogleAsync();

    if (result.type === "cancel") {
      return;
    }

    if (result.type !== "success") {
      Alert.alert("Google", "No fue posible completar el acceso con Google.");
    }
  };

  const onAppleLogin = async () => {
    if (Platform.OS !== "ios") {
      Alert.alert("No disponible", "Apple solo esta disponible en iOS.");
      return;
    }

    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("No disponible", "Apple no esta disponible en este dispositivo.");
      return;
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple no devolvio un token valido.");
      }

      await loginWithApple(credential.identityToken);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("The user canceled the authorization attempt")
      ) {
        return;
      }

      Alert.alert(
        "Apple",
        error instanceof Error ? error.message : "No fue posible iniciar sesión con Apple.",
      );
    }
  };

  useEffect(() => {
    const run = async () => {
      if (googleResponse?.type !== "success") {
        return;
      }

      const idToken =
        googleResponse.authentication?.idToken ??
        ((googleResponse as unknown as { params?: Record<string, string> }).params?.id_token ?? "");

      if (!idToken) {
        Alert.alert("Google", "Google no devolvio un token valido.");
        return;
      }

      try {
        setAuthError(null);
        await loginWithGoogle(idToken);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "No fue posible iniciar sesión con Google.");
      }
    };

    run();
  }, [googleResponse, loginWithGoogle]);

  return (
    <LinearGradient colors={palette.gradientHero} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>GymAI</Text>
        <Text style={styles.title}>Entrena con inteligencia</Text>
        <Text style={styles.subtitle}>Tu progreso, mediciones y coach IA en una sola app.</Text>

        {authError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBadge}>Acceso</Text>
              <Text style={styles.errorTitle}>No fue posible ingresar</Text>
              <Text style={styles.errorText}>{authError}</Text>
              {authError.toLowerCase().includes("verificar tu correo") ? (
                <TouchableOpacity onPress={onResendVerification} style={styles.errorActionButton}>
                  <Text style={styles.errorActionText}>Reenviar verificacion</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setAuthError(null)} style={styles.errorDismissButton}>
                <Text style={styles.errorDismissText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          ) : null}

        <View style={styles.highlightStrip}>
          <View style={styles.highlightPill}>
            <Text style={styles.highlightText}>Rutinas IA</Text>
          </View>
          <View style={styles.highlightPillAlt}>
            <Text style={styles.highlightTextAlt}>Seguimiento real</Text>
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Correo o nombre de usuario"
          placeholderTextColor={palette.textSoft}
          keyboardType="default"
          autoCapitalize="none"
          value={identifier}
          onChangeText={setIdentifier}
        />

        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Contraseña"
            placeholderTextColor={palette.textSoft}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowPassword((v) => !v)}>
            <MaterialCommunityIcons
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={palette.moss}
            />
          </TouchableOpacity>
        </View>

        <AppButton label={loading ? "Ingresando..." : "Iniciar sesión"} onPress={onLogin} disabled={loading} />

        <TouchableOpacity disabled={sendingRecovery} onPress={onForgotPassword}>
          <Text style={styles.recoveryLink}>
            {sendingRecovery ? "Enviando recuperación..." : "Olvidé mi contraseña"}
          </Text>
        </TouchableOpacity>

        <View style={styles.socialGroup}>
          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton]}
            onPress={onGoogleLogin}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>Continuar con Google</Text>
          </TouchableOpacity>

          {Platform.OS === "ios" ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={onAppleLogin}
            />
          ) : null}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("ContactSales")}>
            <Text style={styles.link}>Crear cuenta inicial de gimnasio</Text>
          </TouchableOpacity>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.cocoa,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  eyebrow: {
    color: palette.coral,
    fontWeight: "700",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    color: palette.ink,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    color: palette.textMuted,
    lineHeight: 20,
  },
  errorBanner: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D97B53",
    backgroundColor: "#FFF0E8",
    padding: 12,
    gap: 4,
  },
  errorBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.coral,
    color: "#FFF7EF",
    fontSize: 11,
    fontWeight: "800",
  },
  errorTitle: {
    marginTop: 4,
    color: palette.cocoa,
    fontWeight: "800",
    fontSize: 13,
  },
  errorText: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorDismissButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: palette.cocoa,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  errorDismissText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "800",
  },
  errorActionButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: palette.moss,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  errorActionText: {
    color: palette.cream,
    fontSize: 11,
    fontWeight: "800",
  },
  recoveryLink: {
    marginTop: 10,
    color: palette.cocoa,
    fontWeight: "700",
    textDecorationLine: "underline",
    textAlign: "center",
  },
  highlightStrip: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  highlightPill: {
    backgroundColor: palette.moss,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightPillAlt: {
    backgroundColor: palette.cocoa,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightText: {
    color: palette.cocoa,
    fontWeight: "700",
    fontSize: 12,
  },
  highlightTextAlt: {
    color: palette.gold,
    fontWeight: "700",
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: palette.cream,
    color: palette.ink,
  },
  passwordRow: {
    position: "relative",
    marginBottom: 12,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 84,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  passwordToggleText: {
    color: palette.moss,
    fontWeight: "700",
    fontSize: 12,
  },
  link: {
    color: palette.cocoa,
    textAlign: "center",
    marginTop: 14,
    fontWeight: "600",
  },
  socialGroup: {
    marginTop: 6,
    gap: 10,
  },
  socialButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  googleButton: {
    borderColor: palette.line,
    backgroundColor: palette.cream,
  },
  googleButtonText: {
    color: palette.ink,
    fontWeight: "700",
  },
  appleButton: {
    width: "100%",
    height: 44,
  },
});
