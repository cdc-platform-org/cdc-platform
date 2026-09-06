import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Sparkles, LogIn, UserPlus, RefreshCw } from 'lucide-react';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import BackButton from '../src/components/common/BackButton';
import SEOHead from '../src/components/seo/SEOHead';
import { useAuth } from '../src/context/AuthContext';
import { useAuthModal } from '../src/context/AuthModalContext';
import { submitCareerQuiz } from '../src/services/careerQuizService';
import { CareerQuizAudience } from '../src/types/careerQuiz';
import { resolveLocale, contentLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    title: 'AI კარიერული ტესტი',
    subtitle: 'უპასუხეთ 3 კითხვას და მიიღეთ პერსონალიზებული, AI-ს მიერ გენერირებული კარიერული რეკომენდაცია.',
    metaDescription: 'გაიარეთ CDC-ის AI კარიერული ტესტი და მიიღეთ პერსონალიზებული რეკომენდაცია საუკეთესო ციფრული პროფესიისა და კურსის შესარჩევად.',
    gateMessage: 'ტესტის გასავლელად და პერსონალიზებული შედეგების შესანახად გაიარეთ ავტორიზაცია.',
    login: 'შესვლა',
    register: 'რეგისტრაცია',
    contactHeading: 'საკონტაქტო ინფორმაცია',
    fullName: 'სახელი და გვარი',
    email: 'ელ-ფოსტა',
    phoneSelf: 'ტელეფონის ნომერი',
    phoneChild: 'მშობლის ტელეფონის ნომერი',
    audienceLabel: 'ვისთვის გადის ტესტი?',
    audienceSelf: 'ჩემთვის',
    audienceChild: 'ჩემი შვილისთვის',
    childAge: 'შვილის ასაკი',
    q1: 'რომელი მიმართულება გხიბლავთ?',
    q1a: 'შემოქმედებითი და ვიზუალური (დიზაინი, სოც. მედია)',
    q1b: 'ლოგიკური და ტექნიკური (პროგრამირება, ვები, მონაცემები)',
    q2: 'რა დონეზეა თქვენი გამოცდილება?',
    q2a: 'სრული დამწყები',
    q2b: 'თვითნასწავლი / გარკვეული გამოცდილება',
    q2c: 'პროფესიული გამოცდილება უკვე მაქვს',
    q3: 'რა არის თქვენი მთავარი მიზანი?',
    q3a: 'პირველი სამსახურის შოვნა ტექში',
    q3b: 'კარიერის შეცვლა',
    q3c: 'ფრილანსინგი',
    q3d: 'საკუთარი პროექტის/ბიზნესის შექმნა',
    submit: 'შედეგის მიღება',
    submitting: 'გენერირდება…',
    resultHeading: 'თქვენი შედეგი',
    retake: 'ხელახლა გავლა',
    dashboardLink: 'ჩემი დაშბორდი',
    limitReached: (n: number) => `თითოეულ მომხმარებელს შეუძლია ტესტის გავლა დღეში მაქსიმუმ ${n}-ჯერ. სცადეთ ხვალ.`,
    genericError: 'ტესტის შედეგის გენერირება ვერ მოხერხდა. სცადეთ თავიდან.',
    requiredField: 'გთხოვთ შეავსოთ ყველა ველი და უპასუხოთ ყველა კითხვას.',
    loading: 'იტვირთება…',
  },
  en: {
    title: 'AI Career Test',
    subtitle: 'Answer 3 questions and get a personalized, AI-generated career recommendation.',
    metaDescription: "Take CDC's AI Career Test and get a personalized recommendation for the best digital profession and course for you.",
    gateMessage: 'Log in to take the test and save your personalized results.',
    login: 'Log In',
    register: 'Register',
    contactHeading: 'Contact Information',
    fullName: 'Full name',
    email: 'Email',
    phoneSelf: 'Phone number',
    phoneChild: "Parent's phone number",
    audienceLabel: 'Who is this test for?',
    audienceSelf: 'Myself',
    audienceChild: 'My child',
    childAge: "Child's age",
    q1: 'Which direction interests you more?',
    q1a: 'Creative & visual work (design, social media)',
    q1b: 'Logical & technical work (programming, web, data)',
    q2: "What's your experience level?",
    q2a: 'Complete beginner',
    q2b: 'Self-taught / some exposure',
    q2c: 'I already have professional experience',
    q3: 'What is your main goal?',
    q3a: 'Landing a first job in tech',
    q3b: 'Switching careers',
    q3c: 'Freelancing',
    q3d: 'Building my own project/business',
    submit: 'Get My Result',
    submitting: 'Generating…',
    resultHeading: 'Your Result',
    retake: 'Retake the Test',
    dashboardLink: 'My Dashboard',
    limitReached: (n: number) => `Each user can take the test a maximum of ${n} times per day. Please try again tomorrow.`,
    genericError: 'Could not generate your result. Please try again.',
    requiredField: 'Please fill in every field and answer all 3 questions.',
    loading: 'Loading…',
  },
};

export default function CareerTestPage() {
  const router = useRouter();
  const lang = contentLocale(resolveLocale(router.locale));
  const t = dict[lang];
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { openAuthModal } = useAuthModal();

  const ageParam = typeof router.query.age === 'string' ? Number(router.query.age) : undefined;
  const refParam = typeof router.query.ref === 'string' ? router.query.ref : undefined;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [audience, setAudience] = useState<CareerQuizAudience>(ageParam ? 'CHILD' : 'SELF');
  const [childAge, setChildAge] = useState<string>(ageParam ? String(ageParam) : '');
  const [interests, setInterests] = useState('');
  const [experience, setExperience] = useState('');
  const [mainGoal, setMainGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);

  // Pre-fills Full Name/Email/Phone from the account profile the moment
  // it's available — a guest who just authenticated via the gate below
  // lands here with `user` freshly populated, not the stale pre-auth value.
  useEffect(() => {
    if (!user) return;
    setFullName((prev) => prev || user.name);
    setEmail((prev) => prev || user.email);
    setPhone((prev) => prev || user.phone || '');
  }, [user]);

  const openGateModal = (mode: 'login' | 'register') => {
    openAuthModal({
      mode,
      message: t.gateMessage,
      redirectPath: router.asPath,
      onSuccess: () => {
        /* No navigation needed — the page's own auth state flips and the
           form below renders in place once `isAuthenticated` becomes true. */
      },
    });
  };

  const canSubmit = useMemo(
    () => !!(fullName.trim() && email.trim() && phone.trim() && interests && experience && mainGoal),
    [fullName, email, phone, interests, experience, mainGoal]
  );

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(t.requiredField);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const submission = await submitCareerQuiz({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        audience,
        interests,
        experience,
        mainGoal,
        age: audience === 'CHILD' && childAge ? Number(childAge) : undefined,
        ref: refParam,
        lang,
      });
      setResultText(submission.resultText);
    } catch (err: any) {
      if (err?.response?.status === 429 || err?.response?.data?.code === 'DAILY_LIMIT_REACHED') {
        setLimitReached(true);
      } else {
        setError(err?.response?.data?.message ?? t.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setResultText(null);
    setInterests('');
    setExperience('');
    setMainGoal('');
    setError(null);
  };

  const choiceButtonClass = (active: boolean) =>
    `w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition ${
      active
        ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
        : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <SEOHead title={t.title} description={t.metaDescription} canonicalPath="/career-test" />
      <SiteHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <BackButton fallbackHref="/" className="text-slate-400 hover:text-slate-100" />
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <h1 className="text-2xl md:text-3xl font-black mb-2 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-cyan-400" />
          {t.title}
        </h1>
        <p className="text-sm text-slate-400 mb-8">{t.subtitle}</p>

        {authLoading ? (
          <p className="text-sm text-slate-400">{t.loading}</p>
        ) : !isAuthenticated ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-purple-600/10 p-8 text-center">
            <p className="text-sm text-cyan-100 leading-relaxed mb-6">{t.gateMessage}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => openGateModal('login')}
                className="inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-3 rounded-xl border-none cursor-pointer hover:opacity-90"
              >
                <LogIn className="w-4 h-4" />
                {t.login}
              </button>
              <button
                type="button"
                onClick={() => openGateModal('register')}
                className="inline-flex items-center justify-center gap-2 text-sm font-bold text-cyan-300 border border-cyan-500/40 px-5 py-3 rounded-xl bg-transparent cursor-pointer hover:bg-cyan-500/10"
              >
                <UserPlus className="w-4 h-4" />
                {t.register}
              </button>
            </div>
          </div>
        ) : limitReached ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
            <p className="text-sm text-amber-200 leading-relaxed mb-5">{t.limitReached(3)}</p>
            <Link
              href="/dashboard/career-quiz"
              className="inline-block text-xs font-bold text-white bg-slate-900 px-4 py-2.5 rounded-xl no-underline"
            >
              {t.dashboardLink}
            </Link>
          </div>
        ) : resultText ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-lg font-black mb-4 text-cyan-300">{t.resultHeading}</h2>
              <div className="prose prose-invert prose-sm max-w-none prose-a:text-cyan-400">
                <ReactMarkdown>{resultText}</ReactMarkdown>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-200 border border-slate-700 px-5 py-3 rounded-xl bg-transparent cursor-pointer hover:bg-slate-800"
              >
                <RefreshCw className="w-4 h-4" />
                {t.retake}
              </button>
              <Link
                href="/dashboard/career-quiz"
                className="inline-flex items-center justify-center text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-3 rounded-xl no-underline hover:opacity-90"
              >
                {t.dashboardLink}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-300">{error}</div>
            )}

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">{t.contactHeading}</h2>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAudience('SELF')}
                  className={choiceButtonClass(audience === 'SELF')}
                >
                  {t.audienceSelf}
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('CHILD')}
                  className={choiceButtonClass(audience === 'CHILD')}
                >
                  {t.audienceChild}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.fullName}</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  {audience === 'CHILD' ? t.phoneChild : t.phoneSelf}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+995 5XX XX XX XX"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              {audience === 'CHILD' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.childAge}</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-200">{t.q1}</h2>
              <button type="button" onClick={() => setInterests(t.q1a)} className={choiceButtonClass(interests === t.q1a)}>
                {t.q1a}
              </button>
              <button type="button" onClick={() => setInterests(t.q1b)} className={choiceButtonClass(interests === t.q1b)}>
                {t.q1b}
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-200">{t.q2}</h2>
              {[t.q2a, t.q2b, t.q2c].map((opt) => (
                <button key={opt} type="button" onClick={() => setExperience(opt)} className={choiceButtonClass(experience === opt)}>
                  {opt}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-200">{t.q3}</h2>
              {[t.q3a, t.q3b, t.q3c, t.q3d].map((opt) => (
                <button key={opt} type="button" onClick={() => setMainGoal(opt)} className={choiceButtonClass(mainGoal === opt)}>
                  {opt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
