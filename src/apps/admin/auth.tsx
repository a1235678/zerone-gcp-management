import { createContext, useCallback, useContext, useState } from 'react';
import { getSession, login as apiLogin, logout as apiLogout, type Session } from '@data/api';

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
