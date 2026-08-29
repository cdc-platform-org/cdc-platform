import { useRouter } from 'next/router';
import Head from 'next/head';
import { GraduationCap } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import EnglishTutorPanel from '../../../src/components/dashboard/EnglishTutorPanel';
import { resolveLocale, contentLocale } from '../../../src/utils/locale';

const dict = {
  ka: {
    title: 'IMIAKO — AI ინგლისურის რეპეტიტორი',
    subtitle: 'პრაქტიკა კითხვაში, წერაში, გრამატიკაში, ლექსიკაში, მოსმენასა და დიალოგში — თქვენს დონეზე, თქვენს ენაზე ახსნილი.',
  },
  en: {
    title: 'IMIAKO — AI English Tutor',
    subtitle: 'Practice Reading, Writing, Grammar, Vocabulary, Listening, and Dialogue — at your level, explained in your language.',
  },
};

function EnglishTutorContent() {
  const router = useRouter();
  const lang = contentLocale(resolveLocale(router.locale));
  const t = dict[lang];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <EnglishTutorPanel lang={lang} />
      </div>

      <SiteFooter />
    </div>
  );
}

export default function EnglishTutorPage() {
  return (
    <ProtectedRoute>
      <EnglishTutorContent />
    </ProtectedRoute>
  );
}
