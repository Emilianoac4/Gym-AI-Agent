import React, { createContext, useContext, useMemo, useState } from "react";
import { api } from "../services/api";
import { AuthUser, UserRole } from "../types/api";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, requestedRole: UserRole) => Promise<void>;
  loginWithGoogle: (idToken: string, requestedRole: UserRole) => Promise<void>;
  loginWithApple: (idToken: string, requestedRole: UserRole) => Promise<void>;
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

  const registerAdmin = async (input: {
    gymName: string;
    ownerName: string;
    email: string;
    password: string;
    fullName: string;
  }) => {
    setLoading(true);
    try {
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
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, login, loginWithGoogle, loginWithApple, registerAdmin, logout }),
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
