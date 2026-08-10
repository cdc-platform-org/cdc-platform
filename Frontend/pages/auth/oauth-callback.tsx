import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../src/context/AuthContext';

// Landing point for the GitHub/Facebook redirect-based OAuth flow —
// routes/auth.ts's /github/callback and /facebook/callback redirect the
// browser here with ?token=<jwt> once sign-in succeeds server-side (unlike
// Google's client-side flow, which never leaves the login page). This page
// just finishes the same localStorage/cookie session setup login() does,
// then hands off to the dashboard.
export default function OAuthCallbackPage() {
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const ranOnce = useRef(false);

  useEffect(() => {
    if (!router.isReady || ranOnce.current) return;
    ranOnce.current = true;

    const token = typeof router.query.token === 'string' ? router.query.token : null;
    if (!token) {
      router.replace('/auth/login?error=oauth');
      return;
    }

    loginWithToken(token)
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/auth/login?error=oauth'));
  }, [router.isReady, router.query.token, loginWithToken, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0b0f19]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Signing you in…</p>
      </div>
    </div>
  );
}
