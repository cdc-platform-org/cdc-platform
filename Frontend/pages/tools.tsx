import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Bot, MessageSquareText, BookOpen, Code2, BarChart3, ShieldCheck, ShieldAlert, Users, Sparkles, Lock, Building2, X, Download, EyeOff } from 'lucide-react';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import BackButton from '../src/components/common/BackButton';
import { useAuth } from '../src/context/AuthContext';
import { useAuthModal } from '../src/context/AuthModalContext';

const dict = {
  ka: {
    title: 'ციფრული ხელსაწყოები',
    subtitle: 'AI-ზე დაფუძნებული პროდუქტები, რომლებიც CDC-მ შექმნა ბიზნესებისა და დამსაქმებლებისთვის.',
    // Card 1 — Enterprise AI Assistant
    aiTitle: 'Enterprise AI ასისტენტი & ცოდნის ბაზა',
    aiDesc:
      'შექმენით საკუთარი AI ჩატბოტი თქვენი კომპანიისთვის — ის სწავლობს თქვენს ბიზნესზე და პასუხობს ვიზიტორებს თქვენი საიტიდან პირდაპირ.',
    aiBullet1: 'პერსონალიზებული AI ჩატბოტი თქვენი საიტისთვის',
    aiBullet2: 'საკუთარი ცოდნის ბაზა კითხვა-პასუხის ფორმატში',
    aiBullet3: 'ჩასაშენებელი ვიჯეტი — ერთი კოდი და მზადაა',
    aiBullet4: 'ვიზიტორთა საუბრების ანალიტიკა',
    aiCta: '7 დღე უფასოდ',
    aiAvailable: 'ხელმისაწვდომია',
    // Card 2 — Proctored Exam
    examTitle: 'AI Proctored Exam & Skill Assessment System',
    examDesc: 'AI-ზე დაფუძნებული ონლაინ გამოცდები რეალურ დროში მონიტორინგით და კანდიდატების უნარების ავტომატური შეფასებით.',
    // Card 3 — Candidate Screener
    screenerTitle: 'AI Candidate Screener & HR Assistant',
    screenerDesc: 'AI ასისტენტი, რომელიც დამსაქმებლებს ეხმარება კანდიდატების პირველად გადარჩევასა და HR პროცესების ავტომატიზაციაში.',
    // Card 4 — Cyber Sentinel AI
    sentinelTitle: 'CDC Cyber Sentinel AI & Threat Protection',
    sentinelDesc:
      'ავტონომიური AI კიბერ-უსაფრთხოების აგენტი თქვენი კომპიუტერისთვის. ამოიცნობს ჰაკერულ ქმედებებს პრევენციულად, ატარებს ავტომატურ სკანირებას და გიმზადებთ ყოველდღიურ AI ანგარიშს.',
    sentinelBullet1: 'ჩამოსატვირთი Desktop აგენტი (Windows & Mac)',
    sentinelBullet2: 'პროაქტიული ჰაკერული შეტევების ბლოკირება & AI ქცევითი ანალიზი',
    sentinelBullet3: 'ყოველდღიური AI ანგარიში და საფრთხეების მართვა',
    sentinelBullet4: 'პერსონალური მონაცემების გაჟონვისგან დაცვა',
    comingSoon: 'მალე',
    storeCta: 'ციფრული პროდუქტების მაღაზია',
    storeCtaDesc: 'UI Kits, AI Prompts, შაბლონები და ელექტრონული წიგნები.',
    storeCtaButton: 'მაღაზიის ნახვა',
    // Business-only gate modals for the AI Assistant trial CTA
    studentBlockedTitle: 'ხელმისაწვდომია მხოლოდ ბიზნეს ანგარიშებისთვის',
    studentBlockedDesc: 'ეს ინსტრუმენტები განკუთვნილია მხოლოდ ბიზნეს ანგარიშებისთვის. სტუდენტის/ფრილანსერის ანგარიშით მათი გამოყენება შეუძლებელია.',
    studentBlockedCta: 'გაიგეთ მეტი ბიზნეს ანგარიშის შესახებ',
    verificationRequiredTitle: 'საჭიროა ბიზნესის ვერიფიკაცია',
    verificationRequiredDesc: 'AI ხელსაწყოების გამოსაყენებლად საჭიროა თქვენი ბიზნეს ანგარიშის ვერიფიკაცია. გაიარეთ ვერიფიკაცია პირად კაბინეტში და სცადეთ ხელახლა.',
    verificationRequiredCta: 'ვერიფიკაციის გავლა',
    modalClose: 'დახურვა',
  },
  en: {
    title: 'Digital AI Tools',
    subtitle: 'AI-powered products built by CDC for businesses and employers.',
    aiTitle: 'Enterprise AI Assistant & Knowledge Base',
    aiDesc:
      'Build your own AI chatbot for your company — it learns your business and answers visitors directly from your website.',
    aiBullet1: 'A custom AI chatbot for your website',
    aiBullet2: 'Your own Q&A-style knowledge base',
    aiBullet3: 'An embeddable widget — one snippet and it is live',
    aiBullet4: 'Visitor conversation analytics',
    aiCta: '7 Days Free',
    aiAvailable: 'Available now',
    examTitle: 'AI Proctored Exam & Skill Assessment System',
    examDesc: 'AI-powered online exams with real-time proctoring and automated candidate skill assessment.',
    screenerTitle: 'AI Candidate Screener & HR Assistant',
    screenerDesc: 'An AI assistant that helps employers pre-screen candidates and automate HR workflows.',
    sentinelTitle: 'CDC Cyber Sentinel AI & Threat Protection',
    sentinelDesc:
      'An autonomous AI cybersecurity agent for your computer. Detects hacking activity preventively, runs automatic scans, and prepares a daily AI report.',
    sentinelBullet1: 'Downloadable Desktop agent (Windows & Mac)',
    sentinelBullet2: 'Proactive hacking-attempt blocking & AI behavioral analysis',
    sentinelBullet3: 'Daily AI report and threat management',
    sentinelBullet4: 'Protection against personal data leaks',
    comingSoon: 'Coming Soon',
    storeCta: 'Digital Product Store',
    storeCtaDesc: 'UI Kits, AI Prompts, templates, and e-books.',
    storeCtaButton: 'Browse Store',
    studentBlockedTitle: 'Available for Business Accounts Only',
    studentBlockedDesc: 'These tools are exclusively available for Business accounts. They cannot be used with a Student/Freelancer account.',
    studentBlockedCta: 'Learn more about Business accounts',
    verificationRequiredTitle: 'Business Verification Required',
    verificationRequiredDesc: 'Using the AI tools requires your Business account to be verified. Complete verification in your dashboard and try again.',
    verificationRequiredCta: 'Complete verification',
    modalClose: 'Close',
  },
};

export default function ToolsPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { isAuthenticated, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [infoModal, setInfoModal] = useState<'studentBlocked' | 'verificationRequired' | null>(null);

  // Enterprise AI tools are Business-only, and only for a *verified* Business
  // account — SuperAdmin (internal staff) bypasses the verification check.
  const canUseAiAssistant =
    isAuthenticated && (user?.role === 'SuperAdmin' || (user?.role === 'Client' && user.isVerified));

  const handleAiCtaClick = () => {
    if (canUseAiAssistant) return;
    if (!isAuthenticated) {
      openAuthModal({ mode: 'register', initialRole: 'Client' });
      return;
    }
    if (user?.role !== 'Client') {
      setInfoModal('studentBlocked');
      return;
    }
    setInfoModal('verificationRequired');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            CDC AI
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-wide mb-3">{t.title}</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Enterprise AI Assistant — real, available product */}
          <div className="lg:col-span-3 rounded-3xl border border-cyan-500/30 bg-white dark:bg-slate-900/60 bg-gradient-to-br from-cyan-500/5 to-purple-600/5 p-8 flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-xl font-black tracking-wide">{t.aiTitle}</h2>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {t.aiAvailable}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.aiDesc}</p>
              <ul className="grid sm:grid-cols-2 gap-3 mb-6">
                {[
                  { icon: MessageSquareText, label: t.aiBullet1 },
                  { icon: BookOpen, label: t.aiBullet2 },
                  { icon: Code2, label: t.aiBullet3 },
                  { icon: BarChart3, label: t.aiBullet4 },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>

              {canUseAiAssistant ? (
                <Link
                  href="/dashboard/ai-tools"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  {t.aiCta}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleAiCtaClick}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  {t.aiCta}
                </button>
              )}
            </div>
          </div>

          {/* Card 2: AI Proctored Exam — coming soon */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-7 flex flex-col opacity-90">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Lock className="w-3 h-3" />
                {t.comingSoon}
              </span>
            </div>
            <h3 className="text-base font-black tracking-wide mb-2">{t.examTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.examDesc}</p>
          </div>

          {/* Card 3: AI Candidate Screener — coming soon */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-7 flex flex-col opacity-90">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Lock className="w-3 h-3" />
                {t.comingSoon}
              </span>
            </div>
            <h3 className="text-base font-black tracking-wide mb-2">{t.screenerTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.screenerDesc}</p>
          </div>

          {/* Card 4: Cyber Sentinel AI — coming soon, no desktop agent built
              yet (see Backend's CyberSentinelDevice model — schema
              placeholder only, no routes/UI wired to it). Bulleted like
              Card 1 since there's more to say than Cards 2/3's one-liner,
              but coming-soon-styled (muted icon, amber lock badge, no CTA)
              since nothing here is actually usable yet. */}
          <div className="lg:col-span-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 flex flex-col lg:flex-row gap-8 items-start">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-xl font-black tracking-wide">{t.sentinelTitle}</h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Lock className="w-3 h-3" />
                  {t.comingSoon}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.sentinelDesc}</p>
              <ul className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: Download, label: t.sentinelBullet1 },
                  { icon: ShieldAlert, label: t.sentinelBullet2 },
                  { icon: BarChart3, label: t.sentinelBullet3 },
                  { icon: EyeOff, label: t.sentinelBullet4 },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Store — downloadable products (UI kits, prompts, templates), a
              separate concept from CDC's own SaaS products above. */}
          <Link
            href="/marketplace"
            className="lg:col-span-3 rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 p-7 flex items-center justify-between gap-4 no-underline text-current hover:border-purple-400 transition-colors"
          >
            <div>
              <h3 className="text-base font-black tracking-wide mb-1">{t.storeCta}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.storeCtaDesc}</p>
            </div>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">{t.storeCtaButton} →</span>
          </Link>
        </div>
      </div>

      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />

      {infoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setInfoModal(null)}>
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              aria-label={t.modalClose}
              className="absolute top-4 right-4 p-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>

            {infoModal === 'studentBlocked' ? (
              <>
                <h3 className="text-base font-black tracking-wide mb-2">{t.studentBlockedTitle}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.studentBlockedDesc}</p>
                <Link
                  href="/contact"
                  onClick={() => setInfoModal(null)}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  {t.studentBlockedCta}
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-base font-black tracking-wide mb-2">{t.verificationRequiredTitle}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.verificationRequiredDesc}</p>
                <Link
                  href="/dashboard/client"
                  onClick={() => setInfoModal(null)}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  {t.verificationRequiredCta}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
