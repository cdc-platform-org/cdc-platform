import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { AxiosError } from 'axios';
import { ShieldCheck, Sun, Moon } from 'lucide-react';
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

function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const { t } = useTranslation('auth');
  const lang = resolveLocale(router.locale);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectingAdmin, setRedirectingAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  const handlePostLogin = (loggedInUser: Awaited<ReturnType<typeof login>>) => {
    const explicitRedirect = router.query.redirect as string | undefined;
    if (explicitRedirect) {
      router.push(explicitRedirect);
    } else if (loggedInUser.adminRole) {
      setRedirectingAdmin(true);
      setTimeout(() => router.push('/admin'), 900);
    } else {
      router.push('/courses');
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await loginWithGoogle(idToken);
      handlePostLogin(loggedInUser);
    } catch {
      setError(t('googleSignInError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    let redirectingToAdmin = false;

    try {
      const loggedInUser = await login({ email, password }, rememberMe);
      // An explicit ?redirect= (set by ProtectedRoute when it bounced a
      // guest here) always wins — the user was already headed somewhere
      // specific. Otherwise route by role: admin-team members land in the
      // Admin Workspace, everyone else in the course catalog.
      redirectingToAdmin = !!loggedInUser.adminRole && !router.query.redirect;
      handlePostLogin(loggedInUser);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(axiosErr.response?.data?.message || t('login.genericError'));
    } finally {
      if (!redirectingToAdmin) setSubmitting(false);
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('login.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {redirectingAdmin && (
          <div className="mb-6 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300 text-center flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            {t('modalRedirectingToAdmin')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t('login.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('login.emailPlaceholder')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                {t('login.passwordLabel')}
              </label>
              <Link href="/auth/forgot-password" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
                {t('login.forgotPassword')}
              </Link>
            </div>
            <PasswordInput
              id="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              inputClassName="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('login.passwordPlaceholder')}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
            />
            {t('login.rememberMe')}
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('login.submittingButton') : t('login.submitButton')}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
          <span className="text-xs font-medium text-gray-400 dark:text-slate-500">{t('orDivider')}</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        </div>

        <div className="space-y-2.5">
          <GoogleSignInButton
            mode="login"
            lang={lang}
            onCredential={handleGoogleCredential}
            disabledLabel={t('googleButton')}
            disabledTitle={t('googleNotConfigured')}
          />
          <SocialLoginButtons lang={lang} />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
          {t('login.noAccount')}{' '}
          <Link href="/auth/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            {t('login.registerLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPageWrapper() {
  return (
    <GuestRoute>
      <LoginPage />
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
