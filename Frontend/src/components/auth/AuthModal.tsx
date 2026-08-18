import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { X, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/auth';
import { useAuthModal } from '../../context/AuthModalContext';
import PasswordInput from './PasswordInput';
import GoogleSignInButton from './GoogleSignInButton';
import SocialLoginButtons from './SocialLoginButtons';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { forgotPassword } from '../../services/authService';
import { resolveLocale } from '../../utils/locale';
import kaAuth from '../../../public/locales/ka/auth.json';
import enAuth from '../../../public/locales/en/auth.json';
import deAuth from '../../../public/locales/de/auth.json';
import esAuth from '../../../public/locales/es/auth.json';
import frAuth from '../../../public/locales/fr/auth.json';
import ukAuth from '../../../public/locales/uk/auth.json';

type Mode = 'login' | 'forgot';

// Directly imports the 'auth' namespace JSON for all 6 locales rather than
// next-i18next's useTranslation('auth') — this modal is mounted once
// globally (pages/_app.tsx) and can be triggered from any page, so it can't
// assume every page declares 'auth' in its own serverSideTranslations.
// Direct JSON import needs no per-page wiring and can't silently break.
//
// Registration itself doesn't live here — see the redirect-to-/auth/register
// logic below. That page is a full two-step wizard (intent -> sub-role) with
// dark-mode support and next-i18next translations; duplicating that inline
// in a global, i18next-free modal wasn't worth maintaining twice.
const STRINGS = { ka: kaAuth, en: enAuth, de: deAuth, es: esAuth, fr: frAuth, uk: ukAuth };

export default function AuthModal() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const { isOpen, contextMessage, initialMode, initialRole, onSuccess, closeAuthModal } = useAuthModal();
  const lang = resolveLocale(router.locale);
  const t = STRINGS[lang];

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectingAdmin, setRedirectingAdmin] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  // AuthModal is mounted once globally (pages/_app.tsx) and never unmounts,
  // but this timer can still race itself if the modal is closed and reopened
  // before it fires — tracking it lets a new open cancel any stale pending
  // timer instead of it firing later and clobbering fresh state.
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    };
  }, []);

  useEscapeToClose(isOpen, closeAuthModal);

  // Sends the user to the full registration wizard instead of rendering a
  // second, simplified register form inline — see the STRINGS comment above
  // for why. ?intent=EMPLOYER carries the modal's initialRole through so a
  // business-only CTA (e.g. the Enterprise AI Tools trial, which opens this
  // modal with initialRole: 'Client') still lands past Step 1 instead of
  // making the user re-pick "Hiring & B2B" themselves.
  const goToRegister = (role: 'Student' | 'Client' = 'Student') => {
    closeAuthModal();
    router.push(role === 'Client' ? '/auth/register?intent=EMPLOYER' : '/auth/register');
  };

  // Runs once login (email/password or Google) succeeds. A pending onSuccess
  // (e.g. "resume checkout for the course I was trying to buy") always wins
  // over the default redirect — the user had a specific intent, don't bounce
  // them somewhere else. Otherwise an explicit ?redirect= (set by
  // ProtectedRoute when it bounced a guest into the modal) wins next, same
  // precedence as pages/auth/login.tsx; admin-team members land in the Admin
  // Workspace, everyone else in the dashboard.
  const handlePostLogin = (loggedInUser: User) => {
    if (onSuccess) {
      closeAuthModal();
      onSuccess(loggedInUser);
      return;
    }
    const explicitRedirect = typeof router.query.redirect === 'string' ? router.query.redirect : undefined;
    if (loggedInUser.adminRole && !explicitRedirect) {
      setRedirectingAdmin(true);
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = setTimeout(() => {
        closeAuthModal();
        router.push('/admin');
      }, 900);
      return;
    }
    closeAuthModal();
    router.push(explicitRedirect || '/dashboard');
  };

  useEffect(() => {
    if (!isOpen) return;
    // Opened directly into register mode (e.g. a business-only CTA) — never
    // rendered here, just forwarded straight to the real registration page.
    if (initialMode === 'register') {
      goToRegister(initialRole);
      return;
    }
    if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
    setMode('login');
    setError(null);
    setRedirectingAdmin(false);
    setEmail('');
    setPassword('');
    setForgotEmail('');
    setForgotSubmitting(false);
    setForgotSent(false);
    setForgotError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode, initialRole]);

  if (!isOpen) return null;

  const handleGoogleCredential = (idToken: string) => {
    setSubmitting(true);
    setError(null);
    loginWithGoogle(idToken)
      .then((loggedInUser) => handlePostLogin(loggedInUser))
      .catch((err: any) => setError(err?.response?.data?.message || t.login.genericError))
      .finally(() => setSubmitting(false));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login({ email, password });
      handlePostLogin(loggedInUser);
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors;
      const apiMessage = err?.response?.data?.message;
      setError(
        Array.isArray(apiErrors) ? apiErrors.map((e: any) => e.message).join(' ') : apiMessage || t.login.genericError
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSubmitting(true);
    try {
      // The reset-email template is still ka/en-only server-side (see
      // Backend/src/schemas/authSchemas.ts) — de/es/fr/uk visitors get the
      // English-language email, same fallback boundary as the rest of this
      // i18n pass for backend/CMS content that hasn't been extended yet.
      await forgotPassword({ email: forgotEmail, lang: lang === 'ka' ? 'ka' : 'en' });
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err?.response?.data?.message ?? t.login.genericError);
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Close button — explicit top-right position, high z-index, always
            above the sliding tab-indicator background below. */}
        <button
          type="button"
          onClick={closeAuthModal}
          aria-label={t.modalClose}
          className="absolute top-4 right-4 z-50 p-2 cursor-pointer text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {redirectingAdmin ? (
          <div className="text-center pt-2 pb-4">
            <ShieldCheck className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-indigo-600">{t.modalRedirectingToAdmin}</p>
          </div>
        ) : mode === 'forgot' ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setMode('login')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-transparent border-none p-0 cursor-pointer mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t.forgotPassword.backToLogin}
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-1.5">{t.forgotPassword.title}</h2>
            <p className="text-sm text-gray-500 mb-5">{t.forgotPassword.subtitle}</p>

            {forgotSent ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 text-center">
                ✅ {t.forgotPassword.successMessage}
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                {forgotError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{forgotError}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.login.emailLabel}</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder={t.login.emailPlaceholder}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {forgotSubmitting ? t.forgotPassword.submittingButton : t.forgotPassword.submitButton}
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Tab header — pr-12 keeps the tabs clear of the close button
                regardless of locale/label length. Register always navigates
                away (see goToRegister) rather than switching an in-place
                mode, so it's never the "active" tab. */}
            <div className="relative flex border-b border-gray-200 pr-12 mb-6">
              <button
                type="button"
                className="relative z-10 flex-1 pb-3 text-sm font-semibold text-indigo-600"
              >
                {t.modalLoginTab}
              </button>
              <button
                type="button"
                onClick={() => goToRegister()}
                className="relative z-10 flex-1 pb-3 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
              >
                {t.modalRegisterTab}
              </button>
              <div className="absolute bottom-0 left-0 z-0 h-0.5 w-1/2 bg-indigo-600" />
            </div>

            {contextMessage && (
              <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
                {typeof contextMessage === 'string' ? contextMessage : lang === 'ka' ? contextMessage.ka : contextMessage.en}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.login.emailLabel}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.login.emailPlaceholder}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">{t.login.passwordLabel}</label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-transparent border-none p-0 cursor-pointer"
                  >
                    {t.login.forgotPassword}
                  </button>
                </div>
                <PasswordInput
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.login.passwordPlaceholder}
                  inputClassName="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? t.login.submittingButton : t.login.submitButton}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-medium text-gray-400">{t.orDivider}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="space-y-2.5">
              <GoogleSignInButton
                mode="login"
                lang={lang}
                onCredential={handleGoogleCredential}
                disabledLabel={t.googleButton}
                disabledTitle={t.googleNotConfigured}
              />
              <SocialLoginButtons lang={lang} />
            </div>

            <p className="text-center text-sm text-gray-500 mt-5">
              {t.login.noAccount}{' '}
              <button
                type="button"
                onClick={() => goToRegister()}
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                {t.login.registerLink}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
