import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { useAuth } from '../../src/context/AuthContext';
import { resolveLocale } from '@/src/utils/locale';
import { submitMentorApplication, getMyMentorApplications } from '../../src/services/mentorApplicationService';
import { MentorApplication } from '../../src/types/instructor';

// Lightweight local bilingual dict (not a next-i18next namespace) — this
// page is new and scoped small on purpose; see the session note on holding
// off further full-locale JSON namespace work for now.
const dict = {
  ka: {
    title: 'გახდი მენტორი',
    subtitle: 'გააზიარე შენი გამოცდილება — გახდი CDC-ის ვერიფიცირებული მენტორი და შექმენი საკუთარი კურსები Instructor Studio-ში.',
    alreadyMentor: 'თქვენ უკვე ხართ მენტორი.',
    goToStudio: 'გადადი Instructor Studio-ზე →',
    pendingNotice: 'თქვენი განაცხადი განხილვის პროცესშია.',
    rejectedNotice: 'თქვენი წინა განაცხადი უარყოფილია:',
    reapply: 'ხელახლა განაცხადის შევსება',
    background: 'პროფესიული გამოცდილება',
    backgroundPlaceholder: 'აღწერეთ თქვენი პროფესიული გამოცდილება, კვალიფიკაცია და მიღწევები...',
    linkedin: 'LinkedIn (არასავალდებულო)',
    bio: 'თქვენს შესახებ (Bio)',
    bioPlaceholder: 'რამდენიმე წინადადება თქვენს შესახებ, რომელსაც სტუდენტები დაინახავენ...',
    topics: 'სასწავლო თემები',
    topicsPlaceholder: 'დაწერეთ თემა და დააჭირეთ Enter (მაგ: React, UI/UX დიზაინი)',
    submit: 'განაცხადის გაგზავნა',
    submitting: 'იგზავნება…',
    error: 'განაცხადის გაგზავნა ვერ მოხერხდა. გთხოვთ სცადოთ თავიდან.',
    minLength: (n: number) => `მინიმუმ ${n} სიმბოლო`,
  },
  en: {
    title: 'Become a Mentor',
    subtitle: 'Share your expertise — become a verified CDC Mentor and create your own courses in the Instructor Studio.',
    alreadyMentor: 'You are already a Mentor.',
    goToStudio: 'Go to Instructor Studio →',
    pendingNotice: 'Your application is under review.',
    rejectedNotice: 'Your previous application was rejected:',
    reapply: 'Submit a new application',
    background: 'Professional Background',
    backgroundPlaceholder: 'Describe your professional background, qualifications, and achievements...',
    linkedin: 'LinkedIn (optional)',
    bio: 'About You (Bio)',
    bioPlaceholder: 'A few sentences about yourself that students will see...',
    topics: 'Teaching Topics',
    topicsPlaceholder: 'Type a topic and press Enter (e.g. React, UI/UX Design)',
    submit: 'Submit Application',
    submitting: 'Submitting…',
    error: 'Failed to submit the application. Please try again.',
    minLength: (n: number) => `at least ${n} characters`,
  },
};

function BecomeMentorContent() {
  const router = useRouter();
  const { user } = useAuth();
  // Only ka/en have real copy in this page's dict — every other supported
  // locale falls back to English, same posture as the de/es/fr/uk entries
  // in components/common/BackButton.tsx's own dict.
  const t = dict[resolveLocale(router.locale) === 'ka' ? 'ka' : 'en'];

  const [applications, setApplications] = useState<MentorApplication[] | null>(null);
  const [background, setBackground] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [bio, setBio] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setApplications(await getMyMentorApplications());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latest = applications?.[0] ?? null;

  const addTopic = () => {
    const trimmed = topicInput.trim();
    if (trimmed && !topics.includes(trimmed)) setTopics([...topics, trimmed]);
    setTopicInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (background.trim().length < 20 || bio.trim().length < 20 || topics.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitMentorApplication({ background: background.trim(), linkedinUrl: linkedinUrl.trim() || null, bio: bio.trim(), teachingTopics: topics });
      await load();
      setBackground('');
      setLinkedinUrl('');
      setBio('');
      setTopics([]);
    } catch {
      setError(t.error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <SiteHeader />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <BackButton fallbackHref="/dashboard" className="mb-4 text-slate-400 hover:text-slate-100" />
        <h1 className="text-2xl font-black mb-2">{t.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">{t.subtitle}</p>

        {user?.role === 'Mentor' ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-6">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-3">{t.alreadyMentor}</p>
            <Link href="/dashboard/instructor-studio" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 no-underline hover:underline">
              {t.goToStudio}
            </Link>
          </div>
        ) : latest?.status === 'PENDING' ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t.pendingNotice}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {latest?.status === 'REJECTED' && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
                {t.rejectedNotice} {latest.rejectionReason}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-1.5">{t.background}</label>
              <textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                rows={4}
                placeholder={t.backgroundPlaceholder}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {background.length > 0 && background.trim().length < 20 && (
                <p className="text-xs text-red-500 mt-1">{t.minLength(20)}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">{t.linkedin}</label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">{t.bio}</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder={t.bioPlaceholder}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {bio.length > 0 && bio.trim().length < 20 && <p className="text-xs text-red-500 mt-1">{t.minLength(20)}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">{t.topics}</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {topics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs border border-indigo-200 dark:border-indigo-500/30"
                  >
                    {topic}
                    <button type="button" onClick={() => setTopics(topics.filter((x) => x !== topic))} className="bg-transparent border-none cursor-pointer text-indigo-500">
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTopic();
                  }
                }}
                onBlur={addTopic}
                placeholder={t.topicsPlaceholder}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting || background.trim().length < 20 || bio.trim().length < 20 || topics.length === 0}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 px-6 py-3.5 text-sm font-bold text-white transition-opacity disabled:opacity-50 border-none cursor-pointer"
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default function BecomeMentorPage() {
  return (
    <ProtectedRoute>
      <BecomeMentorContent />
    </ProtectedRoute>
  );
}
