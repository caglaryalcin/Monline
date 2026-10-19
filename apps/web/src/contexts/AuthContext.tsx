import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "@/lib/api";
import { authService } from "@/services/auth";
import type { User } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Cache the admin status so login() doesn't duplicate the request made by refreshUser()
  const isAdminRef = useRef<{ userId: string; value: boolean } | undefined>(undefined);
  const didBootstrapRef = useRef(false);
  const sessionOwner = useRef(authService.getModel()?.id ?? null);
  const refreshController = useRef<AbortController | null>(null);

  const fetchIsAdmin = useCallback(async (signal?: AbortSignal) => {
    const userId = authService.getModel()?.id;
    if (!userId) return false;
    const res = await api.get<{ isAdmin: boolean }>("/api/auth/is-admin", {
      cache: "no-store",
      signal,
    });
    if (authService.getModel()?.id !== userId) return false;
    isAdminRef.current = { userId, value: !!res.isAdmin };
    return !!res.isAdmin;
  }, []);

  const refreshUser = useCallback(async () => {
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    let owner = authService.getModel()?.id;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      if (!authService.isValid()) {
        // A new tab has no sessionStorage, but shares the HttpOnly session cookie.
        // Validate that cookie before adopting it; do not make temporary sessions persistent.
        const restored = await authService.restoreSession(controller.signal);
        if (!restored || controller.signal.aborted || authService.isValid()) return;
        owner = restored.record.id;
        sessionOwner.current = owner;
        isAdminRef.current = undefined;
        queryClient.clear();
        authService.saveSession(restored.token, restored.record, restored.remember === true);
      } else {
        await authService.refresh(controller.signal);
      }
      if (controller.signal.aborted || authService.getModel()?.id !== owner) return;
      const record = authService.getModel();
      if (record) {
        setUser(record);
        // Admin status is supplementary. A temporary failure must not destroy
        // an otherwise valid login session.
        const admin = await fetchIsAdmin(controller.signal).catch(() => false);
        if (!controller.signal.aborted && authService.getModel()?.id === owner) setIsAdmin(admin);
      }
    } catch (error) {
      if (refreshController.current !== controller || authService.getModel()?.id !== owner) return;
      const status = error && typeof error === "object" && "status" in error ? error.status : 0;
      if (status === 400 || status === 401 || status === 403 || !authService.isValid()) {
        authService.clear();
        setUser(null);
        isAdminRef.current = undefined;
      } else {
        setUser(authService.getModel());
      }
      setIsAdmin(false);
    } finally {
      clearTimeout(timeout);
      if (refreshController.current === controller) setIsLoading(false);
    }
  }, [fetchIsAdmin, queryClient]);

  useEffect(() => {
    // Listen to changes in the authStore (e.g. token expiration, manual clear)
    const unsubscribe = authService.onChange((token, model) => {
      const nextOwner = token && model ? (model as User).id : null;
      if (nextOwner !== sessionOwner.current) {
        sessionOwner.current = nextOwner;
        refreshController.current?.abort();
        isAdminRef.current = undefined;
        setIsAdmin(false);
        queryClient.clear();
      }
      if (!token || !model) {
        setUser(null);
        setIsAdmin(false);
      } else {
        setUser(model as User);
      }
    });

    if (!didBootstrapRef.current) {
      didBootstrapRef.current = true;
      void refreshUser();
    }

    return () => {
      unsubscribe();
    };
  }, [refreshUser, queryClient]);

  const login = useCallback(
    async (email: string, password: string, remember = false) => {
      const authData = await authService.loginWithPassword(email, password, remember);

      setUser(authData.record as unknown as User);

      // Re-use the admin status already fetched by refreshUser() when possible
      let nextIsAdmin =
        isAdminRef.current?.userId === authData.record.id ? isAdminRef.current.value : undefined;
      if (nextIsAdmin === undefined) {
        nextIsAdmin = await fetchIsAdmin().catch(() => false);
      }
      if (authService.getModel()?.id === authData.record.id) setIsAdmin(nextIsAdmin);
    },
    [fetchIsAdmin],
  );

  const logout = useCallback(() => {
    refreshController.current?.abort();
    void api.post("/api/auth/logout").catch(() => {});
    authService.clear();
    isAdminRef.current = undefined;
    setUser(null);
    setIsAdmin(false);
  }, []);

  const contextValue = useMemo(
    () => ({
      // These features are always enabled, including for cached older sessions.
      user: user
        ? {
            ...user,
            payment_tracking: true,
            convert_currency: true,
            subscription_progress: true,
            disabled_to_bottom: true,
            show_original_price: true,
            remove_background: false,
          }
        : null,
      isLoading,
      isAdmin,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, isAdmin, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
