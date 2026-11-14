/**
 * /courses catalog: loads courses + live trainings, client-side search/
 * filter/sort and checkout. Cards and the filter panel live in
 * src/components/courses/catalog/ (2026-11 EDUPRO-style redesign).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetStaticProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Search, SlidersHorizontal, GraduationCap } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { Course, CourseLanguage } from '../../src/types/lms';
import { LiveTraining } from '../../src/types/liveTraining';
import { getCourses } from '../../src/services/courseService';
import { getLiveTrainings } from '../../src/services/liveTrainingService';
import { checkoutCourse } from '../../src/services/paymentService';
import { getSiteContent } from '../../src/services/siteContentService';
import { resolveBlogImageUrl } from '../../src/services/blogService';
import { ToolCatalogContent } from '../../src/types/siteContent';
import { findToolEntry } from '../../src/utils/toolCatalog';
import { CatalogAiTeacherCard, CatalogCourseCard, CatalogLiveTrainingCard } from '../../src/components/courses/catalog/CatalogCards';
import CatalogFilters, { type PriceFilter, type SortMode } from '../../src/components/courses/catalog/CatalogFilters';
import PromoCheckoutModal from '../../src/components/shared/PromoCheckoutModal';
import FeaturedCourseRail from '../../src/components/courses/FeaturedCourseRail';
import { CourseCardSkeleton } from '../../src/components/courses/CourseCard';
import { isPublishedCourse } from '../../src/utils/courseCatalog';

type ContentTab = 'all' | 'courses' | 'live' | 'ai-teachers';
const INTERNAL_TEST_CATEGORY = /(?:^|[^a-z0-9])(?:qa|e2e|test(?:ing)?|fixture|fixtures|demo|seed)(?:$|[^a-z0-9])/i;

// Personalized AI learning products shown under the "AI Teachers" tab — not
// Course/LiveTraining DB rows (they're live dashboard tools, same concept
// as marketplace/index.tsx's SAAS_TOOLS), so this is a small fixed list
// rendered directly here rather than fetched, reusing each tool's own
// already-translated copy the same way marketplace/index.tsx and tools.tsx
// do. Educator Hub is a teacher productivity suite, not personalized
// learner instruction, so it belongs with Digital AI Tools instead.
const AI_TEACHERS = [
  { id: 'english-tutor', href: '/dashboard/english-tutor', icon: GraduationCap, accent: 'from-purple-500 to-cyan-600' },
] as const;

export default function CoursesPage() {
  const router = useRouter();
  // Drives ka/en-only data (checkoutCourse's receipt language, course.language
  // badges, sale countdown) — falls back to English for de/es/fr/uk visitors
  // rather than Georgian.
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const { t } = useTranslation('courses');
  const { t: th } = useTranslation('home');
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const aiTeacherCopy: Record<(typeof AI_TEACHERS)[number]['id'], { title: string; desc: string; badge: string }> = {
    'english-tutor': { title: th('imiakoCardTitle'), desc: th('imiakoFeature1'), badge: th('imiakoBadgeFreeTrial') },
  };

  // Same "guest -> auth modal -> resume" pattern as marketplace/index.tsx's
  // goToSaasTool — a plain <Link> here would just full-navigate into
  // ProtectedRoute's own redirect-to-login on the destination page.
  const goToAiTeacher = (href: string) => {
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: () => router.push(href) });
      return;
    }
    router.push(href);
  };

  const [courses, setCourses] = useState<Course[]>([]);
  const [liveTrainings, setLiveTrainings] = useState<LiveTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Paid course picked from a card — opens the promo-code + pay step first.
  const [checkoutCourseItem, setCheckoutCourseItem] = useState<Course | null>(null);
  const [contentTab, setContentTab] = useState<ContentTab>('all');
  // Admin-editable cover image override for each AI teacher card (see
  // pages/admin/tools.tsx) — null until loaded, at which point a missing
  // imageUrl for a given slug just falls back to that card's existing
  // gradient/icon header, same "layer overrides on top of defaults"
  // convention as marketplace/index.tsx's own toolCatalog fetch.
  const [toolCatalog, setToolCatalog] = useState<ToolCatalogContent | null>(null);

  useEffect(() => {
    getSiteContent<ToolCatalogContent>('tool-catalog')
      .then((row) => setToolCatalog(row?.content ?? {}))
      .catch(() => setToolCatalog({}));
  }, []);

  // Client-side search/filter/sort over the same getCourses()/
  // getLiveTrainings() fetches this page always made (the latter newly
  // added) — no new backend endpoint, no new query params. Catalog size on
  // this platform is small enough that this is genuinely simpler and just
  // as fast as a server-side filter would be.
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [language, setLanguage] = useState<CourseLanguage | null>(null);
  const [discountedOnly, setDiscountedOnly] = useState(false);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sort, setSort] = useState<SortMode>('recommended');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [courseData, liveTrainingData] = await Promise.all([getCourses(), getLiveTrainings()]);
      setCourses(courseData.filter((c) => isPublishedCourse(c) && !INTERNAL_TEST_CATEGORY.test(c.category)));
      // "Active" = published (already server-filtered — GET /live-trainings
      // only returns published rows for an unauthenticated/non-admin
      // visitor) AND not yet happened. A past session has nothing left to
      // register for, so it has no place in a "browse what's available"
      // listing even though the row itself is still published for
      // historical/admin reference.
      const now = Date.now();
      setLiveTrainings(liveTrainingData.filter((tr) => new Date(tr.scheduledAt).getTime() >= now && !INTERNAL_TEST_CATEGORY.test(tr.category)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real categories/languages actually present in the catalog — never a
  // hardcoded list, so a filter option never appears for something with
  // zero matching courses. Categories are pooled across both content types
  // (a live training's category is just as real a filter target as a
  // course's) — language has no live-training equivalent, so it stays
  // course-only.
  const categories = useMemo(
    () => Array.from(new Set([...courses.map((c) => c.category), ...liveTrainings.map((t) => t.category)])).sort(),
    [courses, liveTrainings]
  );
  const languagesPresent = useMemo(
    () => Array.from(new Set([...courses.map((c) => c.language), ...liveTrainings.map((t) => t.language)])),
    [courses, liveTrainings]
  );

  // AI teachers have no category/language/discount of their own, so they
  // only join the combined ALL grid when no category/language/discount
  // filter is narrowing the catalog to something they can't match — same
  // rule a real course would be held to if it had none of those fields.
  // They're priced as free, so a "paid" filter excludes them the same way
  // a free course would be excluded.
  const filteredAiTeachers = useMemo(() => {
    if (contentTab !== 'all') return [];
    if (category || language || discountedOnly || priceFilter === 'paid') return [];
    const q = search.trim().toLowerCase();
    return AI_TEACHERS.filter(({ id }) => {
      const copy = aiTeacherCopy[id];
      if (q && !copy.title.toLowerCase().includes(q) && !copy.desc.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contentTab, category, language, discountedOnly, priceFilter, search, aiTeacherCopy]);

  const filteredCourses = useMemo(() => {
    if (contentTab === 'live') return [];
    const q = search.trim().toLowerCase();
    let result = courses.filter((c) => {
      if (category && c.category !== category) return false;
      if (language && c.language !== language) return false;
      if (discountedOnly && !c.saleActive) return false;
      if (priceFilter === 'free' && c.currentPrice > 0) return false;
      if (priceFilter === 'paid' && c.currentPrice === 0) return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !c.description.toLowerCase().includes(q) &&
        !(c.mentorName && c.mentorName.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
    if (sort === 'price_asc') result = [...result].sort((a, b) => a.currentPrice - b.currentPrice);
    else if (sort === 'price_desc') result = [...result].sort((a, b) => b.currentPrice - a.currentPrice);
    return result;
  }, [courses, search, category, language, discountedOnly, priceFilter, sort, contentTab]);

  // No `sort` handling — a live training stays in the server's
  // soonest-first order (discountedOnly is also a course-only concept, so
  // it's skipped here too) rather than being force-fit through a sort that
  // doesn't semantically apply. `language` now applies to both (LiveTraining
  // gained its own `language` column alongside Course's).
  const filteredLiveTrainings = useMemo(() => {
    if (contentTab === 'courses') return [];
    const q = search.trim().toLowerCase();
    return liveTrainings.filter((tr) => {
      if (category && tr.category !== category) return false;
      if (language && tr.language !== language) return false;
      const price = tr.currentPrice ?? tr.price ?? 0;
      if (priceFilter === 'free' && price > 0) return false;
      if (priceFilter === 'paid' && price === 0) return false;
      if (q && !tr.title.toLowerCase().includes(q) && !tr.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [liveTrainings, search, category, language, priceFilter, contentTab]);

  const totalResultsCount = filteredCourses.length + filteredLiveTrainings.length + filteredAiTeachers.length;

  const hasActiveFilters = !!search || !!category || !!language || discountedOnly || priceFilter !== 'all';
  const clearFilters = () => {
    setSearch('');
    setCategory(null);
    setLanguage(null);
    setDiscountedOnly(false);
    setPriceFilter('all');
  };

  const startCheckout = async (course: Course, promoCode?: string) => {
    setError(null);
    setEnrollingId(course.id);
    try {
      const result = await checkoutCourse(course.id, promoCode, lang);
      if (result.enrolled) {
        router.push(`/courses/${course.id}/learn`);
        return;
      }
      window.location.href = result.redirectUrl!;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t('checkoutError'));
      setEnrollingId(null);
    }
  };

  // Free courses enroll straight away; paid ones first show the promo-code
  // step so a code can be applied from the list too, not only on the
  // course page.
  const openCheckout = (course: Course) => {
    if (course.currentPrice > 0) {
      setError(null);
      setCheckoutCourseItem(course);
      return;
    }
    startCheckout(course);
  };

  const handleEnroll = (course: Course) => {
    if (!isAuthenticated) {
      // Guests never proceed to checkout directly — sign in first, then
      // resume straight into checkout for this exact course.
      openAuthModal({ message: t('signInToEnroll'), onSuccess: () => openCheckout(course) });
      return;
    }
    openCheckout(course);
  };

  const resultsLabel =
    contentTab === 'all'
      ? totalResultsCount === 1
        ? t('resultsCountCombined', { count: totalResultsCount })
        : t('resultsCountCombinedPlural', { count: totalResultsCount })
      : totalResultsCount === 1
      ? t('resultsCount', { count: totalResultsCount })
      : t('resultsCountPlural', { count: totalResultsCount });
  const showResultsLabel =
    contentTab === 'all'
      ? totalResultsCount === 1
        ? t('showResultsCombined', { count: totalResultsCount })
        : t('showResultsCombinedPlural', { count: totalResultsCount })
      : totalResultsCount === 1
      ? t('showResults', { count: totalResultsCount })
      : t('showResultsPlural', { count: totalResultsCount });

  const aiTeacherCards = (list: readonly (typeof AI_TEACHERS)[number][]) =>
    list.map(({ id, href, icon }) => {
      const copy = aiTeacherCopy[id];
      const cmsImageUrl = findToolEntry(toolCatalog?.tools, id)?.imageUrl;
      return (
        <CatalogAiTeacherCard
          key={id}
          title={copy.title}
          desc={copy.desc}
          badge={copy.badge}
          imageUrl={cmsImageUrl ? resolveBlogImageUrl(cmsImageUrl) : null}
          icon={icon}
          t={t}
          onOpen={() => goToAiTeacher(href)}
        />
      );
    });

  return (
    <div className="learning-surface -mx-4 sm:-mx-6 px-4 sm:px-6 min-h-screen bg-cdc-bg text-cdc-ink flex flex-col">
      <Head>
        <title>{`${t('title')} | CDC`}</title>
      </Head>
      <SiteHeader />
      {checkoutCourseItem && (
        <PromoCheckoutModal
          title={checkoutCourseItem.title}
          currentPrice={checkoutCourseItem.currentPrice}
          originalPrice={checkoutCourseItem.originalPrice}
          targetType="COURSE"
          targetId={checkoutCourseItem.id}
          lang={lang}
          busy={enrollingId === checkoutCourseItem.id}
          error={error}
          onConfirm={(code) => startCheckout(checkoutCourseItem, code)}
          onClose={() => { setCheckoutCourseItem(null); setError(null); }}
        />
      )}
      <div className="max-w-7xl mx-auto py-8 sm:py-12 flex-1 w-full">
        <div className="mb-6">
          <BackButton fallbackHref="/" className="text-cdc-muted hover:text-cdc-ink" />
        </div>

        {/* Page heading + EDUPRO-style search bar with a square filter
            button (the button opens the filter drawer on mobile). */}
        <h1 style={{ lineHeight: 1.25 }} className="text-4xl sm:text-6xl font-extrabold tracking-tight text-cdc-ink">{t('academy.eyebrow')}</h1>
        <p className="mt-2 text-cdc-muted">{t('subtitle')}</p>

        {contentTab === 'all' && !search && !category && <FeaturedCourseRail courses={courses} loading={loading} lang={lang} />}

        <div className="mt-8 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cdc-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchLabel')}
              className="w-full rounded-2xl border border-cdc-border bg-cdc-surface shadow-card pl-12 pr-4 py-3.5 text-base text-cdc-ink placeholder:text-cdc-muted focus:outline-none focus:ring-2 focus:ring-cdc-primary/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label={t('filtersToggle')}
            aria-expanded={filtersOpen}
            className="shrink-0 w-[52px] h-[52px] rounded-2xl bg-cdc-primary text-white flex items-center justify-center border-none cursor-pointer hover:bg-cdc-primary-hover"
          >
            <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Segmented content tabs */}
        <div className="mt-5 mb-8 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {([
            ['all', t('tabAll')],
            ['courses', t('tabVideoCourses')],
            ['live', t('tabLiveTrainings')],
            ['ai-teachers', t('tabAiTeachers')],
          ] as [ContentTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setContentTab(tab)}
              className={`shrink-0 text-sm font-bold px-4 py-2 rounded-full border cursor-pointer transition-colors ${
                contentTab === tab
                  ? 'bg-cdc-primary text-white border-cdc-primary'
                  : 'bg-cdc-surface text-cdc-muted border-cdc-border hover:text-cdc-ink hover:border-cdc-primary/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>}

        {contentTab === 'ai-teachers' ? (
          <div>
            <p className="text-sm text-cdc-muted mb-6 max-w-2xl">{t('aiTeachersSubtitle')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">{aiTeacherCards(AI_TEACHERS)}</div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{Array.from({length:8},(_,i)=><CourseCardSkeleton key={i} label={t('loading')} />)}</div>
        ) : courses.length === 0 && liveTrainings.length === 0 && contentTab !== 'all' ? (
          <p className="text-cdc-muted text-sm">{t('empty')}</p>
        ) : (
          <div>
            <CatalogFilters
              t={t}
              lang={lang}
              open={filtersOpen}
              onClose={closeFilters}
              categories={categories}
              category={category}
              setCategory={setCategory}
              languagesPresent={languagesPresent}
              language={language}
              setLanguage={setLanguage}
              priceFilter={priceFilter}
              setPriceFilter={setPriceFilter}
              discountedOnly={discountedOnly}
              setDiscountedOnly={setDiscountedOnly}
              sort={sort}
              setSort={setSort}
              hasActiveFilters={hasActiveFilters}
              clearFilters={clearFilters}
              showResultsLabel={showResultsLabel}
            />

            <div className="flex-1 min-w-0">
              <div className="mb-6 flex flex-col sm:flex-row gap-4 sm:items-center border-y border-cdc-border py-4">
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" aria-label={t('categoryLabel')}>
                  {[null, ...categories].map(cat => <button key={cat || 'all'} type="button" aria-pressed={category === cat} onClick={() => setCategory(cat)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${category === cat ? 'bg-cdc-ink text-cdc-surface border-cdc-ink' : 'border-cdc-border text-cdc-muted hover:text-cdc-ink'}`}>{cat || t('academy.allCategories')}</button>)}
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs text-cdc-muted">{t('sortLabel')}<select aria-label={t('sortLabel')} value={sort} onChange={event => setSort(event.target.value as SortMode)} className="rounded-lg border border-cdc-border bg-cdc-surface px-3 py-2 text-cdc-ink"><option value="recommended">{t('sortRecommended')}</option><option value="price_asc">{t('sortPriceAsc')}</option><option value="price_desc">{t('sortPriceDesc')}</option></select></label>
              </div>
              <p role="status" className="text-sm font-semibold text-cdc-muted mb-4">{resultsLabel}</p>
              {totalResultsCount === 0 ? (
                <p className="text-cdc-muted text-sm">{t('noResults')}</p>
              ) : (
                <div data-testid="course-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                  {filteredCourses.map((course) => (
                    <CatalogCourseCard key={course.id} course={course} lang={lang} t={t} enrolling={enrollingId === course.id} onEnroll={handleEnroll} />
                  ))}
                  {filteredLiveTrainings.map((tr) => (
                    <CatalogLiveTrainingCard key={tr.id} training={tr} lang={lang} t={t} />
                  ))}
                  {aiTeacherCards(filteredAiTeachers)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['courses', 'home', 'educatorHub'])) },
});
