import { createContext, useContext, useEffect, useState } from "react";
import * as api from "../api";

type User = api.User;

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then((r) => setUser(r.user))
      .finally(() => setLoading(false));
  }, []);

  async function login(login: string, password: string) {
    const r = await api.login(login, password);
    if (!r.ok) throw new Error(r.error ?? "login failed");
    setUser(r.user!);
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
