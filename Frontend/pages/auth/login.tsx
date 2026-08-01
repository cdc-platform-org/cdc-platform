import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { AxiosError } from 'axios';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import GuestRoute from '../../src/components/auth/GuestRoute';
import PasswordInput from '../../src/components/auth/PasswordInput';
import GoogleSignInButton from '../../src/components/auth/GoogleSignInButton';
import LanguageSwitcher from '../../src/components/layout/LanguageSwitcher';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetStaticProps } from 'next';

function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const { t } = useTranslation('auth');
  const lang = router.locale === 'en' ? 'en' : 'ka';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectingAdmin, setRedirectingAdmin] = useState(false);

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
      setError('Unable to sign in with Google. Please try again.');
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
      const loggedInUser = await login({ email, password });
      // An explicit ?redirect= (set by ProtectedRoute when it bounced a
      // guest here) always wins — the user was already headed somewhere
      // specific. Otherwise route by role: admin-team members land in the
      // Admin Workspace, everyone else in the course catalog.
      redirectingToAdmin = !!loggedInUser.adminRole && !router.query.redirect;
      handlePostLogin(loggedInUser);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(
        axiosErr.response?.data?.message ||
        'Unable to log in. Please check your credentials and try again.'
      );
    } finally {
      if (!redirectingToAdmin) setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" aria-label="CDC Home" className="inline-flex no-underline">
            <Image src="/images/cdc-logo.png" alt="CDC" width={28} height={28} className="h-7 w-auto rounded-lg object-cover" />
          </Link>
          <LanguageSwitcher/>
        </div>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">{t('login.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('login.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {redirectingAdmin && (
          <div className="mb-6 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-700 text-center flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Signed in — redirecting to the Admin Workspace…
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('login.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('login.emailPlaceholder')}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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
              inputClassName="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('login.passwordPlaceholder')}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('login.submittingButton') : t('login.submitButton')}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs font-medium text-gray-400">{t('orDivider')}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <GoogleSignInButton
          mode="login"
          lang={lang}
          onCredential={handleGoogleCredential}
          disabledLabel={t('googleButton')}
          disabledTitle={t('googleNotConfigured')}
        />

        <p className="mt-6 text-center text-sm text-gray-500">
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
