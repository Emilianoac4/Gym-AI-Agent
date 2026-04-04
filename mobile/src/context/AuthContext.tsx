import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "../services/api";
import { AuthUser, GymSelectionOption, UserRole } from "../types/api";

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
  login: (identifier: string, password: string, requestedRole: UserRole) => Promise<void>;
  selectGym: (userId: string) => Promise<void>;
  loginWithGoogle: (idToken: string, requestedRole: UserRole) => Promise<void>;
  loginWithApple: (idToken: string, requestedRole: UserRole) => Promise<void>;
  completeTemporaryPasswordChange: (newPassword: string) => Promise<void>;
  registerAdmin: (input: {
    gymName: string;
    ownerName: string;
    email: string;
    password: string;
    fullName: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingGymSelection, setPendingGymSelection] = useState<{
    selectorToken: string;
    gyms: GymSelectionOption[];
  } | null>(null);
  const pushTokenRef = useRef<string | null>(null);

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

  const login = async (identifier: string, password: string, requestedRole: UserRole) => {
    setLoading(true);
    try {
      const data = await api.login({ identifier, password, requestedRole });
      if (data.requiresGymSelection && data.selectorToken && data.gyms) {
        setPendingGymSelection({ selectorToken: data.selectorToken, gyms: data.gyms });
        setToken(null);
        setUser(null);
        return;
      }

      if (!data.token || !data.user) {
        throw new Error("Respuesta de autenticacion invalida");
      }

      setPendingGymSelection(null);
      setToken(data.token);
      setUser(data.user);
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
      setPendingGymSelection(null);
      setToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string, requestedRole: UserRole) => {
    setLoading(true);
    try {
      const data = await api.loginWithGoogle({ idToken, requestedRole });
      setToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const loginWithApple = async (idToken: string, requestedRole: UserRole) => {
    setLoading(true);
    try {
      const data = await api.loginWithApple({ idToken, requestedRole });
      setToken(data.token);
      setUser(data.user);
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
          role: "admin",
        },
      });

      const data = await api.login({
        identifier: input.email,
        password: input.password,
        requestedRole: "admin",
      });
      if (data.requiresGymSelection) {
        throw new Error("No se pudo completar el alta inicial. Intenta iniciar sesión manualmente.");
      }

      if (!data.token || !data.user) {
        throw new Error("Respuesta de autenticacion invalida");
      }

      setToken(data.token);
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Best-effort cleanup of push token
    if (token && pushTokenRef.current) {
      api.unregisterPushToken(token, { token: pushTokenRef.current }).catch(() => {});
      pushTokenRef.current = null;
    }
    setPendingGymSelection(null);
    setToken(null);
    setUser(null);
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
