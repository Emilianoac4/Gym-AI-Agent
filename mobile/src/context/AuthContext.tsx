import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../services/api";
import { AuthUser, UserRole } from "../types/api";

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
  login: (email: string, password: string, requestedRole: UserRole) => Promise<void>;
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
  const pushTokenRef = useRef<string | null>(null);

  // Register device push token whenever the user authenticates
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const projectId = (Notifications as any).getExpoPushTokenAsync
          ? undefined
          : undefined; // resolved from Constants at runtime by the SDK
        const tokenData = await Notifications.getExpoPushTokenAsync();
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

  const login = async (email: string, password: string, requestedRole: UserRole) => {
    setLoading(true);
    try {
      const data = await api.login({ email, password, requestedRole });
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
      throw new Error("Sesion no valida");
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
        email: input.email,
        password: input.password,
        requestedRole: "admin",
      });
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
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      loginWithGoogle,
      loginWithApple,
      completeTemporaryPasswordChange,
      registerAdmin,
      logout,
    }),
    [user, token, loading],
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
