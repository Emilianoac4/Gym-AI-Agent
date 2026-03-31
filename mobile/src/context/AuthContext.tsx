import React, { createContext, useContext, useMemo, useState } from "react";
import { api } from "../services/api";
import { AuthUser } from "../types/api";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.login({ email, password });
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

      const data = await api.login({ email: input.email, password: input.password });
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
    () => ({ user, token, loading, login, registerAdmin, logout }),
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
