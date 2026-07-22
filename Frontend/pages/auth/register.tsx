import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { AxiosError } from 'axios';
import { useAuth } from '../../src/context/AuthContext';
import GuestRoute from '../../src/components/auth/GuestRoute';
import LanguageSwitcher from '../../src/components/layout/LanguageSwitcher';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetStaticProps } from 'next';

function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useTranslation('auth');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // ბექენდის ვალიდაციის დასაკმაყოფილებლად დროებით ხელით ვატანთ role: 'Student'
      await register({ name, email, password, role: 'Student' } as any);
      router.push('/auth/pending-approval');
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex justify-end mb-4"><LanguageSwitcher/></div>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">{t('register.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('register.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('register.nameLabel')}
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('register.namePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('register.emailLabel')}
            </label>
            <input
              id="email"
              type="type"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('register.emailPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('register.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t('register.passwordPlaceholder')}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? t('register.submittingButton') : t('register.submitButton')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
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