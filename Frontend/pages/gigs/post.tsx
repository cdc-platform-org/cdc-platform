import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import PostingForm from '../../src/components/community/PostingForm';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';
import { resolveLocale } from '../../src/utils/locale';

const STRINGS = {
  ka: { title: 'შეკვეთის გამოქვეყნება' },
  en: { title: 'Post a Gig' },
};

function PostGigPageContent() {
  const router = useRouter();
  const t = STRINGS[resolveLocale(router.locale) === 'ka' ? 'ka' : 'en'];
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 px-4 py-10">
      <SiteHeader />
      <div className="max-w-2xl mx-auto mb-4">
        <BackButton fallbackHref="/gigs" />
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white text-center mb-8">{t.title}</h1>
      {/* Open to any authenticated user — ProtectedRoute below already
          guarantees that; no additional role restriction. */}
      <PostingForm initialType="gig_request" />
    </div>
  );
}

export default function PostGigPage() {
  return (
    <ProtectedRoute>
      <PostGigPageContent />
    </ProtectedRoute>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});