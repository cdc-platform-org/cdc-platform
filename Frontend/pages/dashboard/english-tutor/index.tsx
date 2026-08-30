import { useRouter } from 'next/router';
import { GraduationCap } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import EnglishTutorPanel from '../../../src/components/dashboard/EnglishTutorPanel';
import SEOHead from '../../../src/components/seo/SEOHead';
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
  const router = useRouter();
  const lang = contentLocale(resolveLocale(router.locale));
  const t = dict[lang];

  return (
    <>
      {/* Rendered unconditionally, above ProtectedRoute: an anonymous
          crawler never sees EnglishTutorContent at all (ProtectedRoute
          renders null/a loading placeholder for it until auth resolves),
          so the noindex tag has to live here to actually reach the DOM —
          nesting it inside the gated content would silently never render
          for exactly the audience (unauthenticated crawlers) it's meant
          for. Same fix applied to media-studio.tsx. */}
      <SEOHead title={t.title} description={t.subtitle} noIndex />
      <ProtectedRoute>
        <EnglishTutorContent />
      </ProtectedRoute>
    </>
  );
}
