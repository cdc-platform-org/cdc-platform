import { createContext, useContext, ReactNode } from 'react';
import { useAuthState } from '../hooks/useAuth';
import { User, LoginPayload, RegisterPayload } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload, remember?: boolean) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  loginWithGoogle: (idToken: string, role?: 'Student' | 'Client') => Promise<User>;
  loginWithToken: (token: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User>;
  // Writes an already-known-fresh User (e.g. updateProfile()'s own response)
  // straight into context — see the comment on syncUser in useAuth.ts.
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
