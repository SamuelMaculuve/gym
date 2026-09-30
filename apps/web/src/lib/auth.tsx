import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { hasPermission, type AuthUser, type GymPublic, type LoginInput, type Permission } from '@gymflow/shared';
import { api, onUnauthorized, tokenStorage } from './api';
import { qk } from './query-keys';

interface AuthContextValue {
  user: AuthUser | null;
  gym: GymPublic | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const hasToken = Boolean(tokenStorage.get());

  const me = useQuery({
    queryKey: qk.me,
    queryFn: api.auth.me,
    enabled: hasToken,
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    onUnauthorized(() => {
      queryClient.setQueryData(qk.me, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    });
  }, [queryClient]);

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await api.auth.login(input);
      await tokenStorage.set(session.token);
      await queryClient.fetchQuery({ queryKey: qk.me, queryFn: api.auth.me });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* sessão já inválida */
    }
    await tokenStorage.set(null);
    // Primeiro marca o utilizador como nulo (os ecrãs ligados a "me" são avisados e vão para o
    // login); só depois limpa o resto. Um clear() antes desligaria esses ecrãs da consulta.
    queryClient.setQueryData(qk.me, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
  }, [queryClient]);

  const user = me.data?.user ?? null;
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      gym: me.data?.gym ?? null,
      loading: hasToken && me.isLoading,
      login,
      logout,
      can: (p) => hasPermission(user?.role, p),
    }),
    [user, me.data?.gym, hasToken, me.isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
