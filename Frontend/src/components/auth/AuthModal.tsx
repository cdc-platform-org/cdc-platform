import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { GraduationCap, Building2, X, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/auth';
import { useAuthModal } from '../../context/AuthModalContext';
import PasswordInput from './PasswordInput';
import GoogleSignInButton from './GoogleSignInButton';
import SocialLoginButtons from './SocialLoginButtons';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { forgotPassword } from '../../services/authService';

type Mode = 'login' | 'register' | 'forgot';

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
    nameLabelBusiness: 'კომპანიის დასახელება',
    namePlaceholderBusiness: 'კომპანიის / ორგანიზაციის დასახელება',
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
    forgotTitle: 'პაროლის აღდგენა',
    forgotSubtitle: 'შეიყვანეთ თქვენი ანგარიშის ელ-ფოსტა და გამოგიგზავნით აღდგენის ბმულს.',
    sendResetLink: 'ბმულის გაგზავნა',
    sendingResetLink: 'იგზავნება…',
    resetLinkSent: 'თუ ეს ელ-ფოსტა რეგისტრირებულია, აღდგენის ბმული გამოგზავნილია. შეამოწმეთ თქვენი ინბოქსი.',
    backToLogin: '← შესვლაში დაბრუნება',
    roleLabel: 'რეგისტრირდები როგორც',
    roleStudent: 'სტუდენტი / ფრილანსერი',
    roleClient: 'ბიზნესი',
    termsPrefix: 'ვეთანხმები',
    termsLink: 'წესებსა და პირობებს',
    genericError: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
    close: 'დახურვა',
    redirectingToAdmin: '✓ შესვლა წარმატებულია — გადამისამართება Admin სამუშაო სივრცეში…',
  },
  en: {
    loginTab: 'Login',
    registerTab: 'Register',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    nameLabelBusiness: 'Company Name',
    namePlaceholderBusiness: 'Company / Organization Name',
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
    forgotTitle: 'Reset Password',
    forgotSubtitle: "Enter your account's email and we'll send you a reset link.",
    sendResetLink: 'Send Reset Link',
    sendingResetLink: 'Sending…',
    resetLinkSent: "If that email is registered, a reset link has been sent. Check your inbox.",
    backToLogin: '← Back to login',
    roleLabel: 'Registering as',
    roleStudent: 'Student / Freelancer',
    roleClient: 'Business',
    termsPrefix: 'I agree to the',
    termsLink: 'Terms & Conditions',
    genericError: 'Something went wrong. Please try again.',
    close: 'Close',
    redirectingToAdmin: '✓ Signed in — redirecting to the Admin Workspace…',
  },
} as const;

export default function AuthModal() {
  const router = useRouter();
  const { login, register, loginWithGoogle } = useAuth();
  const { isOpen, contextMessage, initialMode, initialRole, onSuccess, closeAuthModal } = useAuthModal();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = STRINGS[lang];

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Student' | 'Client'>('Student');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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

  // Runs once login/registration (email/password or Google) succeeds. A
  // pending onSuccess (e.g. "resume checkout for the course I was trying to
  // buy") always wins over the default redirect — the user had a specific
  // intent, don't bounce them somewhere else. Otherwise an explicit
  // ?redirect= (set by ProtectedRoute when it bounced a guest into the
  // modal) wins next, same precedence as pages/auth/login.tsx; admin-team
  // members land in the Admin Workspace, everyone else in the dashboard.
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
    if (isOpen) {
      if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
      setMode(initialMode);
      setError(null);
      setRedirectingAdmin(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole(initialRole);
      setForgotEmail('');
      setForgotSubmitting(false);
      setForgotSent(false);
      setForgotError(null);
    }
  }, [isOpen, initialMode, initialRole]);

  if (!isOpen) return null;

  const handleGoogleCredential = (idToken: string) => {
    setSubmitting(true);
    setError(null);
    // role only matters if this Google identity is creating a brand-new
    // account — ignored for an existing one (see Backend's /google route).
    loginWithGoogle(idToken, mode === 'register' ? role : undefined)
      .then((loggedInUser) => handlePostLogin(loggedInUser))
      .catch((err: any) => setError(err?.response?.data?.message || t.genericError))
      .finally(() => setSubmitting(false));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const loggedInUser = await login({ email, password });
        handlePostLogin(loggedInUser);
      } else {
        const newUser = await register({ name, email, password, role, acceptedTerms });
        handlePostLogin(newUser);
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

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSubmitting(true);
    try {
      await forgotPassword({ email: forgotEmail, lang });
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err?.response?.data?.message ?? t.genericError);
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
          aria-label={t.close}
          className="absolute top-4 right-4 z-50 p-2 cursor-pointer text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {redirectingAdmin ? (
          <div className="text-center pt-2 pb-4">
            <ShieldCheck className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-indigo-600">{t.redirectingToAdmin}</p>
          </div>
        ) : mode === 'forgot' ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setMode('login')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-transparent border-none p-0 cursor-pointer mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t.backToLogin}
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-1.5">{t.forgotTitle}</h2>
            <p className="text-sm text-gray-500 mb-5">{t.forgotSubtitle}</p>

            {forgotSent ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 text-center">
                ✅ {t.resetLinkSent}
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                {forgotError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{forgotError}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.emailLabel}</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {forgotSubmitting ? t.sendingResetLink : t.sendResetLink}
                </button>
              </form>
            )}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {role === 'Client' ? t.nameLabelBusiness : t.nameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'Client' ? t.namePlaceholderBusiness : t.namePlaceholder}
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
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-transparent border-none p-0 cursor-pointer"
                    >
                      {t.forgotPassword}
                    </button>
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
                      className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                        role === 'Student'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      {t.roleStudent}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('Client')}
                      aria-pressed={role === 'Client'}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                        role === 'Client'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      {t.roleClient}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <label className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                  <span>
                    {t.termsPrefix}{' '}
                    <Link href="/terms" target="_blank" className="font-medium text-indigo-600 hover:text-indigo-500">
                      {t.termsLink}
                    </Link>
                  </span>
                </label>
              )}

              <button
                type="submit"
                disabled={submitting || (mode === 'register' && !acceptedTerms)}
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

            <div className="space-y-2.5">
              <GoogleSignInButton
                mode={mode === 'register' ? 'register' : 'login'}
                role={mode === 'register' ? role : undefined}
                lang={lang}
                onCredential={handleGoogleCredential}
                disabledLabel={t.googleButton}
                disabledTitle={t.googleNotConfigured}
              />
              <SocialLoginButtons lang={lang} role={mode === 'register' ? role : undefined} />
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
    </div>
  );
}
