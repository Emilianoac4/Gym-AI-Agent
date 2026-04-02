import React, { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { useAuth } from "../../context/AuthContext";
import { AppButton } from "../../components/AppButton";
import { palette } from "../../theme/palette";
import { UserRole } from "../../types/api";

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login, loginWithGoogle, loginWithApple, loading } = useAuth();

  const [email, setEmail] = useState("admin@gymiai.com");
  const [password, setPassword] = useState("Admin123456");
  const [selectedRole, setSelectedRole] = useState<UserRole>("member");

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
      await login(email.trim(), password, selectedRole);
    } catch (error) {
      Alert.alert("No fue posible ingresar", error instanceof Error ? error.message : "Error inesperado");
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
        "Google OAuth requiere un Development Build en iOS. En Expo Go este flujo es bloqueado por politica de OAuth.",
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

      await loginWithApple(credential.identityToken, selectedRole);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("The user canceled the authorization attempt")
      ) {
        return;
      }

      Alert.alert(
        "Apple",
        error instanceof Error ? error.message : "No fue posible iniciar sesion con Apple.",
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
        await loginWithGoogle(idToken, selectedRole);
      } catch (error) {
        Alert.alert(
          "Google",
          error instanceof Error ? error.message : "No fue posible iniciar sesion con Google.",
        );
      }
    };

    run();
  }, [googleResponse, loginWithGoogle, selectedRole]);

  const roleOptions: Array<{ role: UserRole; label: string }> = [
    { role: "member", label: "Usuario" },
    { role: "trainer", label: "Entrenador" },
    { role: "admin", label: "Administrador" },
  ];

  return (
    <LinearGradient colors={palette.gradientHero} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>GymAI</Text>
        <Text style={styles.title}>Entrena con inteligencia</Text>
        <Text style={styles.subtitle}>Tu progreso, mediciones y coach IA en una sola app.</Text>

        <View style={styles.roleSelector}>
          <Text style={styles.roleSelectorTitle}>Selecciona tu acceso</Text>
          <View style={styles.roleTabs}>
            {roleOptions.map((option) => {
              const isActive = selectedRole === option.role;
              return (
                <TouchableOpacity
                  key={option.role}
                  style={[styles.roleTab, isActive ? styles.roleTabActive : styles.roleTabInactive]}
                  onPress={() => setSelectedRole(option.role)}
                  disabled={loading}
                >
                  <Text style={[styles.roleTabText, isActive ? styles.roleTabTextActive : styles.roleTabTextInactive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.roleHint}>
            Inicia sesion con el perfil que deseas usar. Si tu cuenta no coincide, el acceso sera denegado.
          </Text>
        </View>

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
          placeholder="Email"
          placeholderTextColor={palette.textSoft}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Contrasena"
          placeholderTextColor={palette.textSoft}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <AppButton label={loading ? "Ingresando..." : "Iniciar sesion"} onPress={onLogin} disabled={loading} />

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

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Crear cuenta inicial de gimnasio</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
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
  roleSelector: {
    marginBottom: 14,
  },
  roleSelectorTitle: {
    color: palette.ink,
    fontWeight: "700",
    marginBottom: 8,
  },
  roleTabs: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  roleTab: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  roleTabActive: {
    backgroundColor: palette.cocoa,
    borderColor: palette.cocoa,
  },
  roleTabInactive: {
    backgroundColor: palette.cream,
    borderColor: palette.line,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  roleTabTextActive: {
    color: palette.gold,
  },
  roleTabTextInactive: {
    color: palette.ink,
  },
  roleHint: {
    marginTop: 8,
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
