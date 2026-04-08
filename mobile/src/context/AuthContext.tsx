import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { api } from "../services/api";
import { AuthUser, GymSelectionOption } from "../types/api";

// Show in-app notifications as banners
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  pendingGymSelection: { selectorToken: string; gyms: GymSelectionOption[] } | null;
  login: (identifier: string, password: string) => Promise<void>;
  selectGym: (userId: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (idToken: string) => Promise<void>;
  completeTemporaryPasswordChange: (newPassword: string) => Promise<void>;
  registerAdmin: (input: {
    gymName: string;
    ownerName: string;
    email: string;
    password: string;
    fullName: string;
    username: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_STORAGE_KEY = "tuco.auth.session.v1";

type StoredSession = {
  token: string;
  refreshToken: string;
  user: AuthUser;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingGymSelection, setPendingGymSelection] = useState<{
    selectorToken: string;
    gyms: GymSelectionOption[];
  } | null>(null);
  const pushTokenRef = useRef<string | null>(null);

  const persistSession = async (session: StoredSession) => {
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
  };

  const clearSessionStorage = async () => {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  };

  const applySession = async (session: StoredSession) => {
    setPendingGymSelection(null);
    setToken(session.token);
    setRefreshToken(session.refreshToken);
    setUser(session.user);
    await persistSession(session);
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
        if (!raw) {
          return;
        }

        const stored = JSON.parse(raw) as Partial<StoredSession>;
        if (!stored?.refreshToken) {
          await clearSessionStorage();
          return;
        }

        const refreshed = await api.refreshSession(stored.refreshToken);
        await applySession({
          token: refreshed.token,
          refreshToken: refreshed.refreshToken,
          user: refreshed.user,
        });
      } catch {
        setPendingGymSelection(null);
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        await clearSessionStorage().catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Register device push token whenever the user authenticates
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#22C55E",
          });
        }

        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId ??
          undefined;
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (!tokenData?.data) return;
        pushTokenRef.current = tokenData.data;
        const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
        await api.registerPushToken(token, { token: tokenData.data, platform });
      } catch (e) {
        // push token registration is best-effort
        console.warn("[PUSH] token registration failed:", e);
      }
    })();
  }, [token]);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.login({ identifier, password });
      if (data.requiresGymSelection && data.selectorToken && data.gyms) {
        await clearSessionStorage().catch(() => {});
        setPendingGymSelection({ selectorToken: data.selectorToken, gyms: data.gyms });
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        return;
      }

      if (!data.token || !data.refreshToken || !data.user) {
        throw new Error("Respuesta de autenticacion invalida");
      }

      await applySession({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } finally {
      setLoading(false);
    }
  };

  const selectGym = async (userId: string) => {
    if (!pendingGymSelection) {
      throw new Error("No hay selección de gimnasio pendiente");
    }

    setLoading(true);
    try {
      const data = await api.selectGym({
        selectorToken: pendingGymSelection.selectorToken,
        userId,
      });
      await applySession({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setLoading(true);
    try {
      const data = await api.loginWithGoogle({ idToken });
      await applySession({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } finally {
      setLoading(false);
    }
  };

  const loginWithApple = async (idToken: string) => {
    setLoading(true);
    try {
      const data = await api.loginWithApple({ idToken });
      await applySession({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } finally {
      setLoading(false);
    }
  };

  const completeTemporaryPasswordChange = async (newPassword: string) => {
    if (!token || !user) {
      throw new Error("Sesión no válida");
    }

    setLoading(true);
    try {
      await api.changeTemporaryPassword(token, { newPassword });
      setUser({
        ...user,
        mustChangePassword: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const registerAdmin = async (input: {
    gymName: string;
    ownerName: string;
    email: string;
    password: string;
    fullName: string;
    username: string;
  }) => {
    setLoading(true);
    try {
      // Wake up the server if it's sleeping (Render free tier cold start)
      await api.ping();

      await api.register({
        gym: {
          name: input.gymName,
          ownerName: input.ownerName,
        },
        user: {
          email: input.email,
          password: input.password,
          fullName: input.fullName,
          username: input.username,
          role: "admin",
        },
      });

      const data = await api.login({
        identifier: input.email,
        password: input.password,
      });
      if (data.requiresGymSelection) {
        throw new Error("No se pudo completar el alta inicial. Intenta iniciar sesión manualmente.");
      }

      if (!data.token || !data.user) {
        throw new Error("Respuesta de autenticacion invalida");
      }

      if (!data.refreshToken) {
        throw new Error("Respuesta de autenticacion invalida: falta refresh token");
      }

      await applySession({
        token: data.token,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    const tokenToCleanup = token;
    const pushTokenToCleanup = pushTokenRef.current;
    const refreshToRevoke = refreshToken;

    pushTokenRef.current = null;
    setPendingGymSelection(null);
    setToken(null);
    setRefreshToken(null);
    setUser(null);

    void (async () => {
      if (tokenToCleanup && pushTokenToCleanup) {
        await api.unregisterPushToken(tokenToCleanup, { token: pushTokenToCleanup }).catch(() => {});
      }
      await api.logout(refreshToRevoke ?? undefined).catch(() => {});
      await clearSessionStorage().catch(() => {});
    })();
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      pendingGymSelection,
      login,
      selectGym,
      loginWithGoogle,
      loginWithApple,
      completeTemporaryPasswordChange,
      registerAdmin,
      logout,
    }),
    [user, token, loading, pendingGymSelection],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
