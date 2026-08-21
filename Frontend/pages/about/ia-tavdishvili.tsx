import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Mail,
  Phone,
  ExternalLink,
  Sparkles,
  Palette,
  Code2,
  Megaphone,
  Award,
  GraduationCap,
  Briefcase,
  ArrowRight,
  Globe,
} from 'lucide-react';
import SiteHeader from '@/src/components/layout/SiteHeader';
import SiteFooter from '@/src/components/layout/SiteFooter';
import { resolveLocale } from '@/src/utils/locale';

// Local ka/en/ru content toggle — deliberately NOT a next-i18next namespace.
// The site's real router locales are ka/en/de/es/fr/uk (next-i18next.config.js);
// "ru" isn't one of them, and adding a 7th site-wide locale for one page would
// be wildly disproportionate. This page instead resolves ka/en from the
// router (via resolveLocale) as its default and offers ru only through the
// explicit toggle below.
type PageLang = 'ka' | 'en' | 'ru';

const BEHANCE_URL = 'https://www.behance.net/ta-beba-';
const CONTACT_EMAIL = 'iakodigital@gmail.com';
const CONTACT_PHONE = '+995 598 484 912';
const CONTACT_PHONE_TEL = '+995598484912';

const CONTENT: Record<
  PageLang,
  {
    langLabel: string;
    name: string;
    title: string;
    badges: string[];
    contactEmail: string;
    contactCall: string;
    contactBehance: string;
    bioHeading: string;
    bio: string[];
    skillsHeading: string;
    skillGroups: { icon: typeof Sparkles; label: string; items: string[] }[];
    experienceHeading: string;
    experience: { role: string; org: string; period: string; description: string }[];
    certsHeading: string;
    certs: { title: string; place: string }[];
    ctaHeading: string;
    ctaBody: string;
    bookMentorship: string;
    viewPortfolio: string;
  }
> = {
  ka: {
    langLabel: 'ქართული',
    name: 'ია თავდიშვილი',
    title: 'AI ხელსაწყოები, Vibe Coding, ციფრული მარკეტინგი და ტექ-განათლების ლიდერი',
    badges: ['თანადამფუძნებელი და დირექტორი @ CDC', 'GITA-ს ტრენერი', 'UN Women / Erasmus+ გამოსაბუთებული'],
    contactEmail: 'ელფოსტა',
    contactCall: 'დარეკვა',
    contactBehance: 'Behance',
    bioHeading: 'ბიოგრაფია და გამოცდილება',
    bio: [
      '6+ წელზე მეტია ვმუშაობ ციფრული პროფესიების ტრენერად — ვასწავლი Prompt Engineering-ს, Vibe Coding-სა და Meta Ads-ს ასობით სტუდენტს საქართველოში.',
      'ვთანადავაფუძნე CDC პლატფორმა, რათა გურიისა და მთელი საქართველოს ახალგაზრდებს მივცე რეალური წვდომა თანამედროვე AI ხელსაწყოებზე, დიზაინსა და ციფრულ მარკეტინგზე დაფუძნებულ კარიერულ გზებზე.',
    ],
    skillsHeading: 'ძირითადი უნარები',
    skillGroups: [
      { icon: Sparkles, label: 'AI ხელსაწყოები', items: ['ChatGPT', 'Midjourney', 'Claude', 'Gemini', 'CapCut AI'] },
      { icon: Palette, label: 'დიზაინი და ანიმაცია', items: ['Adobe Character Animator', 'After Effects', 'Photoshop', 'Illustrator'] },
      { icon: Code2, label: 'Frontend დეველოპმენტი', items: ['HTML', 'CSS', 'JavaScript'] },
      { icon: Megaphone, label: 'SMM და Meta Ads', items: ['SMM სტრატეგია', 'Meta Ads კამპანიები'] },
    ],
    experienceHeading: 'გამოცდილება',
    experience: [
      {
        role: 'თანადამფუძნებელი და მთავარი ტრენერი',
        org: 'CDC Platform',
        period: 'მიმდინარე',
        description: 'ვხელმძღვანელობ ციფრული უნარების პროგრამებს — AI, Vibe Coding და დიგიტალური მარკეტინგი.',
      },
      {
        role: 'ვიდეო მონტაჟისა და ანიმაციის ტენდერის გამარჯვებული',
        org: 'GITA',
        period: '2025',
        description: 'გამოვიმარჯვე საქართველოს ინოვაციების და ტექნოლოგიების სააგენტოს ტენდერში ვიდეო მონტაჟისა და ანიმაციის მიმართულებით.',
      },
      {
        role: 'ტრენერი',
        org: 'Women Techmakers / UN Women',
        period: '',
        description: 'ვატარებ ტრენინგებს ქალთა გაძლიერების პროგრამების ფარგლებში ტექნოლოგიურ და ციფრულ თემებზე.',
      },
      {
        role: 'ლექტორი და ადმინისტრატორი',
        org: 'Educity / Lingwing',
        period: '',
        description: 'ვასწავლი Educity-ში და ვმართავ Lingwing-ის ადმინისტრირებას.',
      },
      {
        role: 'პროფესიული განათლების მიმართულების ხელმძღვანელი (Frontend & AI)',
        org: 'პროფესიული განათლება',
        period: '',
        description: 'ვხელმძღვანელობ Frontend-ისა და AI მიმართულების პროფესიულ საგანმანათლებლო პროგრამებს.',
      },
    ],
    certsHeading: 'საერთაშორისო სერტიფიკატები და განათლება',
    certs: [
      { title: 'Erasmus+ ტრენერთა ტრენინგი (ToT)', place: 'ქიშინიოვი, 2025' },
      { title: 'Erasmus+ ტრენერთა ტრენინგი (ToT)', place: 'ერევანი, 2026' },
      { title: 'eGA Masterclass', place: 'ქუთაისი, 2025' },
      { title: 'Do IT with EU / Exactpro — პროგრამული ტესტირება', place: '' },
      { title: 'BTU / USAID — გრაფიკული დიზაინი', place: '' },
      { title: 'Web Summit', place: 'ლისაბონი' },
    ],
    ctaHeading: 'ითანამშრომლეთ ან დაჯავშნეთ სესია',
    ctaBody: 'გსურთ მენტორული სესია ან გსურთ იხილოთ დიზაინის სამუშაოები?',
    bookMentorship: 'მენტორული სესიის დაჯავშნა',
    viewPortfolio: 'დიზაინის პორტფოლიო (Behance)',
  },
  en: {
    langLabel: 'English',
    name: 'Ia Tavdishvili',
    title: 'AI Tools, Vibe Coding, Digital Marketing & Tech Education Lead',
    badges: ['Co-Founder & Director @ CDC', 'GITA Trainer', 'UN Women / Erasmus+ Alumna'],
    contactEmail: 'Email',
    contactCall: 'Call',
    contactBehance: 'Behance',
    bioHeading: 'Professional Bio & Expertise',
    bio: [
      "For 6+ years I've trained hundreds of students across Georgia in digital skills — Prompt Engineering, Vibe Coding, and Meta Ads.",
      'I co-founded CDC Platform to give young people in Guria and across Georgia real access to modern AI tools, design, and digital-marketing-driven career paths.',
    ],
    skillsHeading: 'Key Skills',
    skillGroups: [
      { icon: Sparkles, label: 'AI Tools', items: ['ChatGPT', 'Midjourney', 'Claude', 'Gemini', 'CapCut AI'] },
      { icon: Palette, label: 'Design & Animation', items: ['Adobe Character Animator', 'After Effects', 'Photoshop', 'Illustrator'] },
      { icon: Code2, label: 'Frontend Development', items: ['HTML', 'CSS', 'JavaScript'] },
      { icon: Megaphone, label: 'SMM & Meta Ads', items: ['SMM Strategy', 'Meta Ads Campaigns'] },
    ],
    experienceHeading: 'Experience',
    experience: [
      {
        role: 'Co-Founder & Lead Trainer',
        org: 'CDC Platform',
        period: 'Ongoing',
        description: 'Leading digital-skills programs across AI, Vibe Coding, and digital marketing.',
      },
      {
        role: 'Video Editing & Animation Tender Winner',
        org: 'GITA',
        period: '2025',
        description: "Won the Georgian Innovation and Technology Agency's tender for video editing and animation.",
      },
      {
        role: 'Trainer',
        org: 'Women Techmakers / UN Women',
        period: '',
        description: "Delivering training on tech and digital topics as part of women's empowerment programs.",
      },
      {
        role: 'Lecturer & Admin',
        org: 'Educity / Lingwing',
        period: '',
        description: 'Teaching at Educity and administering Lingwing.',
      },
      {
        role: 'Lead, Professional Vocational Education (Frontend & AI)',
        org: 'Vocational Education',
        period: '',
        description: 'Leading professional vocational education programs in Frontend and AI.',
      },
    ],
    certsHeading: 'International Certificates & Education',
    certs: [
      { title: 'Erasmus+ Training of Trainers (ToT)', place: 'Chisinau, 2025' },
      { title: 'Erasmus+ Training of Trainers (ToT)', place: 'Yerevan, 2026' },
      { title: 'eGA Masterclass', place: 'Kutaisi, 2025' },
      { title: 'Do IT with EU / Exactpro — Software Testing', place: '' },
      { title: 'BTU / USAID — Graphic Design', place: '' },
      { title: 'Web Summit', place: 'Lisbon' },
    ],
    ctaHeading: 'Collaborate or Book a Session',
    ctaBody: 'Interested in a mentorship session or want to see design work?',
    bookMentorship: 'Book Mentorship Session',
    viewPortfolio: 'View Design Portfolio (Behance)',
  },
  ru: {
    langLabel: 'Русский',
    name: 'Иа Тавдишвили',
    title: 'Ведущий специалист по AI-инструментам, Vibe Coding, цифровому маркетингу и техническому образованию',
    badges: ['Сооснователь и директор @ CDC', 'Тренер GITA', 'Выпускница UN Women / Erasmus+'],
    contactEmail: 'Эл. почта',
    contactCall: 'Позвонить',
    contactBehance: 'Behance',
    bioHeading: 'Биография и экспертиза',
    bio: [
      'Более 6 лет обучаю сотни студентов по всей Грузии цифровым навыкам — Prompt Engineering, Vibe Coding и Meta Ads.',
      'Я стала сооснователем платформы CDC, чтобы дать молодёжи Гурии и всей Грузии реальный доступ к современным AI-инструментам, дизайну и карьере в цифровом маркетинге.',
    ],
    skillsHeading: 'Ключевые навыки',
    skillGroups: [
      { icon: Sparkles, label: 'AI-инструменты', items: ['ChatGPT', 'Midjourney', 'Claude', 'Gemini', 'CapCut AI'] },
      { icon: Palette, label: 'Дизайн и анимация', items: ['Adobe Character Animator', 'After Effects', 'Photoshop', 'Illustrator'] },
      { icon: Code2, label: 'Frontend-разработка', items: ['HTML', 'CSS', 'JavaScript'] },
      { icon: Megaphone, label: 'SMM и Meta Ads', items: ['SMM-стратегия', 'Кампании Meta Ads'] },
    ],
    experienceHeading: 'Опыт работы',
    experience: [
      {
        role: 'Сооснователь и главный тренер',
        org: 'CDC Platform',
        period: 'по настоящее время',
        description: 'Руковожу программами цифровых навыков — AI, Vibe Coding и цифровой маркетинг.',
      },
      {
        role: 'Победитель тендера по видеомонтажу и анимации',
        org: 'GITA',
        period: '2025',
        description: 'Выиграла тендер Грузинского агентства инноваций и технологий по видеомонтажу и анимации.',
      },
      {
        role: 'Тренер',
        org: 'Women Techmakers / UN Women',
        period: '',
        description: 'Провожу тренинги по техническим и цифровым темам в рамках программ поддержки женщин.',
      },
      {
        role: 'Преподаватель и администратор',
        org: 'Educity / Lingwing',
        period: '',
        description: 'Преподаю в Educity и администрирую Lingwing.',
      },
      {
        role: 'Руководитель направления профессионального образования (Frontend & AI)',
        org: 'Профессиональное образование',
        period: '',
        description: 'Руковожу программами профессионального образования по Frontend и AI.',
      },
    ],
    certsHeading: 'Международные сертификаты и образование',
    certs: [
      { title: 'Erasmus+ Training of Trainers (ToT)', place: 'Кишинёв, 2025' },
      { title: 'Erasmus+ Training of Trainers (ToT)', place: 'Ереван, 2026' },
      { title: 'eGA Masterclass', place: 'Кутаиси, 2025' },
      { title: 'Do IT with EU / Exactpro — тестирование ПО', place: '' },
      { title: 'BTU / USAID — графический дизайн', place: '' },
      { title: 'Web Summit', place: 'Лиссабон' },
    ],
    ctaHeading: 'Сотрудничество и запись на сессию',
    ctaBody: 'Хотите записаться на менторскую сессию или посмотреть дизайн-работы?',
    bookMentorship: 'Записаться на менторскую сессию',
    viewPortfolio: 'Портфолио дизайна (Behance)',
  },
};

function initialLangFor(routerLocale: string | undefined): PageLang {
  const resolved = resolveLocale(routerLocale);
  return resolved === 'ka' ? 'ka' : 'en';
}

export default function IaTavdishviliPortfolioPage() {
  const router = useRouter();
  const [lang, setLang] = useState<PageLang>(() => initialLangFor(router.locale));
  const t = CONTENT[lang];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.name} — ${t.title} | CDC`}</title>
        <meta name="description" content={t.bio[0]} />
      </Head>
      <SiteHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex-1 w-full">
        {/* Local ka/en/ru toggle — see CONTENT comment above. */}
        <div className="flex justify-end mb-6">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60">
            <Globe className="w-3.5 h-3.5 text-slate-400 mx-1.5" />
            {(['ka', 'en', 'ru'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  lang === l
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Hero */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-cyan-500/10 via-white to-purple-600/10 dark:from-cyan-500/10 dark:via-slate-900/60 dark:to-purple-600/10 p-6 sm:p-10 mb-12 text-center">
          <div className="w-24 h-24 rounded-full mx-auto mb-5 bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-cyan-500/20">
            {t.name.charAt(0)}
          </div>
          <h1 className="text-2xl sm:text-4xl font-black mb-2">
            {lang === 'ka' ? 'ია თავდიშვილი' : lang === 'en' ? 'Iia Tavdishvili (ია თავდიშვილი)' : 'Иа Тавдишвили'}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-semibold max-w-2xl mx-auto mb-5">{t.title}</p>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {t.badges.map((badge) => (
              <span
                key={badge}
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 no-underline hover:opacity-90 transition-opacity"
            >
              <Mail className="w-3.5 h-3.5" />
              {t.contactEmail}
            </a>
            <a
              href={`tel:${CONTACT_PHONE_TEL}`}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 no-underline hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {t.contactCall}
            </a>
            <a
              href={BEHANCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 no-underline hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t.contactBehance}
            </a>
          </div>
          <p className="text-[11px] text-slate-400 mt-4">{CONTACT_PHONE}</p>
        </div>

        {/* Bio */}
        <section className="mb-14">
          <h2 className="text-xl font-black mb-5">{t.bioHeading}</h2>
          <div className="space-y-4">
            {t.bio.map((p, i) => (
              <p key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section className="mb-14">
          <h2 className="text-xl font-black mb-6">{t.skillsHeading}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {t.skillGroups.map((group) => {
              const Icon = group.icon;
              return (
                <div
                  key={group.label}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-6 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <div className="inline-flex bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-500 dark:text-cyan-400 p-3 rounded-2xl mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-sm mb-3">{group.label}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((item) => (
                      <span
                        key={item}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Experience timeline */}
        <section className="mb-14">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-cyan-500" />
            {t.experienceHeading}
          </h2>
          <div className="space-y-4">
            {t.experience.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                  <h3 className="font-black text-sm">{item.role}</h3>
                  {item.period && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.period}</span>
                  )}
                </div>
                <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-2">{item.org}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Certificates */}
        <section className="mb-14">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-cyan-500" />
            {t.certsHeading}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.certs.map((cert, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-5 flex items-start gap-3"
              >
                <Award className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-black text-xs leading-snug">{cert.title}</p>
                  {cert.place && <p className="text-[11px] text-slate-400 mt-1">{cert.place}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTAs */}
        <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-purple-600/10 p-6 sm:p-8 text-center">
          <h2 className="text-lg font-black mb-2">{t.ctaHeading}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{t.ctaBody}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/mentors"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white no-underline hover:opacity-90 transition-opacity"
            >
              {t.bookMentorship}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href={BEHANCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 no-underline hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t.viewPortfolio}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
