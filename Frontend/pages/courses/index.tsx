import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { Course, CourseLanguage } from '../../src/types/lms';
import { getCourses } from '../../src/services/courseService';
import { checkoutCourse } from '../../src/services/paymentService';
import { formatPrice, getSaleCountdownLabel } from '../../src/utils/coursePricing';
import { courseLanguageBadge } from '../../src/utils/courseLanguage';

type SortMode = 'recommended' | 'price_asc' | 'price_desc';
type PriceFilter = 'all' | 'free' | 'paid';

const dict = {
  ka: {
    title: 'კურსები',
    subtitle: 'აირჩიე კურსი და დაიწყე ციფრული პროფესიის შესწავლა.',
    enroll: 'ჩარიცხვა →',
    enrolling: 'იტვირთება…',
    viewDetails: 'ვრცლად',
    loading: 'იტვირთება…',
    empty: 'კურსები ჯერ არ არის დამატებული.',
    noResults: 'ფილტრებით ვერაფერი მოიძებნა.',
    clearFilters: 'ფილტრების გასუფთავება',
    signInToEnroll: { ka: 'გთხოვთ გაიაროთ ავტორიზაცია კურსზე ჩასარიცხად', en: 'Please sign in to enroll in a course' },
    searchLabel: 'კურსის ძებნა',
    searchPlaceholder: 'საკვანძო სიტყვა…',
    categoryLabel: 'კატეგორია',
    languageLabel: 'ენა',
    allCategories: 'ყველა კატეგორია',
    allLanguages: 'ყველა ენა',
    sortLabel: 'დალაგება',
    sortRecommended: 'რეკომენდებული',
    sortPriceAsc: 'ფასი: დაბლიდან მაღლა',
    sortPriceDesc: 'ფასი: მაღლიდან დაბლა',
    resultsCount: (n: number) => `${n} კურსი`,
    filtersToggle: 'ფილტრები',
    discountedOnly: 'ფასდაკლებული',
    priceLabel: 'ფასი',
    priceAll: 'ყველა',
    priceFree: 'უფასო',
    pricePaid: 'ფასიანი',
    filtersDrawerTitle: 'ფილტრები',
    showResults: (n: number) => `${n} შედეგის ჩვენება`,
  },
  en: {
    title: 'Courses',
    subtitle: 'Pick a course and start building a digital career.',
    enroll: 'Enroll Now →',
    enrolling: 'Loading…',
    viewDetails: 'View Details',
    loading: 'Loading…',
    empty: 'No courses have been published yet.',
    noResults: 'No courses match these filters.',
    clearFilters: 'Clear filters',
    signInToEnroll: { ka: 'გთხოვთ გაიაროთ ავტორიზაცია კურსზე ჩასარიცხად', en: 'Please sign in to enroll in a course' },
    searchLabel: 'Search Courses',
    searchPlaceholder: 'Keyword…',
    categoryLabel: 'Category',
    languageLabel: 'Language',
    allCategories: 'All Categories',
    allLanguages: 'All Languages',
    sortLabel: 'Sort By',
    sortRecommended: 'Recommended',
    sortPriceAsc: 'Price: Low to High',
    sortPriceDesc: 'Price: High to Low',
    resultsCount: (n: number) => `${n} course${n === 1 ? '' : 's'}`,
    filtersToggle: 'Filters',
    discountedOnly: 'On Sale',
    priceLabel: 'Price',
    priceAll: 'All Prices',
    priceFree: 'Free',
    pricePaid: 'Paid',
    filtersDrawerTitle: 'Filter Courses',
    showResults: (n: number) => `Show ${n} result${n === 1 ? '' : 's'}`,
  },
};

export default function CoursesPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Client-side search/filter/sort over the same getCourses() fetch this
  // page always made — no new backend endpoint, no new query params. Course
  // count on this platform is small enough that this is genuinely simpler
  // and just as fast as a server-side filter would be.
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [language, setLanguage] = useState<CourseLanguage | null>(null);
  const [discountedOnly, setDiscountedOnly] = useState(false);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sort, setSort] = useState<SortMode>('recommended');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCourses();
      setCourses(data.filter((c) => c.published));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real categories/languages actually present in the catalog — never a
  // hardcoded list, so a filter option never appears for something with
  // zero matching courses.
  const categories = useMemo(() => Array.from(new Set(courses.map((c) => c.category))).sort(), [courses]);
  const languagesPresent = useMemo(() => Array.from(new Set(courses.map((c) => c.language))), [courses]);

  const filteredCourses = useMemo(() => {
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
  }, [courses, search, category, language, discountedOnly, priceFilter, sort]);

  const hasActiveFilters = !!search || !!category || !!language || discountedOnly || priceFilter !== 'all';
  const clearFilters = () => {
    setSearch('');
    setCategory(null);
    setLanguage(null);
    setDiscountedOnly(false);
    setPriceFilter('all');
  };

  const startCheckout = async (course: Course) => {
    setError(null);
    setEnrollingId(course.id);
    try {
      const result = await checkoutCourse(course.id, undefined, lang);
      if (result.enrolled) {
        router.push(`/courses/${course.id}/learn`);
        return;
      }
      window.location.href = result.redirectUrl!;
    } catch {
      setError(lang === 'en' ? 'Unable to start checkout. Please try again.' : 'გადახდის დაწყება ვერ მოხერხდა.');
      setEnrollingId(null);
    }
  };

  const handleEnroll = (course: Course) => {
    if (!isAuthenticated) {
      // Guests never proceed to checkout directly — sign in first, then
      // resume straight into BOG checkout for this exact course.
      openAuthModal({ message: t.signInToEnroll, onSuccess: () => startCheckout(course) });
      return;
    }
    startCheckout(course);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-7xl mx-auto px-6 py-16 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-3xl font-black">{t.title}</h1>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="lg:hidden inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {t.filtersToggle}
          </button>
        </div>
        <p className="text-slate-500 dark:text-slate-400 mb-10">{t.subtitle}</p>

        {error && <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>}

        {loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.loading}</p>
        ) : courses.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.empty}</p>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* FILTER SIDEBAR — in-flow sticky panel on desktop; a fixed
                slide-over drawer (with backdrop) on mobile, opened by the
                "Filters" button above. */}
            <aside>
              {filtersOpen && (
                <div
                  className="lg:hidden fixed inset-0 bg-black/50 z-40"
                  onClick={() => setFiltersOpen(false)}
                />
              )}
              <div
                className={`fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-80 max-w-[85vw] lg:w-64 shrink-0 flex flex-col lg:block bg-white dark:bg-slate-900 lg:bg-transparent lg:dark:bg-transparent transition-transform duration-300 ease-in-out lg:transition-none ${
                  filtersOpen ? 'translate-x-0' : '-translate-x-full'
                } lg:translate-x-0`}
              >
                <div className="lg:hidden flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <span className="text-sm font-black">{t.filtersDrawerTitle}</span>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    aria-label="Close"
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto lg:overflow-visible rounded-none lg:rounded-2xl border-0 lg:border border-slate-200/80 dark:border-slate-800 bg-transparent lg:bg-white/90 lg:dark:bg-slate-900/60 lg:backdrop-blur-md lg:shadow-md lg:shadow-slate-200/40 lg:dark:shadow-none p-5 space-y-6 lg:sticky lg:top-24">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                    {t.searchLabel}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t.categoryLabel}</p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="radio" checked={category === null} onChange={() => setCategory(null)} className="text-cyan-600 focus:ring-cyan-500" />
                      {t.allCategories}
                    </label>
                    {categories.map((cat) => (
                      <label key={cat} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input type="radio" checked={category === cat} onChange={() => setCategory(cat)} className="text-cyan-600 focus:ring-cyan-500" />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>

                {languagesPresent.length > 1 && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t.languageLabel}</p>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input type="radio" checked={language === null} onChange={() => setLanguage(null)} className="text-cyan-600 focus:ring-cyan-500" />
                        {t.allLanguages}
                      </label>
                      {languagesPresent.map((l) => (
                        <label key={l} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input type="radio" checked={language === l} onChange={() => setLanguage(l)} className="text-cyan-600 focus:ring-cyan-500" />
                          {courseLanguageBadge(l, lang)}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t.priceLabel}</p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="radio" checked={priceFilter === 'all'} onChange={() => setPriceFilter('all')} className="text-cyan-600 focus:ring-cyan-500" />
                      {t.priceAll}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="radio" checked={priceFilter === 'free'} onChange={() => setPriceFilter('free')} className="text-cyan-600 focus:ring-cyan-500" />
                      {t.priceFree}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input type="radio" checked={priceFilter === 'paid'} onChange={() => setPriceFilter('paid')} className="text-cyan-600 focus:ring-cyan-500" />
                      {t.pricePaid}
                    </label>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discountedOnly}
                    onChange={(e) => setDiscountedOnly(e.target.checked)}
                    className="rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  {t.discountedOnly}
                </label>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t.sortLabel}</label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortMode)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="recommended">{t.sortRecommended}</option>
                    <option value="price_asc">{t.sortPriceAsc}</option>
                    <option value="price_desc">{t.sortPriceDesc}</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer p-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t.clearFilters}
                  </button>
                )}
                </div>
                <div className="lg:hidden shrink-0 p-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="w-full text-center text-sm font-black text-white px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600"
                  >
                    {t.showResults(filteredCourses.length)}
                  </button>
                </div>
              </div>
            </aside>

            {/* RESULTS */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">{t.resultsCount(filteredCourses.length)}</p>
              {filteredCourses.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t.noResults}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredCourses.map((course) => {
                    const countdown = course.saleActive ? getSaleCountdownLabel(course.discountEndDate, lang) : null;
                    return (
                      <div
                        key={course.id}
                        className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 flex flex-col justify-between"
                      >
                        {course.saleActive && (
                          <span className="absolute -top-2.5 -right-2.5 text-xs font-black text-white px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-rose-500/30">
                            -{course.discountPercent}% {lang === 'ka' ? '' : 'OFF'}
                          </span>
                        )}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-600 dark:text-purple-300 bg-purple-500/10 border-purple-500/20">
                                {course.category}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-slate-600 dark:text-slate-300 bg-slate-500/10 border-slate-500/20 whitespace-nowrap">
                                {courseLanguageBadge(course.language, lang)}
                              </span>
                            </div>
                            <span className="text-sm font-black text-cyan-600 dark:text-cyan-300 whitespace-nowrap">{formatPrice(course.currentPrice)}</span>
                          </div>
                          <Link href={`/courses/${course.id}`} className="block no-underline text-current">
                            <h3 className="text-lg font-black mt-4 mb-2 text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors">{course.title}</h3>
                          </Link>
                          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 line-clamp-3">{course.description}</p>
                          {course.mentorName && (
                            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                              {course.mentorAvatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={course.mentorAvatarUrl}
                                  alt={course.mentorName}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                                  {course.mentorName.slice(0, 2)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{course.mentorName}</p>
                                {course.mentorTitle && <p className="text-[11px] text-slate-500 truncate">{course.mentorTitle}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          {countdown && <p className="text-[11px] font-bold text-rose-500 dark:text-rose-400 mb-2">⏳ {countdown}</p>}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-baseline gap-2">
                              {course.saleActive && (
                                <s className="text-sm text-slate-500">{formatPrice(course.originalPrice)}</s>
                              )}
                              <span className="text-xl font-black text-slate-900 dark:text-white">{formatPrice(course.currentPrice)}</span>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href={`/courses/${course.id}`}
                                className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 no-underline"
                              >
                                {t.viewDetails}
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleEnroll(course)}
                                disabled={enrollingId === course.id}
                                className="text-xs font-black text-white px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60"
                              >
                                {enrollingId === course.id ? t.enrolling : t.enroll}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
    </div>
  );
}
