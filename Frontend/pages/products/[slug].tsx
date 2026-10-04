import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import SEOHead from '../../src/components/seo/SEOHead';
import ProductVideoButton from '../../src/components/shared/ProductVideoButton';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { getSiteContent } from '../../src/services/siteContentService';
import { resolveBlogImageUrl } from '../../src/services/blogService';
import { ToolCatalogContent, ToolCatalogEntry } from '../../src/types/siteContent';
import { findToolEntry, resolveToolCategory, resolveLocalizedField } from '../../src/utils/toolCatalog';
import { findRegistryEntry } from '../../src/data/productCatalogRegistry';
import { resolveLocale } from '../../src/utils/locale';
import { SiteLocale } from '../../src/utils/seo';

// Reusable "premium template" public detail page (product spec section 5,
// 2026-10) for every AI Tool / AI Teacher / Children's Book — the ONE thing
// those three never had before: a real, indexable, shareable, server-
// rendered marketing page. Each one previously lived ONLY behind its
// authenticated dashboard route (SEOHead noIndex — see e.g.
// pages/dashboard/english-tutor/index.tsx), so there was nothing a social
// crawler (or Google) could ever see real content for; cards on
// /marketplace and /courses linked straight into the gated tool. This page
// is additive — those direct links/routes are untouched, this is a new
// front door, not a replacement.
//
// Digital Store products already have an equivalent (pages/store/[id].tsx,
// already SSR + real cover + SEOHead — confirmed by audit, no changes
// needed there). Blog already does the same (pages/blog/[slug].tsx).

const CHROME: Record<SiteLocale, { capabilities: string; howToUse: string; cta: Record<ToolCatalogEntry['category'] & string, string>; notFound: string }> = {
  ka: {
    capabilities: 'შესაძლებლობები',
    howToUse: 'როგორ გამოვიყენოთ',
    cta: { AI_TOOL: 'ხელსაწყოს გამოყენება', AI_TEACHER: 'სწავლის დაწყება', DIGITAL_PRODUCT_LINK: 'წიგნის შექმნა' },
    notFound: 'პროდუქტი ვერ მოიძებნა.',
  },
  en: {
    capabilities: 'Capabilities',
    howToUse: 'How to use it',
    cta: { AI_TOOL: 'Use AI Tool', AI_TEACHER: 'Start Learning', DIGITAL_PRODUCT_LINK: 'Create Your Book' },
    notFound: 'Product not found.',
  },
  de: { capabilities: 'Funktionen', howToUse: 'So wird es benutzt', cta: { AI_TOOL: 'Tool nutzen', AI_TEACHER: 'Lernen starten', DIGITAL_PRODUCT_LINK: 'Buch erstellen' }, notFound: 'Produkt nicht gefunden.' },
  es: { capabilities: 'Capacidades', howToUse: 'Cómo usarlo', cta: { AI_TOOL: 'Usar herramienta', AI_TEACHER: 'Empezar a aprender', DIGITAL_PRODUCT_LINK: 'Crear tu libro' }, notFound: 'Producto no encontrado.' },
  fr: { capabilities: 'Fonctionnalités', howToUse: 'Comment l’utiliser', cta: { AI_TOOL: "Utiliser l'outil", AI_TEACHER: "Commencer l'apprentissage", DIGITAL_PRODUCT_LINK: 'Créer votre livre' }, notFound: 'Produit introuvable.' },
  uk: { capabilities: 'Можливості', howToUse: 'Як користуватися', cta: { AI_TOOL: 'Використати інструмент', AI_TEACHER: 'Почати навчання', DIGITAL_PRODUCT_LINK: 'Створити книгу' }, notFound: 'Продукт не знайдено.' },
  tr: { capabilities: 'Özellikler', howToUse: 'Nasıl kullanılır', cta: { AI_TOOL: 'Aracı Kullan', AI_TEACHER: 'Öğrenmeye Başla', DIGITAL_PRODUCT_LINK: 'Kitabını Oluştur' }, notFound: 'Ürün bulunamadı.' },
  hy: { capabilities: 'Հնարավորություններ', howToUse: 'Ինչպես օգտագործել', cta: { AI_TOOL: 'Օգտագործել գործիքը', AI_TEACHER: 'Սկսել ուսուցումը', DIGITAL_PRODUCT_LINK: 'Ստեղծել գիրքը' }, notFound: 'Ապրանքը չի գտնվել:' },
  az: { capabilities: 'İmkanlar', howToUse: 'Necə istifadə etmək olar', cta: { AI_TOOL: 'Aləti istifadə et', AI_TEACHER: 'Öyrənməyə başla', DIGITAL_PRODUCT_LINK: 'Kitabını yarat' }, notFound: 'Məhsul tapılmadı.' },
};

interface ProductDetailPageProps {
  slug: string;
  entry: ToolCatalogEntry | null;
}

export default function ProductDetailPage({ slug, entry }: ProductDetailPageProps) {
  const router = useRouter();
  const locale = resolveLocale(router.locale);
  const t = CHROME[locale];
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const registryEntry = findRegistryEntry(slug);
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const { t: th } = useTranslation('home');
  const { t: tEdu } = useTranslation('educatorHub');
  const { t: tm } = useTranslation('mediaStudio');
  const { t: tMarket } = useTranslation('marketplace');

  // Same real per-slug default copy each card already shows on
  // /marketplace and /courses when the admin hasn't typed an override yet
  // (resolveLocalizedField below layers the CMS value on top of this, same
  // precedence as those two pages) — this page must never show the raw
  // slug as a "title" just because nobody has opened the CMS for it yet.
  const defaultCopy: Record<string, { title: string; desc: string }> = {
    'english-tutor': { title: th('imiakoCardTitle'), desc: th('imiakoFeature1') },
    'educator-hub': { title: tEdu('pageTitle'), desc: tEdu('pageSubtitle') },
    'media-studio': { title: tm('catalogTitle'), desc: tm('catalogDesc') },
    'smart-reader': {
      title: lang === 'ka' ? 'AI ჭკვიანი წამკითხველი' : 'AI Smart Reader',
      desc: lang === 'ka' ? 'ივარჯიშე კითხვასა და გამოთქმაში AI-ის პერსონალური დახმარებით.' : 'Practice reading and pronunciation with interactive AI guidance.',
    },
    proctoring: { title: tMarket('proctoringTitle'), desc: tMarket('proctoringDesc') },
    'childrens-book': {
      title: lang === 'ka' ? 'პერსონალური საბავშვო წიგნი' : "Personalized Children's Book",
      desc: lang === 'ka' ? 'შექმენი უნიკალური ისტორია, სადაც შენი ბავშვი მთავარი გმირია.' : 'Create a unique story where your child is the main character.',
    },
  };

  if (!registryEntry) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
        <Head>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.notFound}</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const category = entry ? resolveToolCategory(entry) : registryEntry.category;
  const fallback = defaultCopy[slug] ?? { title: slug, desc: '' };
  const title = resolveLocalizedField(locale, fallback.title, entry?.titleLocales, entry?.titleKa, entry?.titleEn);
  const subtitle = resolveLocalizedField(locale, '', entry?.subtitleLocales, entry?.subtitleKa, entry?.subtitleEn);
  const description = resolveLocalizedField(locale, fallback.desc, entry?.descriptionLocales, entry?.descriptionKa, entry?.descriptionEn);
  const fullDescription = resolveLocalizedField(locale, description, entry?.fullDescriptionLocales, undefined, undefined);
  const features = locale === 'ka' ? entry?.featuresKa : entry?.featuresEn;
  const coverUrl = entry?.imageUrl ? resolveBlogImageUrl(entry.imageUrl) : undefined;
  const Icon = registryEntry.icon;

  const handleCta = () => {
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: () => router.push(registryEntry.route) });
      return;
    }
    router.push(registryEntry.route);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SEOHead
        title={title}
        description={(subtitle || description || fullDescription).slice(0, 200)}
        ogImage={coverUrl}
        ogType="product"
      />
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-6">
          <BackButton fallbackHref="/marketplace" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        {/* HERO / COVER */}
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={title} className="w-full aspect-[1200/630] rounded-3xl object-cover mb-6 border border-slate-200 dark:border-slate-800" />
        ) : (
          <div className={`w-full aspect-[1200/630] rounded-3xl mb-6 bg-gradient-to-tr ${registryEntry.accent} flex items-center justify-center`}>
            <Icon className="w-16 h-16 text-white/90" />
          </div>
        )}

        <h1 className="text-2xl sm:text-3xl font-black tracking-wide mb-2">{title}</h1>
        {subtitle && <p className="text-base text-slate-600 dark:text-slate-300 mb-4">{subtitle}</p>}

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <button
            type="button"
            onClick={handleCta}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold px-6 py-3 hover:opacity-90 transition-opacity"
          >
            {t.cta[category]} →
          </button>
        </div>

        {/* HOW TO USE — public-facing: shown only when a real video is
            configured. No video configured must mean no broken button AND
            no "missing" messaging — the public page should just not have
            this section, as if it were never written. The admin editor
            (pages/admin/tools.tsx) keeps its own "No instruction video
            configured" hint so the admin can tell the field is empty. */}
        {entry?.videoUrl && (
          <div className="mb-8">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">{t.howToUse}</h2>
            <ProductVideoButton videoUrl={entry.videoUrl} locale={locale} title={title} />
          </div>
        )}

        {fullDescription && (
          <div className="prose dark:prose-invert max-w-none mb-8 whitespace-pre-wrap text-sm leading-relaxed">{fullDescription}</div>
        )}

        {!!features?.length && (
          <div className="mb-8">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">{t.capabilities}</h2>
            <ul className="grid sm:grid-cols-2 gap-2">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <span className="text-cyan-500 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<ProductDetailPageProps> = async ({ params, locale }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  // Fetched server-side (not client-only) so SEOHead above renders real
  // og:title/og:description/og:image in the initial HTML — the exact same
  // reasoning pages/store/[id].tsx's own getServerSideProps already
  // documents; social-media crawlers never execute client JS.
  const row = await getSiteContent<ToolCatalogContent>('tool-catalog').catch(() => null);
  const entry = findToolEntry(row?.content?.tools, slug) ?? null;
  return {
    props: {
      slug,
      entry,
      ...(await serverSideTranslations(locale ?? 'ka', ['home', 'educatorHub', 'mediaStudio', 'marketplace'])),
    },
  };
};
