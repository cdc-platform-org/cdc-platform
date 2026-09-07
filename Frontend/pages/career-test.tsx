import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Sparkles, LogIn, UserPlus, RefreshCw, ArrowLeft, Check } from 'lucide-react';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import BackButton from '../src/components/common/BackButton';
import SEOHead from '../src/components/seo/SEOHead';
import { useAuth } from '../src/context/AuthContext';
import { useAuthModal } from '../src/context/AuthModalContext';
import { submitCareerQuiz } from '../src/services/careerQuizService';
import { CareerQuizAudience, CareerQuizGender } from '../src/types/careerQuiz';
import { resolveLocale, contentLocale } from '@/src/utils/locale';

// Below this age the quiz shows KID_QUESTIONS (simplified, jargon-free)
// instead of ADULT_QUESTIONS — re-derived identically server-side
// (Backend's careerQuizService.ts resolveAgeGroup) so the AI prompt's
// tone/vocabulary instructions always match what was actually asked.
const KID_AGE_BOUNDARY = 16;

interface QuizQuestion {
  key: string;
  question: string;
  options: string[];
}

const dict = {
  ka: {
    title: 'AI კარიერული ტესტი',
    subtitle: 'უპასუხეთ რამდენიმე კითხვას და მიიღეთ პერსონალიზებული, AI-ს მიერ გენერირებული კარიერული რეკომენდაცია.',
    metaDescription: 'გაიარე 1-წუთიანი AI კარიერული ტესტი და მიიღე პერსონალიზებული რეკომენდაცია საუკეთესო ციფრული პროფესიისა და კურსის შესარჩევად.',
    gateMessage: 'ტესტის გასავლელად და პერსონალიზებული შედეგების შესანახად გაიარეთ ავტორიზაცია.',
    login: 'შესვლა',
    register: 'რეგისტრაცია',
    stepOfTwo: (n: number) => `ნაბიჯი ${n} / 2`,
    step1Heading: 'საკონტაქტო ინფორმაცია',
    fullName: 'სახელი და გვარი',
    email: 'ელ-ფოსტა',
    phoneSelf: 'ტელეფონის ნომერი',
    phoneChild: 'მშობლის ტელეფონის ნომერი',
    genderLabel: 'სქესი',
    genderMale: 'მამრობითი',
    genderFemale: 'მდედრობითი',
    ageLabel: 'ასაკი (წლები)',
    agePlaceholder: 'მაგ. 14',
    ageHelper: 'მიუთითეთ ასაკი წლებში (არა კლასი).',
    next: 'შემდეგი',
    back: 'უკან',
    requiredStep1: 'გთხოვთ შეავსოთ ყველა ველი.',
    submit: 'შედეგის მიღება',
    submitting: 'ანალიზი…',
    resultHeading: 'თქვენი პერსონალური კარიერული რეპორტი',
    retake: 'ხელახლა გავლა',
    dashboardLink: 'ჩემი დაშბორდი',
    limitReached: (n: number) => `თითოეულ მომხმარებელს შეუძლია ტესტის გავლა დღეში მაქსიმუმ ${n}-ჯერ. სცადეთ ხვალ.`,
    genericError: 'ტესტის შედეგის გენერირება ვერ მოხერხდა. სცადეთ თავიდან.',
    requiredField: 'გთხოვთ უპასუხოთ ყველა კითხვას.',
    loading: 'იტვირთება…',
    kidQuestions: [
      {
        key: 'თავისუფალი დროის საყვარელი საქმე',
        question: 'რა გიყვარს ყველაზე მეტად თავისუფალ დროს?',
        options: ['ხატვა და ციფრული ხელოვნება', 'ვიდეო თამაშების თამაში', 'ახალი რაღაცების აწყობა/შექმნა', 'ისტორიების მოყოლა ან წერა'],
      },
      {
        key: 'თავსატეხთან მიდგომა',
        question: 'როცა რთულ თავსატეხს აწყდები, რას აკეთებ?',
        options: [
          'მარტო ვფიქრობ და ეტაპობრივად ვცდი',
          'მეგობრებთან ერთად ვცდილობთ გადაწყვეტას',
          'ვხატავ ან ვაწყობ რაღაცას, რომ დავინახო',
          'ვიგონებ ამბავს ამის შესახებ',
        ],
      },
      {
        key: 'ყველაზე სახალისო აქტივობა',
        question: 'რომელი აქტივობა ყველაზე სახალისოა შენთვის?',
        options: ['საკუთარი თამაშის ან აპლიკაციის შექმნა', 'ციფრული ხელოვნების დახატვა', 'ვიდეოების ან ანიმაციების გადაღება', 'რობოტების აწყობა ან თავსატეხების ამოხსნა'],
      },
    ] as QuizQuestion[],
    adultQuestions: [
      {
        key: 'სამუშაო გარემოს პრეფერენცია',
        question: 'როგორი სამუშაო გარემო გერჩევა?',
        options: ['ფრილანსი — საკუთარი გრაფიკით, დისტანციურად', 'საოფისე გუნდური მუშაობა სტაბილური განაკვეთით'],
      },
      {
        key: 'სამიზნე შემოსავალი',
        question: 'რა შემოსავალი გინდა მიაღწიო უახლოეს წელში?',
        options: ['500–1000 ₾ / თვეში', '1000–2500 ₾ / თვეში', '2500–5000 ₾ / თვეში', '5000+ ₾ / თვეში'],
      },
      {
        key: 'დროის ხელმისაწვდომობა სწავლისთვის',
        question: 'რამდენი დროის დათმობა შეგიძლია სწავლისთვის?',
        options: ['სრული განაკვეთი (ინტენსიური)', 'ნახევარ განაკვეთი, სამუშაოს პარალელურად', 'მხოლოდ შაბათ-კვირას'],
      },
      {
        key: 'მთავარი კარიერული მიზანი',
        question: 'რა არის შენი მთავარი კარიერული მიზანი?',
        options: ['პირველი სამსახურის შოვნა ტექში', 'კარიერის შეცვლა', 'საკუთარი ბიზნესის/პროექტის დაწყება', 'დამატებითი შემოსავალი გვერდითი საქმით'],
      },
    ] as QuizQuestion[],
  },
  en: {
    title: 'AI Career Test',
    subtitle: 'Answer a few questions and get a personalized, AI-generated career recommendation.',
    metaDescription: "Take CDC's 1-minute AI Career Test and get a personalized recommendation for the best digital profession and course for you.",
    gateMessage: 'Log in to take the test and save your personalized results.',
    login: 'Log In',
    register: 'Register',
    stepOfTwo: (n: number) => `Step ${n} / 2`,
    step1Heading: 'Contact Information',
    fullName: 'Full name',
    email: 'Email',
    phoneSelf: 'Phone number',
    phoneChild: "Parent's phone number",
    genderLabel: 'Gender',
    genderMale: 'Male',
    genderFemale: 'Female',
    ageLabel: 'Age (in years)',
    agePlaceholder: 'e.g. 14',
    ageHelper: 'Enter your age in years (not grade).',
    next: 'Next',
    back: 'Back',
    requiredStep1: 'Please fill in every field.',
    submit: 'Get My Result',
    submitting: 'Analyzing…',
    resultHeading: 'Your Personal Career Report',
    retake: 'Retake the Test',
    dashboardLink: 'My Dashboard',
    limitReached: (n: number) => `Each user can take the test a maximum of ${n} times per day. Please try again tomorrow.`,
    genericError: 'Could not generate your result. Please try again.',
    requiredField: 'Please answer every question.',
    loading: 'Loading…',
    kidQuestions: [
      {
        key: 'Favorite free-time activity',
        question: 'What do you love doing most in your free time?',
        options: ['Drawing / digital art', 'Playing video games', 'Building or making new things', 'Telling or writing stories'],
      },
      {
        key: 'Approach to a tricky puzzle',
        question: 'When you face a tricky puzzle, what do you do?',
        options: [
          'Figure it out alone, step by step',
          'Team up with friends to solve it',
          'Draw or build something to visualize it',
          'Make up a story about it',
        ],
      },
      {
        key: 'Most fun activity',
        question: 'Which activity sounds the most fun to you?',
        options: ['Creating your own game or app', 'Drawing digital art', 'Making videos or animations', 'Building robots or solving puzzles'],
      },
    ] as QuizQuestion[],
    adultQuestions: [
      {
        key: 'Work environment preference',
        question: 'What kind of work environment do you prefer?',
        options: ['Freelancing — own schedule, remote projects', 'Traditional office/team job with a stable schedule'],
      },
      {
        key: 'Target income',
        question: 'What income are you aiming for within the next year?',
        options: ['$150-350 / month', '$350-800 / month', '$800-1500 / month', '$1500+ / month'],
      },
      {
        key: 'Time available for learning',
        question: 'How much time can you commit to learning?',
        options: ['Full-time, intensive', 'Part-time, alongside work', 'Weekends only'],
      },
      {
        key: 'Main career goal',
        question: "What's your main career goal?",
        options: ['Landing a first job in tech', 'Switching careers', 'Starting my own business/project', 'Extra income on the side'],
      },
    ] as QuizQuestion[],
  },
};

type Step = 'demographics' | 'questions' | 'result' | 'limit';

export default function CareerTestPage() {
  const router = useRouter();
  const lang = contentLocale(resolveLocale(router.locale));
  const t = dict[lang];
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { openAuthModal } = useAuthModal();

  const refParam = typeof router.query.ref === 'string' ? router.query.ref : undefined;
  const ageParam = typeof router.query.age === 'string' ? Number(router.query.age) : undefined;

  const [step, setStep] = useState<Step>('demographics');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<CareerQuizGender | ''>('');
  const [age, setAge] = useState<string>(ageParam ? String(ageParam) : '');
  // Multi-select — a question can have more than one option checked, so
  // each question key maps to the list of options picked for it (joined
  // into one free-text string per question right before submitting; see
  // handleSubmit). Was a single string per question (radio-style) before.
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
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

  const ageNum = Number(age);
  const isKid = Number.isFinite(ageNum) && ageNum > 0 && ageNum < KID_AGE_BOUNDARY;
  const questions = isKid ? t.kidQuestions : t.adultQuestions;
  // No more explicit "for myself / for my child" toggle — audience is
  // silently derived from age alone (same boundary as the question-set
  // and phone-label switch below) rather than asked as its own question.
  const audience: CareerQuizAudience = isKid ? 'CHILD' : 'SELF';

  const canSubmitStep1 = useMemo(
    () => !!(fullName.trim() && email.trim() && phone.trim() && gender && age && ageNum > 0),
    [fullName, email, phone, gender, age, ageNum]
  );
  const canSubmitQuiz = useMemo(() => questions.every((q) => (answers[q.key]?.length ?? 0) > 0), [questions, answers]);

  const toggleAnswer = (questionKey: string, option: string) => {
    setAnswers((prev) => {
      const current = prev[questionKey] ?? [];
      const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      return { ...prev, [questionKey]: next };
    });
  };

  const handleNext = () => {
    if (!canSubmitStep1) {
      setError(t.requiredStep1);
      return;
    }
    setError(null);
    setAnswers({});
    setStep('questions');
  };

  const handleSubmit = async () => {
    if (!canSubmitQuiz || !gender) {
      setError(t.requiredField);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Sends each question's full list of selected options — the Backend
      // accepts either a single string or a string[] per question (see
      // careerQuizSchemas.ts) and formats a multi-select question into the
      // AI prompt's Q&A transcript itself, e.g. "მთავარი კარიერული მიზანი:
      // პირველი სამსახურის შოვნა ტექში, კარიერის შეცვლა".
      const submission = await submitCareerQuiz({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        audience,
        gender,
        age: ageNum,
        answers,
        ref: refParam,
        lang,
      });
      setResultText(submission.resultText);
      setStep('result');
    } catch (err: any) {
      if (err?.response?.status === 429 || err?.response?.data?.code === 'DAILY_LIMIT_REACHED') {
        setLimitReached(true);
        setStep('limit');
      } else {
        setError(err?.response?.data?.message ?? t.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setResultText(null);
    setAnswers({});
    setError(null);
    setStep('demographics');
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
        ) : step === 'limit' ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
            <p className="text-sm text-amber-200 leading-relaxed mb-5">{t.limitReached(3)}</p>
            <Link
              href="/dashboard/career-quiz"
              className="inline-block text-xs font-bold text-white bg-slate-900 px-4 py-2.5 rounded-xl no-underline"
            >
              {t.dashboardLink}
            </Link>
          </div>
        ) : step === 'result' && resultText ? (
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
          <div className="space-y-6">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-400">{t.stepOfTwo(step === 'demographics' ? 1 : 2)}</p>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-300">{error}</div>
            )}

            {step === 'demographics' ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">{t.step1Heading}</h2>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.genderLabel}</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setGender('MALE')} className={choiceButtonClass(gender === 'MALE')}>
                      {t.genderMale}
                    </button>
                    <button type="button" onClick={() => setGender('FEMALE')} className={choiceButtonClass(gender === 'FEMALE')}>
                      {t.genderFemale}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{t.ageLabel}</label>
                  <input
                    type="number"
                    min={4}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder={t.agePlaceholder}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">{t.ageHelper}</p>
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
                    {isKid ? t.phoneChild : t.phoneSelf}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+995 5XX XX XX XX"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3.5 text-sm font-bold text-white hover:opacity-90"
                >
                  {t.next}
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                <button
                  type="button"
                  onClick={() => setStep('demographics')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 bg-transparent border-none cursor-pointer p-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.back}
                </button>

                {/* Multi-select — a question can have more than one option
                    checked (see toggleAnswer/canSubmitQuiz above), so each
                    option renders as a checkbox rather than a single-pick
                    radio button. */}
                {questions.map((q) => (
                  <div key={q.key} className="space-y-3">
                    <h2 className="text-sm font-bold text-slate-200">{q.question}</h2>
                    {q.options.map((opt) => {
                      const checked = answers[q.key]?.includes(opt) ?? false;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleAnswer(q.key, opt)}
                          aria-pressed={checked}
                          className={`${choiceButtonClass(checked)} flex items-center gap-3`}
                        >
                          <span
                            className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                              checked ? 'border-cyan-400 bg-cyan-500/20' : 'border-slate-600'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3 text-cyan-300" />}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-90"
                >
                  {/* Results now come from an instant local engine (no more
                      AI wait), but a bare label-swap on a sub-100ms request
                      reads as broken ("did my click even register?"). This
                      fills smoothly over ~1s regardless of how fast the
                      request actually resolves, then the button's own
                      submitting->false transition (handleSubmit's finally)
                      ends it — see the `submit-progress` keyframe below. */}
                  {submitting && (
                    <span
                      className="absolute inset-y-0 left-0 bg-white/25"
                      style={{ animation: 'submit-progress 1s ease-out forwards' }}
                    />
                  )}
                  <span className="relative">{submitting ? t.submitting : t.submit}</span>
                  <style jsx>{`
                    @keyframes submit-progress {
                      from {
                        width: 0%;
                      }
                      to {
                        width: 100%;
                      }
                    }
                  `}</style>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
