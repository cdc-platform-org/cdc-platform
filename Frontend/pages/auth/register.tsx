import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { AxiosError } from 'axios';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import GuestRoute from '../../src/components/auth/GuestRoute';
import PasswordInput from '../../src/components/auth/PasswordInput';
import GoogleSignInButton from '../../src/components/auth/GoogleSignInButton';
import SocialLoginButtons from '../../src/components/auth/SocialLoginButtons';
import LanguageSwitcher from '../../src/components/layout/LanguageSwitcher';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetStaticProps } from 'next';
import { resolveLocale } from '../../src/utils/locale';

// AUDIT NOTE (removed): this page used to gate the actual form behind a
// 2-step wizard (Step 1: "Learning & Career" vs "Hiring & B2B"; Step 2, TALENT
// only: Student vs Freelancer, both of which saved the identical role
// 'Student' — pure UI friction with zero backend effect) plus an inline
// freelancerSkills picker. Removed per an explicit request to cut
// registration friction: every organic visitor now goes straight to one
// unified Name/Email/Password/Phone form and gets role: 'Student' (the
// schema's own default — see Backend's authSchemas.ts). Freelance skills
// are still fully editable after signup on /dashboard/settings, so nothing
// is actually lost, just no longer front-loaded onto the signup form.
//
// 'Client' (Employer/Business) is still reachable — just no longer a
// general public choice on this page. It stays available ONLY via the one
// real internal integration that already depended on it before this
// change: tools.tsx's Business AI Tools trial CTA deep-links here with
// ?intent=EMPLOYER (via AuthModal.tsx's goToRegister), which still silently
// selects role: 'Client' below with no wizard UI shown for it — removing
// that support entirely would have broken that specific, already-shipped
// flow, which nothing in this request asked for.
function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuth();
  const { t } = useTranslation('auth');
  const lang = resolveLocale(router.locale);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  // Defaults to Student for every organic visit; flipped to Client only
  // when ?intent=EMPLOYER is already present in the URL on load (see the
  // effect below) — never by an in-page choice anymore.
  const [role, setRole] = useState<'Student' | 'Client'>('Student');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  // The one surviving use of ?intent=EMPLOYER — see this file's own header
  // comment. Silent: no Step 1/2 UI renders for it, `role` just starts as
  // 'Client' instead of the default 'Student'.
  useEffect(() => {
    if (router.query.intent === 'EMPLOYER') setRole('Client');
  }, [router.query.intent]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  const postSignupRedirect = (status: string) => {
    // A pending-approval account can't actually use whatever page it was
    // trying to reach yet — this hard gate always wins over ?redirect=.
    if (status === 'PENDING_APPROVAL') return '/auth/pending-approval';
    // An explicit ?redirect= (set by AuthModal.tsx's goToRegister when a
    // guest chose "Register" instead of logging in, e.g. from /career-test)
    // always wins next — the visitor had a specific destination in mind.
    // Previously dropped entirely: registering never returned anyone to
    // where they came from, unlike the equivalent login flow.
    const explicitRedirect = typeof router.query.redirect === 'string' ? router.query.redirect : undefined;
    if (explicitRedirect) return explicitRedirect;
    // Every Employer signup (role: Client — reachable only via the
    // ?intent=EMPLOYER deep-link now, see this file's header comment) gets
    // the company-KYC prompt.
    if (role === 'Client') return '/onboarding';
    return '/courses';
  };

  const handleGoogleCredential = async (idToken: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await loginWithGoogle(idToken, role);
      router.push(postSignupRedirect(loggedInUser.status));
    } catch (err) {
      // Surface the backend's actual message (e.g. "not configured" vs
      // "invalid/expired credential") instead of always showing the same
      // generic string — same pattern as handleSubmit below. Falls back to
      // the generic string only when there's truly no response body (a
      // network/CORS failure never reached the backend at all).
      // Also logged: a CORS rejection and a real backend rejection both
      // produce the same fallback UI message, so the console is the only
      // place to tell them apart.
      console.error('[GoogleSignIn] Token validation request failed:', err);
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(axiosErr.response?.data?.message || t('googleSignInError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const newUser = await register({
        name,
        email,
        password,
        phone: phone.trim() || undefined,
        role,
        acceptedTerms,
        primaryIntent: role === 'Client' ? 'EMPLOYER' : 'TALENT',
      });
      // Self-serve Student/Client signups are auto-approved (see backend's
      // POST /register) — pending-approval is now only reachable for a
      // future role that still needs manual vetting.
      router.push(postSignupRedirect(newUser.status));
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; errors?: Array<{ message: string }> }>;
      const zodErrors = axiosErr.response?.data?.errors;

      if (Array.isArray(zodErrors) && zodErrors.length > 0) {
        setError(zodErrors.map((issue) => issue.message).join(' '));
      } else {
        setError(axiosErr.response?.data?.message || t('register.genericError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0b0f19] px-4">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-none border border-slate-200/80 dark:border-white/10 p-8 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" aria-label="CDC Home" className="inline-flex no-underline">
            <Image src="/images/cdc-logo.png" alt="CDC" width={28} height={28} className="h-7 w-auto rounded-lg object-cover" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <LanguageSwitcher/>
          </div>
        </div>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('register.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('register.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t('register.nameLabel')}
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('register.namePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t('register.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('register.emailPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t('register.passwordLabel')}
            </label>
            <PasswordInput
              id="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              inputClassName="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('register.passwordPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t('register.phoneLabel')}
            </label>
            <input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('register.phonePlaceholder')}
            />
          </div>

          <label className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 shrink-0"
            />
            <span>
              {t('register.termsPrefix')}{' '}
              <Link href="/terms" target="_blank" className="font-medium text-indigo-600 hover:text-indigo-500">
                {t('register.termsLink')}
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !acceptedTerms}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('register.submittingButton') : t('register.submitButton')}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
          <span className="text-xs font-medium text-gray-400 dark:text-slate-500">{t('orDivider')}</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        </div>

        <div className="space-y-2.5">
          <GoogleSignInButton
            mode="register"
            role={role}
            lang={lang}
            onCredential={handleGoogleCredential}
            disabledLabel={t('googleButton')}
            disabledTitle={t('googleNotConfigured')}
          />
          <SocialLoginButtons lang={lang} role={role} />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
          {t('register.hasAccount')}{' '}
          <Link href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            {t('register.loginLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPageWrapper() {
  return (
    <GuestRoute>
      <RegisterPage />
    </GuestRoute>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale || 'ka', ['auth'])),
    },
  };
};