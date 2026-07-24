import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/auth';
import { useAuthModal } from '../../context/AuthModalContext';
import PasswordInput from './PasswordInput';
import Toast from '../shared/Toast';

type Mode = 'login' | 'register';

// Self-contained bilingual strings, keyed off next/router's `locale` directly
// — deliberately NOT next-i18next's useTranslation('auth') here. This modal
// is mounted once globally (pages/_app.tsx) and can be triggered from any
// page; relying on a namespace loaded via that specific page's
// serverSideTranslations would silently break on any page that forgot to
// list 'auth'. router.locale needs no such per-page wiring.
const STRINGS = {
  ka: {
    loginTab: 'შესვლა',
    registerTab: 'რეგისტრაცია',
    nameLabel: 'სახელი',
    namePlaceholder: 'თქვენი სახელი',
    emailLabel: 'ელ-ფოსტა',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'პაროლი',
    passwordPlaceholder: '••••••••',
    loginButton: 'შესვლა',
    loginSubmitting: 'შედის…',
    registerButton: 'რეგისტრაცია',
    registerSubmitting: 'იქმნება…',
    googleButton: 'გააგრძელეთ Google-ით',
    googleNotConfigured: 'Google შესვლა ჯერ არ არის კონფიგურირებული',
    orDivider: 'ან',
    noAccount: 'არ გაქვთ ანგარიში?',
    hasAccount: 'უკვე გაქვთ ანგარიში?',
    switchToRegister: 'დარეგისტრირდით',
    switchToLogin: 'შედით',
    forgotPassword: 'დაგავიწყდა პაროლი?',
    roleLabel: 'რეგისტრირდები როგორც',
    roleStudent: '🎓 სტუდენტი',
    roleClient: '💼 დამკვეთი',
    registerSuccessTitle: 'თითქმის მზად ხართ!',
    registerSuccessBody:
      'თქვენი ანგარიში შეიქმნა. გთხოვთ დაადასტუროთ ელ-ფოსტა იმ ბმულით, რომელიც გამოგზავნილია — სანამ ამას გააკეთებთ, ზოგიერთი მოქმედება დაბლოკილი იქნება.',
    registerSuccessToast: 'რეგისტრაცია წარმატებით დასრულდა!',
    continueButton: 'გაგრძელება',
    genericError: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
    close: 'დახურვა',
    redirectingToAdmin: '✓ შესვლა წარმატებულია — გადამისამართება Admin სამუშაო სივრცეში…',
  },
  en: {
    loginTab: 'Login',
    registerTab: 'Register',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: '••••••••',
    loginButton: 'Log In',
    loginSubmitting: 'Logging in…',
    registerButton: 'Register',
    registerSubmitting: 'Creating account…',
    googleButton: 'Continue with Google',
    googleNotConfigured: 'Google Sign-In is not configured yet',
    orDivider: 'OR',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    switchToRegister: 'Register',
    switchToLogin: 'Log in',
    forgotPassword: 'Forgot password?',
    roleLabel: 'Registering as',
    roleStudent: '🎓 Student',
    roleClient: '💼 Client',
    registerSuccessTitle: 'Almost there!',
    registerSuccessBody:
      "Your account has been created. Please confirm your email using the link we just sent — some actions stay locked until you do.",
    registerSuccessToast: 'Registration successful!',
    continueButton: 'Continue',
    genericError: 'Something went wrong. Please try again.',
    close: 'Close',
    redirectingToAdmin: '✓ Signed in — redirecting to the Admin Workspace…',
  },
} as const;

export default function AuthModal() {
  const router = useRouter();
  const { login, register, loginWithGoogle } = useAuth();
  const { isOpen, contextMessage, initialMode, onSuccess, closeAuthModal } = useAuthModal();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = STRINGS[lang];

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Student' | 'Client'>('Student');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [showRegisterToast, setShowRegisterToast] = useState(false);
  const [redirectingAdmin, setRedirectingAdmin] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Runs once login (email/password or Google) succeeds. A pending onSuccess
  // (e.g. "resume checkout for the course I was trying to buy") always wins
  // over the default admin-workspace redirect — the user had a specific
  // intent, don't bounce them somewhere else.
  const handlePostLogin = (loggedInUser: User) => {
    if (onSuccess) {
      closeAuthModal();
      onSuccess(loggedInUser);
      return;
    }
    if (loggedInUser.adminRole) {
      setRedirectingAdmin(true);
      setTimeout(() => {
        closeAuthModal();
        router.push('/admin');
      }, 900);
      return;
    }
    closeAuthModal();
  };

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setRegistered(false);
      setShowRegisterToast(false);
      setRedirectingAdmin(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('Student');
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen || registered) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || typeof window === 'undefined' || !window.google?.accounts?.id || !googleButtonRef.current) {
      return;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        setSubmitting(true);
        setError(null);
        // role only matters if this Google identity is creating a brand-new
        // account — ignored for an existing one (see Backend's /google route).
        loginWithGoogle(response.credential, mode === 'register' ? role : undefined)
          .then((loggedInUser) => handlePostLogin(loggedInUser))
          .catch(() => setError(t.genericError))
          .finally(() => setSubmitting(false));
      },
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: mode === 'register' ? 'signup_with' : 'signin_with',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, registered, role]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const loggedInUser = await login({ email, password });
        handlePostLogin(loggedInUser);
      } else {
        await register({ name, email, password, role });
        setRegistered(true);
        setShowRegisterToast(true);
        setTimeout(() => setShowRegisterToast(false), 4000);
      }
    } catch (err: any) {
      const apiErrors = err?.response?.data?.errors;
      const apiMessage = err?.response?.data?.message;
      setError(
        Array.isArray(apiErrors) ? apiErrors.map((e: any) => e.message).join(' ') : apiMessage || t.genericError
      );
    } finally {
      setSubmitting(false);
    }
  };

  const googleClientConfigured = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Close button — explicit top-right position, high z-index, always
            above the sliding tab-indicator background below. */}
        <button
          type="button"
          onClick={closeAuthModal}
          aria-label={t.close}
          className="absolute top-4 right-4 z-50 p-2 cursor-pointer text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>

        {redirectingAdmin ? (
          <div className="text-center pt-2 pb-4">
            <div className="text-4xl mb-3">🛡️</div>
            <p className="text-sm font-semibold text-indigo-600">{t.redirectingToAdmin}</p>
          </div>
        ) : registered ? (
          <div className="text-center pt-2">
            <div className="text-4xl mb-3">📧</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t.registerSuccessTitle}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t.registerSuccessBody}</p>
            <button
              type="button"
              onClick={closeAuthModal}
              className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {t.continueButton}
            </button>
          </div>
        ) : (
          <>
            {/* Tab header — pr-12 keeps the tabs clear of the close button
                regardless of locale/label length. */}
            <div className="relative flex border-b border-gray-200 pr-12 mb-6">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`relative z-10 flex-1 pb-3 text-sm font-semibold transition-colors ${
                  mode === 'login' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t.loginTab}
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`relative z-10 flex-1 pb-3 text-sm font-semibold transition-colors ${
                  mode === 'register' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t.registerTab}
              </button>
              {/* Sliding highlight — z-0, purely decorative, sits behind both
                  the tab labels (z-10) and the close button (z-50) so it can
                  never intercept clicks meant for either. */}
              <div
                className="absolute bottom-0 left-0 z-0 h-0.5 w-1/2 bg-indigo-600 transition-transform duration-300 ease-in-out"
                style={{ transform: mode === 'register' ? 'translateX(100%)' : 'translateX(0%)' }}
              />
            </div>

            {contextMessage && (
              <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
                {lang === 'ka' ? contextMessage.ka : contextMessage.en}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.nameLabel}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.emailLabel}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">{t.passwordLabel}</label>
                  {mode === 'login' && (
                    <Link
                      href="/auth/forgot-password"
                      onClick={closeAuthModal}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {t.forgotPassword}
                    </Link>
                  )}
                </div>
                <PasswordInput
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  inputClassName="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.roleLabel}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('Student')}
                      aria-pressed={role === 'Student'}
                      className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                        role === 'Student'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t.roleStudent}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('Client')}
                      aria-pressed={role === 'Client'}
                      className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                        role === 'Client'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t.roleClient}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting
                  ? mode === 'login'
                    ? t.loginSubmitting
                    : t.registerSubmitting
                  : mode === 'login'
                  ? t.loginButton
                  : t.registerButton}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-medium text-gray-400">{t.orDivider}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div ref={googleButtonRef} className={googleClientConfigured ? '' : 'hidden'} />
              {!googleClientConfigured && (
                <div
                  title={t.googleNotConfigured}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-400 cursor-not-allowed select-none"
                >
                  {t.googleButton}
                </div>
              )}
            </div>

            <p className="text-center text-sm text-gray-500 mt-5">
              {mode === 'login' ? t.noAccount : t.hasAccount}{' '}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                {mode === 'login' ? t.switchToRegister : t.switchToLogin}
              </button>
            </p>
          </>
        )}
      </div>
      {showRegisterToast && <Toast message={t.registerSuccessToast} />}
    </div>
  );
}
