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

  // Reads the cached session and silently revalidates it against the
  // server — factored out of the mount effect so it can also run on a
  // bfcache restore (see the pageshow listener below), not just first load.
  const hydrateFromStorage = useCallback(() => {
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
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    hydrateFromStorage();
    setLoading(false);

    // Chrome/Safari (desktop and mobile) restore a page from the
    // back-forward cache on Back/Forward navigation without re-running any
    // JS — this component's state is a frozen snapshot from whenever the
    // user navigated away, so a session that expired/changed in the
    // meantime (or a login/logout that happened in another tab) would
    // otherwise render as stale until the next full reload. `pageshow`'s
    // `persisted` flag is the one reliable signal a bfcache restore
    // actually happened (a normal first load never sets it), so this
    // re-runs the exact same revalidation the mount effect does instead of
    // trusting the frozen snapshot.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) hydrateFromStorage();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [hydrateFromStorage]);

  // `remember` only affects the mirrored `token` cookie's lifetime (7 days
  // vs a browser-session cookie) — the primary auth mechanism (the
  // TOKEN_KEY localStorage entry apiClient's interceptor reads on every
  // request) stays persistent either way, since threading a "don't persist"
  // mode through apiClient's Authorization header logic touches far more
  // than this one form. An honest partial implementation, not a full
  // session-vs-persistent auth model.
  const login = useCallback(async (payload: LoginPayload, remember: boolean = true) => {
    const { user: loggedInUser, token } = await loginRequest(payload);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
    setCookie(TOKEN_COOKIE, token, remember ? 7 : undefined);
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

  // GitHub/Facebook's redirect-based OAuth flow ends with the backend
  // redirecting to /auth/oauth-callback?token=<jwt> — that page calls this
  // to finish the same localStorage+cookie+state setup as login()/register()
  // above, just starting from a bare token instead of a {user,token} bundle
  // (the backend redirect can't hand back the parsed user object too).
  const loginWithToken = useCallback(async (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setCookie(TOKEN_COOKIE, token, 7);
    const freshUser = await getMeRequest();
    localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
    setUser(freshUser);
    return freshUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    removeCookie(TOKEN_COOKIE);
    setUser(null);
  }, []);

  // Writes a known-fresh user straight into context + localStorage — no
  // network round-trip. `updateProfile()`'s PUT /auth/me response already
  // *is* the fresh user, so callers (settings.tsx, client.tsx, onboarding.tsx)
  // pass that response here directly instead of following up with a second
  // GET just to get the same data back; this is what makes the header
  // name/avatar update the instant a save succeeds rather than after a
  // second request resolves.
  const syncUser = useCallback((freshUser: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
    setUser(freshUser);
  }, []);

  // Re-fetches the cached user from the server — for call sites that don't
  // already have a fresh User object in hand (e.g. after a webhook-driven
  // change, or just to revalidate).
  const refreshUser = useCallback(async () => {
    const freshUser = await getMeRequest();
    syncUser(freshUser);
    return freshUser;
  }, [syncUser]);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    loginWithGoogle,
    loginWithToken,
    logout,
    refreshUser,
    setUser: syncUser,
  };
}
