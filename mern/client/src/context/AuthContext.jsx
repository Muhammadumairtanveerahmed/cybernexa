import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/auth.api.js";

const AuthContext = createContext(null);

function extractUser(response) {
  return response?.data?.data ?? response?.data?.user ?? null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    authApi
      .me()
      .then((response) => {
        if (active) setUser(extractUser(response));
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login: async (payload) => {
        const response = await authApi.login(payload);
        setUser(extractUser(response));
        return response;
      },
      refresh: async () => {
        const response = await authApi.me();
        const next = extractUser(response);
        setUser(next);
        return next;
      },
      logout: async () => {
        await authApi.logout();
        setUser(null);
      }
    }),
    [user, loading]
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
