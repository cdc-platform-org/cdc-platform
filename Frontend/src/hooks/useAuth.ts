import { useState, useEffect, useCallback } from 'react';
import {
  login as loginRequest,
  register as registerRequest,
  loginWithGoogle as loginWithGoogleRequest,
  getMe as getMeRequest,
} from '../services/authService';
import { User, LoginPayload, RegisterPayload } from '../types/auth';
import { setCookie, removeCookie } from '../utils/cookies';

const TOKEN_KEY = 'cdc_access_token';
const USER_KEY = 'cdc_user';
// Mirrors the same token into a 'token' cookie (localStorage stays the
// source of truth for apiClient's Authorization header) so it's also
// readable by future server-side/middleware code.
const TOKEN_COOKIE = 'token';

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
      // The cached user can go stale (e.g. role/adminRole/status changed
      // server-side since last login) — silently revalidate against the
      // server so permission checks (like AdminGuard) never act on outdated
      // data without requiring a manual re-login. `silent401: true` keeps a
      // rejected/expired token from triggering apiClient's hard
      // window.location redirect — that behavior is for a genuinely
      // in-session action failing auth, not a background check on every
      // single page load; here we just clear the stale local session instead.
      getMeRequest({ silent401: true })
        .then((freshUser) => {
          localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          setUser(freshUser);
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          removeCookie(TOKEN_COOKIE);
          setUser(null);
        });
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { user: loggedInUser, token } = await loginRequest(payload);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
    setCookie(TOKEN_COOKIE, token, 7);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { user: newUser, token } = await registerRequest(payload);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setCookie(TOKEN_COOKIE, token, 7);
    setUser(newUser);
    return newUser;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string, role?: 'Student' | 'Client') => {
    const { user: loggedInUser, token } = await loginWithGoogleRequest(idToken, role);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
    setCookie(TOKEN_COOKIE, token, 7);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    removeCookie(TOKEN_COOKIE);
    setUser(null);
  }, []);

  // Re-syncs the cached user from the server — call after profile/settings
  // updates so every consumer (certificate name, payout IBAN prefill,
  // header greeting) reflects the change without a full reload.
  const refreshUser = useCallback(async () => {
    const freshUser = await getMeRequest();
    localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
    setUser(freshUser);
    return freshUser;
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    refreshUser,
  };
}
