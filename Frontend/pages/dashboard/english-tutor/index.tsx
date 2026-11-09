import { useRouter } from 'next/router';
import { GraduationCap } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import EnglishTutorPanel from '../../../src/components/dashboard/EnglishTutorPanel';
import SEOHead from '../../../src/components/seo/SEOHead';
import { resolveLocale, contentLocale } from '../../../src/utils/locale';
import ToolMediaBanner from '../../../src/components/tools/ToolMediaBanner';
import ToolShell, { ToolPageHeader } from '../../../src/components/tools/ToolShell';

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
    <ToolShell backHref="/dashboard/tools" width="narrow">
      <ToolPageHeader icon={GraduationCap} accent="purple" title={t.title} subtitle={t.subtitle} />
      <ToolMediaBanner slug="english-tutor" alt={t.title} />
      <EnglishTutorPanel lang={lang} />
    </ToolShell>
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
