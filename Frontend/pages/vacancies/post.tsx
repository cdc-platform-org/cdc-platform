import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import PostingForm from '../../src/components/community/PostingForm';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';
import { resolveLocale } from '../../src/utils/locale';

const STRINGS = {
  ka: { title: 'ვაკანსიის გამოქვეყნება', forbidden: 'ვაკანსიის გამოქვეყნება შეუძლიათ მხოლოდ ბიზნეს ანგარიშებსა და ადმინისტრატორებს.' },
  en: { title: 'Post a Vacancy', forbidden: 'Only business accounts and administrators can post vacancies.' },
};

function PostVacancyPageContent() {
  const router = useRouter();
  const t = STRINGS[resolveLocale(router.locale) === 'ka' ? 'ka' : 'en'];
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 px-4 py-10">
      <SiteHeader />
      <div className="max-w-2xl mx-auto mb-4">
        <BackButton fallbackHref="/vacancies" />
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white text-center mb-8">{t.title}</h1>
      <RoleGate
        allowedRoles={['Client', 'SuperAdmin']}
        fallback={
          <p className="text-center text-sm text-gray-500 dark:text-slate-400">{t.forbidden}</p>
        }
      >
        <PostingForm initialType="vacancy" />
      </RoleGate>
    </div>
  );
}

export default function PostVacancyPage() {
  return (
    <ProtectedRoute>
      <PostVacancyPageContent />
    </ProtectedRoute>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});