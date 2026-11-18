/**
 * Homepage (/). This file owns data loading, checkout and AI-chat state;
 * every visual section lives in src/components/home/ (HeroSection,
 * CoursesSection, BlogSection, AiChatPanel, ...) and receives what it needs
 * as props. Section order below is the order on the page.
 */
import SiteHeader from '../src/components/layout/SiteHeader';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import type { GetStaticProps } from 'next';
import { useAuthModal } from '../src/context/AuthModalContext';
import { useAuth } from '../src/context/AuthContext';
import SiteFooter from '../src/components/layout/SiteFooter';
import { Course } from '../src/types/lms';
import { LiveTraining } from '../src/types/liveTraining';
import { getLiveTrainings } from '../src/services/liveTrainingService';
import { HomepageContent, GalleryImage } from '../src/types/siteContent';
import { getCourses } from '../src/services/courseService';
import { getBlogPosts } from '../src/services/blogService';
import { BlogPost } from '../src/types/blog';
import SuccessStoriesCarousel from '../src/components/shared/SuccessStoriesCarousel';
import TeamSection from '../src/components/shared/TeamSection';
import FeaturedCaseStudies from '../src/components/shared/FeaturedCaseStudies';
import { checkoutCourse } from '../src/services/paymentService';
import { getSiteContent } from '../src/services/siteContentService';
import { Tutorial } from '../src/types/tutorial';
import { getFeaturedTutorial } from '../src/services/tutorialService';
import SEOHead from '../src/components/seo/SEOHead';
import { ORGANIZATION_SCHEMA, buildSoftwareApplicationSchema, buildWebSiteSchema } from '../src/utils/seo';
import SmartReader from '@/src/components/tools/SmartReader';
import HomeOverlays from '../src/components/home/HomeOverlays';
import SaleCountdownBar from '../src/components/courses/SaleCountdownBar';
import HeroSection from '../src/components/home/HeroSection';
import AboutBentoSection from '../src/components/home/AboutBentoSection';
import GalleryPreviewSection from '../src/components/home/GalleryPreviewSection';
import CareerQuizPromo from '../src/components/home/CareerQuizPromo';
import CoursesSection from '../src/components/home/CoursesSection';
import LiveTrainingsSection from '../src/components/home/LiveTrainingsSection';
import ToolsShowcaseSection from '../src/components/home/ToolsShowcaseSection';
import BlogSection from '../src/components/home/BlogSection';
import FaqSection from '../src/components/home/FaqSection';
import AiChatPanel from '../src/components/home/AiChatPanel';
import SectionHeader from '../src/components/home/SectionHeader';
import { isPublishedCourse } from '../src/utils/courseCatalog';

export default function Home() {
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const { isAuthenticated, user } = useAuth();
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // 📚 რეალური კურსები (ბექენდიდან) — homepage-ის კურსების სექციისთვის
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [liveTrainings, setLiveTrainings] = useState<LiveTraining[]>([]);
  const [liveTrainingsLoading, setLiveTrainingsLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  // Real published blog posts (latest 3) for the homepage's news/blog preview section.
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  // 🖋️ CMS-editable homepage content (hero title/subtitle, stats, FAQ) —
  // falls back to the hardcoded defaults below when no admin has set
  // anything yet, so the page never renders blank.
  const [cms, setCms] = useState<HomepageContent | null>(null);
  const [galleryPreview, setGalleryPreview] = useState<GalleryImage[]>([]);

  const { t } = useTranslation('home');
  // This page predates next-i18next and used to carry its own binary
  // GEO/ENG toggle (kept globally in sync by pushing router.locale
  // alongside it — see git history). Now that UI copy goes through
  // useTranslation('home') above, the only reason to still derive a
  // language value locally is for the handful of things that aren't
  // translated UI strings: CMS/DB content that only has ka/en fields
  // (hero override, stats, FAQ, blog title/description, marketplace
  // category labels) and 3 shared components not yet migrated off their
  // own ka/en-only prop (SuccessStoriesCarousel, FeaturedCaseStudies,
  // TeamSection, SiteFooter, HeaderSearch) — all of those fall back to
  // English content for de/es/fr/uk visitors, same boundary as the rest of
  // this i18n pass. `legacyLang` matches HeaderSearch/SiteFooter's existing
  // 'GEO' | 'ENG' prop type unchanged, so neither needed touching.
  const contentLang: 'ka' | 'en' = router.locale === 'ka' ? 'ka' : 'en';
  const legacyLang: 'GEO' | 'ENG' = contentLang === 'ka' ? 'GEO' : 'ENG';

  const [aiInfoModal, setAiInfoModal] = useState<'studentBlocked' | 'verificationRequired' | null>(null);

  // 🤖 ჩატბოტის ინტერაქტიული სთეითები
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    { sender: 'bot', text: 'გამარჯობა! მე იაკო ვარ, CDC-ის ციფრული ასისტენტი. 🌟 გსურთ გაიაროთ სწრაფი ტესტირება, რომ კურსის სწორად შერჩევაში დაგეხმაროთ?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const chatPanelRef = useRef<HTMLDivElement | null>(null);

  // Escape-to-close and click-outside-to-close for the AI assistant panel —
  // it has a visible ✕ button, but with no other affordance to leave it a
  // slow/errored reply otherwise traps the user on it.
  useEffect(() => {
    if (!isChatOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsChatOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (chatPanelRef.current && !chatPanelRef.current.contains(e.target as Node)) {
        setIsChatOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChatOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('darkMode') === 'true';
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  useEffect(() => {
    if (router.query.assistant === '1') {
      setIsChatOpen(true);
      router.replace('/', undefined, { shallow: true });
    }
  }, [router, router.query.assistant]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Checkout failures (e.g. the payment gateway rejecting the request) used
  // to be swallowed silently here — the button would show "Loading…" then
  // just revert with zero feedback, which looks exactly like "the button
  // isn't reacting" from a user's perspective. courses/index.tsx already
  // surfaces this correctly; this mirrors that pattern.
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Paid course picked from a homepage card — opens the promo-code + pay step first.
  const [checkoutCourseItem, setCheckoutCourseItem] = useState<Course | null>(null);
  const checkoutErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (checkoutErrorTimeoutRef.current) clearTimeout(checkoutErrorTimeoutRef.current);
    };
  }, []);
  useEffect(() => {
    if (router.query.toast === 'account_deleted') {
      const toastLang = router.query.toastLang === 'en' ? 'en' : 'ka';
      setToastMessage(
        toastLang === 'en'
          ? 'Your account has been successfully deleted.'
          : 'თქვენი ანგარიში წარმატებით წაიშალა.'
      );
      router.replace('/', undefined, { shallow: true });
      const timer = setTimeout(() => setToastMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [router, router.query.toast, router.query.toastLang]);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    localStorage.setItem('darkMode', String(nextDark));
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    getCourses()
      .then((data) => setCourses(data.filter(isPublishedCourse)))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoading(false));
  }, []);

  useEffect(() => {
    getLiveTrainings()
      .then((data) => setLiveTrainings(data.filter((tr) => tr.published)))
      .catch(() => setLiveTrainings([]))
      .finally(() => setLiveTrainingsLoading(false));
  }, []);

  useEffect(() => {
    getBlogPosts()
      .then((data) => setBlogPosts(data.filter((p) => p.published).slice(0, 3)))
      .catch(() => setBlogPosts([]));
  }, []);

  // Hero's "▶ გაიგე როგორ მუშაობს პლატფორმა" button — only rendered once an
  // admin has actually marked a tutorial as featured (/admin/tutorials);
  // never a fabricated placeholder video.
  const [promoVideo, setPromoVideo] = useState<Tutorial | null>(null);
  const [showPromoVideo, setShowPromoVideo] = useState(false);
  useEffect(() => {
    getFeaturedTutorial()
      .then(setPromoVideo)
      .catch(() => setPromoVideo(null));
  }, []);

  useEffect(() => {
    getSiteContent<HomepageContent>('homepage')
      .then((row) => setCms(row?.content ?? null))
      .catch(() => setCms(null));
  }, []);

  useEffect(() => {
    getSiteContent<{ images?: GalleryImage[] }>('gallery')
      .then((row) => setGalleryPreview((row?.content.images ?? []).filter((img) => img.url.trim().length > 0).slice(0, 6)))
      .catch(() => setGalleryPreview([]));
  }, []);

  const startCheckout = async (course: Course, promoCode?: string) => {
    setEnrollingId(course.id);
    setCheckoutError(null);
    try {
      const result = await checkoutCourse(course.id, promoCode, contentLang);
      if (result.enrolled) {
        router.push(`/courses/${course.id}/learn`);
        return;
      }
      window.location.href = result.redirectUrl!;
    } catch (err: any) {
      const apiMessage = err?.response?.data?.message;
      setCheckoutError(
        apiMessage || (contentLang === 'en' ? 'Unable to start checkout. Please try again.' : 'გადახდის დაწყება ვერ მოხერხდა. სცადეთ თავიდან.')
      );
      if (checkoutErrorTimeoutRef.current) clearTimeout(checkoutErrorTimeoutRef.current);
      checkoutErrorTimeoutRef.current = setTimeout(() => setCheckoutError(null), 6000);
      setEnrollingId(null);
    }
  };

  // Free courses enroll straight away; paid ones first show the promo-code
  // step so a code can be applied from the homepage too.
  const openCheckout = (course: Course) => {
    if (course.currentPrice > 0) {
      setCheckoutError(null);
      setCheckoutCourseItem(course);
      return;
    }
    startCheckout(course);
  };

  const handleEnroll = (course: Course) => {
    if (!isAuthenticated) {
      openAuthModal({
        message: { ka: 'გთხოვთ გაიაროთ ავტორიზაცია კურსზე ჩასარიცხად', en: 'Please sign in to enroll in a course' },
        onSuccess: () => openCheckout(course),
      });
      return;
    }
    openCheckout(course);
  };

  // CMS/DB content (hero override, stats, FAQ) only ever has ka/en fields,
  // so this stays around purely to pick between them — all static UI copy
  // now goes through t() instead.
  const translate = (geo: React.ReactNode, eng: React.ReactNode) => {
    return contentLang === 'ka' ? geo : eng;
  };

  // Enterprise AI tools are Business-only, and only for a *verified*
  // Business account — SuperAdmin (internal staff) bypasses verification.
  const canUseAiAssistant =
    isAuthenticated && (user?.role === 'SuperAdmin' || (user?.role === 'Client' && user.isVerified));

  const handleAiCtaClick = () => {
    if (canUseAiAssistant) return;
    if (!isAuthenticated) {
      openAuthModal({ mode: 'register', initialRole: 'Client' });
      return;
    }
    if (user?.role !== 'Client') {
      setAiInfoModal('studentBlocked');
      return;
    }
    setAiInfoModal('verificationRequired');
  };

  // Streams one request/response round trip, forwarding each Gemini text
  // delta to `onChunk` as soon as it arrives over SSE (see pages/api/chat.ts)
  // instead of waiting for the full reply to buffer. Resolves once the
  // stream ends cleanly, or throws on a pre-flight JSON error (bad request/
  // not configured — never started streaming) or a mid-stream error frame
  // from the server (every model in the fallback chain failed, or one
  // failed after already streaming some content — see askCdcAssistantStream's
  // own comment for why that specific case can't safely retry itself).
  const requestChatReplyStream = async (
    userText: string,
    history: { role: 'user' | 'model'; text: string }[],
    onChunk: (text: string) => void
  ): Promise<void> => {
    // A stalled stream used to lock the input forever — abort if nothing
    // arrives for 30s (timer re-armed before every read).
    const IDLE_TIMEOUT_MS = 30_000;
    const controller = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
    };

    armIdleTimer();
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, lang: legacyLang, history }),
        signal: controller.signal,
      });
      if (!response.ok) {
        // A pre-flight failure (missing message, GEMINI_API_KEY unset) never
        // switches the response over to SSE at all — it's the same plain
        // JSON body/status this always returned, from before streaming.
        const data = await response.json().catch(() => null);
        throw new Error(data?.reply || 'Request failed');
      }
      if (!response.body) throw new Error('Streaming is not supported by this browser.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // Only an explicit 'done' frame means the reply is complete. A stream
      // that just closes (e.g. the serverless function was killed) is an
      // interrupted reply and must surface as an error, not as a finished
      // half-sentence.
      let sawDone = false;

      while (true) {
        armIdleTimer();
        const { done, value } = await reader.read();
        if (done) {
          if (!sawDone) throw new Error('Stream ended before the reply was complete.');
          return;
        }
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; one fetch chunk can
        // contain zero, one, or several complete frames, so split on that
        // and keep any trailing partial frame in the buffer for next read.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const dataLine = frame.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice('data: '.length));
          if (payload.type === 'chunk' && typeof payload.text === 'string') {
            onChunk(payload.text);
          } else if (payload.type === 'error') {
            throw new Error(payload.reply || 'Request failed');
          } else if (payload.type === 'done') {
            sawDone = true;
          }
        }
      }
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
    }
  };

  const sendChatMessage = async (rawText: string) => {
    const userText = rawText.trim();
    if (!userText || chatSending) return;

    // The widget's opening message (chatMessages[0]) is a hardcoded UI
    // greeting, not a real assistant turn — the Gemini SDK requires chat
    // history to start with a 'user' turn, so it's excluded here.
    const history = chatMessages
      .slice(1)
      .map((m) => ({ role: m.sender === 'user' ? ('user' as const) : ('model' as const), text: m.text }));
    const withUserMessage = [...chatMessages, { sender: 'user' as const, text: userText }];
    // An empty placeholder bot message that streamed chunks append into as
    // they arrive — its presence with still-empty text is also what keeps
    // the typing-dots indicator showing below (see the render condition),
    // so there's no separate "loading" flag to keep in sync with this one:
    // the moment the first chunk lands, the text stops being empty and the
    // dots are naturally replaced by the real, growing reply.
    const placeholderIndex = withUserMessage.length;
    setChatMessages([...withUserMessage, { sender: 'bot' as const, text: '' }]);
    setUserInput('');
    setChatError(null);
    setChatSending(true);

    // Set directly by onChunk below rather than inferred from how/where a
    // later failure happened — the one thing that actually determines
    // whether a silent retry is safe is whether the browser has already
    // rendered real assistant text for this turn, not the shape of the
    // error that eventually surfaced.
    let receivedAnyChunk = false;
    const appendChunk = (text: string) => {
      receivedAnyChunk = true;
      setChatMessages((prev) => {
        const next = [...prev];
        const current = next[placeholderIndex];
        if (!current) return prev;
        next[placeholderIndex] = { ...current, text: current.text + text };
        return next;
      });
    };
    const attempt = () => requestChatReplyStream(userText, history, appendChunk);

    try {
      try {
        await attempt();
      } catch {
        if (receivedAnyChunk) throw new Error('Stream interrupted after partial content.');
        // One silent automatic retry, after a short pause — covers a
        // transient failure reaching THIS specific request (a dropped
        // connection, the serverless function briefly recycling, etc.)
        // before any real content reached the browser. chatSending
        // intentionally stays true across both attempts, so the UI shows
        // one continuous "sending", not a flicker between two separate ones.
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await attempt();
      }
    } catch {
      setChatError(t(receivedAnyChunk ? 'chatReplyInterrupted' : 'chatConnectionError'));
      setLastFailedInput(userText);
      // Drop the placeholder only if it never received any content — a
      // partial reply that broke mid-stream stays visible (the user did
      // get *something*), with the error banner explaining the connection
      // dropped and offering to send the message again as a fresh turn.
      setChatMessages((prev) => {
        const current = prev[placeholderIndex];
        return current && current.text === '' ? prev.filter((_, i) => i !== placeholderIndex) : prev;
      });
    } finally {
      setChatSending(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage(userInput);
  };

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 learning-surface min-h-screen font-sans antialiased transition-colors duration-300 relative text-cdc-ink bg-cdc-bg">
      <SEOHead
        title="ციფრული პროფესიების ცენტრი (CDC) - საუკეთესო პროფესიები საქართველოში"
        description="ციფრული პროფესიების ცენტრი (CDC) გთავაზობთ ტოპ 10 პროფესიას საქართველოში, მათ შორის მაღალანაზღაურებადი პროფესიები, AI ტესტების გენერატორი და მასწავლებლის ასისტენტი."
        canonicalPath="/"
        jsonLd={[
          ORGANIZATION_SCHEMA,
          buildWebSiteSchema(),
          buildSoftwareApplicationSchema({
            type: 'EducationalApplication',
            name: t('imiakoCardTitle'),
            description: t('imiakoFeature1'),
            path: '/dashboard/english-tutor',
            applicationCategory: 'EducationalApplication',
          }),
        ]}
      />

      <HomeOverlays aiInfoModal={aiInfoModal} setAiInfoModal={setAiInfoModal} darkMode={darkMode} t={t} toastMessage={toastMessage} checkoutCourseItem={checkoutCourseItem} contentLang={contentLang} enrollingId={enrollingId} checkoutError={checkoutError} startCheckout={startCheckout} setCheckoutCourseItem={setCheckoutCourseItem} setCheckoutError={setCheckoutError} showPromoVideo={showPromoVideo} promoVideo={promoVideo} setShowPromoVideo={setShowPromoVideo} />

      {/* 🧭 NAVIGATION — the shared site header (same menu on every page). */}
      <SiteHeader darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      <SaleCountdownBar courses={courses} lang={contentLang} />

      <HeroSection courses={courses} coursesLoading={coursesLoading} t={t} cms={cms} translate={translate} promoVideo={promoVideo} setShowPromoVideo={setShowPromoVideo} />

      <AboutBentoSection t={t} darkMode={darkMode} cms={cms} translate={translate} />

      <GalleryPreviewSection galleryPreview={galleryPreview} t={t} darkMode={darkMode} />

      <CareerQuizPromo t={t} darkMode={darkMode} />

      <CoursesSection t={t} darkMode={darkMode} coursesLoading={coursesLoading} courses={courses} contentLang={contentLang} handleEnroll={handleEnroll} enrollingId={enrollingId} />

      <LiveTrainingsSection liveTrainingsLoading={liveTrainingsLoading} liveTrainings={liveTrainings} t={t} darkMode={darkMode} contentLang={contentLang} />

      <ToolsShowcaseSection darkMode={darkMode} t={t} canUseAiAssistant={canUseAiAssistant} handleAiCtaClick={handleAiCtaClick} />

      <BlogSection darkMode={darkMode} t={t} blogPosts={blogPosts} contentLang={contentLang} />

      <SuccessStoriesCarousel lang={contentLang} darkMode={darkMode} />

      <FeaturedCaseStudies lang={contentLang} darkMode={darkMode} />

      {/* 👥 OFFICIAL TEAM SECTION — real, admin-managed data from GET /api/team */}
      <TeamSection lang={contentLang} darkMode={darkMode} />
      <section id="ai-tools" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="AI English Learning Tools" />
          <div className="vip-card p-4 sm:p-8">
            <SmartReader />
          </div>
        </div>
      </section>

      <FaqSection cms={cms} darkMode={darkMode} t={t} translate={translate} />

      <AiChatPanel isChatOpen={isChatOpen} chatPanelRef={chatPanelRef} t={t} setIsChatOpen={setIsChatOpen} chatMessages={chatMessages} chatSending={chatSending} chatError={chatError} lastFailedInput={lastFailedInput} sendChatMessage={sendChatMessage} handleSendMessage={handleSendMessage} userInput={userInput} setUserInput={setUserInput} />

      <SiteFooter />
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['home', 'courses'])) },
});
