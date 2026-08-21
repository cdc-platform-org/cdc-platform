import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Search, PlayCircle, ChevronDown, GraduationCap, Briefcase, Bot, CreditCard, Sparkles } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';
import TutorialVideoModal from '../../src/components/shared/TutorialVideoModal';
import { Tutorial } from '../../src/types/tutorial';
import { getTutorials, tutorialTitle, tutorialDescription } from '../../src/services/tutorialService';
import { resolveLocale } from '@/src/utils/locale';

// The four canonical sections — category is a free-text field an admin
// types into /admin/tutorials, so these keys have to be the EXACT strings
// admins are expected to use for a tutorial to land in the right section
// (see admin/tutorials.tsx's own placeholder text, which now suggests
// these). Anything published under a category that doesn't match one of
// these four falls into the "სხვა/Other" catch-all at the end rather than
// silently disappearing.
interface CategorySection {
  key: string;
  icon: typeof GraduationCap;
  label: { ka: string; en: string };
  hint: { ka: string; en: string };
}

const SECTIONS: CategorySection[] = [
  {
    key: 'მენტორობა',
    icon: GraduationCap,
    label: { ka: 'მენტორობა', en: 'Mentorship' },
    hint: {
      ka: 'როგორ დავჯავშნოთ სესია და ვისარგებლოთ კონსულტაციით',
      en: 'How to book a session and get the most out of a consultation',
    },
  },
  {
    key: 'ფრილანსი და ვაკანსიები',
    icon: Briefcase,
    label: { ka: 'ფრილანსი და ვაკანსიები', en: 'Freelance & Jobs' },
    hint: {
      ka: 'როგორ გამოვაქვეყნოთ შეკვეთა / აიღოთ პროექტი',
      en: 'How to post a job / take on a project',
    },
  },
  {
    key: 'AI ინსტრუმენტები',
    icon: Bot,
    label: { ka: 'AI ინსტრუმენტები', en: 'AI Tools' },
    hint: {
      ka: 'როგორ გამოვიყენოთ ციფრული ასისტენტები',
      en: 'How to use the digital assistants',
    },
  },
  {
    key: 'გადახდები და ბილინგი',
    icon: CreditCard,
    label: { ka: 'გადახდები და ბილინგი', en: 'Payments & Billing' },
    hint: {
      ka: 'ბარათის მიბმა, IBAN და თანხის გატანა',
      en: 'Attaching a card, IBAN, and withdrawing funds',
    },
  },
];

const OTHER_KEY = '__other__';

const EN_STRINGS = {
  title: 'Video Tutorials',
  subtitle: 'Short how-to videos for getting the most out of the CDC platform.',
  loading: 'Loading…',
  searchPlaceholder: 'Search tutorials…',
  noResults: 'No tutorials match your search.',
  comingSoon: 'Videos for this section are coming soon.',
  watch: 'Watch',
  otherLabel: 'Other',
  openExternally: "This video can't be embedded — open it in a new tab instead.",
  openInNewTab: 'Open video',
};

const dict = {
  ka: {
    title: 'ვიდეო ტუტორიალები',
    subtitle: 'მოკლე ვიდეო ინსტრუქციები CDC პლატფორმის გამოსაყენებლად.',
    loading: 'იტვირთება…',
    searchPlaceholder: 'ტუტორიალების ძებნა…',
    noResults: 'თქვენი ძიების შესაბამისი ტუტორიალი ვერ მოიძებნა.',
    comingSoon: 'ამ განყოფილების ვიდეოები მალე დაემატება.',
    watch: 'ყურება',
    otherLabel: 'სხვა',
    openExternally: 'ეს ვიდეო ვერ ჩაშენდება — გახსენით ახალ ტაბში.',
    openInNewTab: 'ვიდეოს გახსნა',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function TutorialCard({
  tutorial,
  contentLang,
  watchLabel,
  onSelect,
}: {
  tutorial: Tutorial;
  contentLang: 'ka' | 'en';
  watchLabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] cursor-pointer"
    >
      <div className="w-full h-36 bg-slate-800/80 flex items-center justify-center">
        <PlayCircle size={36} className="text-cyan-400" />
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-base font-black mb-1.5 text-white line-clamp-2 break-words">{tutorialTitle(tutorial, contentLang)}</h3>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3 flex-1">{tutorialDescription(tutorial, contentLang)}</p>
        <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
          <PlayCircle size={13} /> {watchLabel}
        </span>
      </div>
    </button>
  );
}

export default function TutorialsIndexPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  // Tutorials only store ka/en text (title/titleEn etc.) — collapse for content lookups.
  const contentLang = lang === 'ka' ? 'ka' : 'en';
  const labelLang = lang === 'ka' ? 'ka' : 'en';

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([...SECTIONS.map((s) => s.key), OTHER_KEY]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTutorials();
      // The list endpoint is public and unfiltered (admins reuse it to see
      // drafts in the editor) — filter to published-only for this reader page.
      setTutorials(data.filter((tut) => !!tut.publishedAt));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = searchQuery.trim().toLowerCase();
  const matches = useCallback(
    (tut: Tutorial) => {
      if (!query) return true;
      const haystack = `${tutorialTitle(tut, contentLang)} ${tutorialDescription(tut, contentLang)}`.toLowerCase();
      return haystack.includes(query);
    },
    [query, contentLang]
  );

  const sectionsWithContent = useMemo(() => {
    const sectionKeys = new Set(SECTIONS.map((s) => s.key));
    return [
      ...SECTIONS.map((section) => ({
        section,
        tutorials: tutorials.filter((tut) => tut.category === section.key && matches(tut)),
      })),
      {
        section: {
          key: OTHER_KEY,
          icon: Sparkles,
          label: { ka: t.otherLabel, en: t.otherLabel },
          hint: { ka: '', en: '' },
        } as CategorySection,
        tutorials: tutorials.filter((tut) => !sectionKeys.has(tut.category) && matches(tut)),
      },
    ];
  }, [tutorials, matches, t.otherLabel]);

  const toggleSection = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasAnyResults = sectionsWithContent.some(({ tutorials: list }) => list.length > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <SiteHeader />
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="text-slate-400 hover:text-slate-100" />
        </div>
        <h1 className="text-3xl font-black mb-2">{t.title}</h1>
        <p className="text-slate-400 mb-10">{t.subtitle}</p>

        <div className="relative mb-10 max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-slate-800 bg-slate-900/60 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">{t.loading}</p>
        ) : query && !hasAnyResults ? (
          <p className="text-slate-400 text-sm">{t.noResults}</p>
        ) : (
          <div className="space-y-4">
            {sectionsWithContent
              .filter(({ section, tutorials: list }) => section.key !== OTHER_KEY || list.length > 0)
              .map(({ section, tutorials: list }) => {
                const isOpen = expanded.has(section.key);
                const Icon = section.icon;
                return (
                  <div
                    key={section.key}
                    className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-transparent border-none cursor-pointer hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                          <Icon size={18} className="text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-base font-black text-white">{section.label[labelLang]}</h2>
                          {section.hint[labelLang] && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{section.hint[labelLang]}</p>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 pt-1">
                        {list.length === 0 ? (
                          <p className="text-xs text-slate-500">{t.comingSoon}</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {list.map((tut) => (
                              <TutorialCard
                                key={tut.id}
                                tutorial={tut}
                                contentLang={contentLang}
                                watchLabel={t.watch}
                                onSelect={() => setActiveTutorial(tut)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {activeTutorial && (
        <TutorialVideoModal
          tutorial={activeTutorial}
          title={tutorialTitle(activeTutorial, contentLang)}
          openExternallyLabel={t.openExternally}
          openInNewTabLabel={t.openInNewTab}
          onClose={() => setActiveTutorial(null)}
        />
      )}
    </div>
  );
}
