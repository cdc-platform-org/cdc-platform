import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { AxiosError } from 'axios';
import { GraduationCap, Building2, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import GuestRoute from '../../src/components/auth/GuestRoute';
import PasswordInput from '../../src/components/auth/PasswordInput';
import GoogleSignInButton from '../../src/components/auth/GoogleSignInButton';
import SocialLoginButtons from '../../src/components/auth/SocialLoginButtons';
import LanguageSwitcher from '../../src/components/layout/LanguageSwitcher';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetStaticProps } from 'next';

function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuth();
  const { t } = useTranslation('auth');
  const lang = router.locale === 'en' ? 'en' : 'ka';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Student' | 'Client'>('Student');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleGoogleCredential = async (idToken: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await loginWithGoogle(idToken, role);
      router.push(loggedInUser.status === 'PENDING_APPROVAL' ? '/auth/pending-approval' : '/courses');
    } catch {
      setError('Unable to sign in with Google. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const newUser = await register({ name, email, password, role, acceptedTerms });
      // Self-serve Student/Client signups are auto-approved (see backend's
      // POST /register) — pending-approval is now only reachable for a
      // future role that still needs manual vetting.
      router.push(newUser.status === 'PENDING_APPROVAL' ? '/auth/pending-approval' : '/courses');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string; errors?: Array<{ message: string }> }>;
      const zodErrors = axiosErr.response?.data?.errors;

      if (Array.isArray(zodErrors) && zodErrors.length > 0) {
        setError(zodErrors.map((issue) => issue.message).join(' '));
      } else {
        setError(
          axiosErr.response?.data?.message ||
          'Unable to create your account. Please try again.'
        );
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
              type="type"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t('register.roleLabel')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('Student')}
                aria-pressed={role === 'Student'}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                  role === 'Student'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <GraduationCap className="w-5 h-5" />
                {t('register.roleStudent')}
              </button>
              <button
                type="button"
                onClick={() => setRole('Client')}
                aria-pressed={role === 'Client'}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                  role === 'Client'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <Building2 className="w-5 h-5" />
                {t('register.roleClient')}
              </button>
            </div>
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