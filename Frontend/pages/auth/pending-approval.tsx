import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { resolveLocale } from '@/src/utils/locale';

const HOME_LABEL: Record<string, string> = {
  ka: 'მთავარ გვერდზე დაბრუნება',
  en: 'Back to Home',
  de: 'Back to Home',
  es: 'Back to Home',
  fr: 'Back to Home',
  uk: 'Back to Home',
};

export default function PendingApprovalPage() {
  const { t } = useTranslation('auth');
  const { logout } = useAuth();
  const router = useRouter();
  const homeLabel = HOME_LABEL[resolveLocale(router.locale)];

  const handleLogout = () => {
    logout();
    router.replace('/auth/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0b0f19] px-4">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-none border border-slate-200/80 dark:border-white/10 p-8 text-center transition-colors">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('pendingApproval.title')}</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">{t('pendingApproval.message')}</p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white no-underline hover:bg-indigo-700"
        >
          {homeLabel}
        </Link>
        <button
          onClick={handleLogout}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500 bg-transparent border-none cursor-pointer"
        >
          {t('pendingApproval.logout')}
        </button>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['auth'])) },
});