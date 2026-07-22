import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../src/context/AuthContext';

export default function PendingApprovalPage() {
  const { t } = useTranslation('auth');
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">{t('pendingApproval.title')}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('pendingApproval.message')}</p>
        <button
          onClick={logout}
          className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-500"
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