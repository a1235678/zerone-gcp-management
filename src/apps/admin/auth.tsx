import { createContext, useCallback, useContext, useState } from 'react';
import { APPROVER_ROLE, getSession, login as apiLogin, logout as apiLogout, type Session } from '@data/api';
import type { ResourceKey, WorkOrderStatus } from '@data/types';

interface Auth {
  session: Session | undefined;
  login: (email: string, password: string) => Promise<Session>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Auth>({
  session: undefined,
  login: () => Promise.reject(new Error('AuthProvider 未設定')),
  logout: () => Promise.resolve(),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | undefined>(() => getSession());
  const login = useCallback(async (email: string, password: string) => {
    const s = await apiLogin(email, password);
    setSession(s);
    return s;
  }, []);
  const logout = useCallback(async () => {
    await apiLogout();
    setSession(undefined);
  }, []);
  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/**
 * 目前登入者的權限。每次呼叫都讀最新的角色設定，所以在「角色管理」改了權限會馬上生效。
 * 這只是畫面上的顯示；正式版的權限檢查一定要在後端再做一次。
 */
export function usePermission() {
  useAuth();
  const can = (resource: ResourceKey, level: 'read' | 'write' = 'read') => {
    const p = getSession()?.permissions[resource] ?? 'none';
    return level === 'read' ? p !== 'none' : p === 'write';
  };
  const canApprove = (status: WorkOrderStatus) => {
    const r = APPROVER_ROLE[status];
    return Boolean(r && getSession()?.roleId === r.roleId);
  };
  return { can, canApprove };
}
