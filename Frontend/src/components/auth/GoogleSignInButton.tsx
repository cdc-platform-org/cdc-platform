import { useState, useEffect, useRef } from 'react';

interface GoogleSignInButtonProps {
  mode: 'login' | 'register';
  // Only used if this Google identity is creating a brand-new account —
  // ignored for an existing one (see Backend's POST /auth/google).
  role?: 'Student' | 'Client';
  lang: 'ka' | 'en';
  onCredential: (idToken: string) => void;
  // Shown as the visible label on the disabled placeholder when Google
  // Sign-In isn't configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID unset).
  disabledLabel: string;
  // Tooltip on that same placeholder — separate from disabledLabel so
  // callers can show "Continue with Google" as the label and a more
  // explanatory "not configured yet" string as the hover title, matching
  // AuthModal's existing wording split.
  disabledTitle?: string;
}

// Renders Google's own GSI button once its script (loaded globally in
// _app.tsx) is ready. Same init/render pattern as AuthModal's inline Google
// button, extracted here so the dedicated /auth/login and /auth/register
// pages can offer it too, not just the shared modal.
export default function GoogleSignInButton({ mode, role, lang, onCredential, disabledLabel, disabledTitle }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(
    () => typeof window !== 'undefined' && !!window.google?.accounts?.id
  );
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (googleReady) return;
    const handleReady = () => setGoogleReady(true);
    window.addEventListener('google-gsi-ready', handleReady);
    return () => window.removeEventListener('google-gsi-ready', handleReady);
  }, [googleReady]);

  useEffect(() => {
    if (!clientId || typeof window === 'undefined' || !window.google?.accounts?.id || !buttonRef.current) {
      return;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      locale: lang,
      callback: (response) => onCredential(response.credential),
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: mode === 'register' ? 'signup_with' : 'signin_with',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, mode, role, googleReady, lang]);

  if (!clientId) {
    return (
      <div
        title={disabledTitle ?? disabledLabel}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-400 cursor-not-allowed select-none"
      >
        {disabledLabel}
      </div>
    );
  }

  return <div ref={buttonRef} className="flex justify-center" />;
}
