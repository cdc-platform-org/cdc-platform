import { CheckCircle2, XCircle, Mail, AlertTriangle, Lightbulb } from 'lucide-react';
import { CandidateResults, CandidateResultQuestion } from '../../services/examProctoringService';
import { SupportedLocale } from '../../utils/locale';

// The student's results after an AI proctored exam: score, then every
// question with their answer, the correct answer and an explanation.
// Used on the exam page right after submitting (pages/exam/[token].tsx)
// and on the results page linked from the email (pages/exam/result/[token].tsx).
// Dark styling to match the exam runner.

const dictBase = {
  ka: {
    title: 'შენი შედეგები',
    score: 'ქულა',
    correctOf: (c: number, n: number) => `სწორი პასუხი: ${c} / ${n}`,
    emailSent: (email: string) => `შედეგები და ახსნები გაიგზავნა მისამართზე: ${email}`,
    emailSentNoAddress: 'შედეგები და ახსნები გამოგეგზავნა ელ. ფოსტაზე.',
    flagged: 'გამოცდა დაფიქსირდა დარღვევების ან დროის ამოწურვის გამო. ღია კითხვები AI-მ არ შეაფასა, საბოლოო შედეგს მასწავლებელი გადახედავს.',
    yourAnswer: 'შენი პასუხი',
    noAnswer: 'პასუხი არ გაცემულა',
    correctAnswer: 'სწორი პასუხი',
    explanation: 'ახსნა',
    feedback: 'შეფასება',
    expected: 'რა უნდა ყოფილიყო პასუხში',
    notGraded: 'ჯერ არ შეფასებულა',
    correct: 'სწორია',
    wrong: 'არასწორია',
  },
  en: {
    title: 'Your results',
    score: 'Score',
    correctOf: (c: number, n: number) => `Correct answers: ${c} / ${n}`,
    emailSent: (email: string) => `Your results and explanations were sent to ${email}`,
    emailSentNoAddress: 'Your results and explanations were sent to your email.',
    flagged: 'This attempt was flagged (violations or time limit). Open questions were not AI-graded; your teacher will review the final result.',
    yourAnswer: 'Your answer',
    noAnswer: 'No answer',
    correctAnswer: 'Correct answer',
    explanation: 'Explanation',
    feedback: 'Feedback',
    expected: 'What a strong answer includes',
    notGraded: 'Not graded yet',
    correct: 'Correct',
    wrong: 'Wrong',
  },
};

const dict: Record<SupportedLocale, typeof dictBase.en> = {
  ...dictBase,
  de: dictBase.en,
  es: dictBase.en,
  fr: dictBase.en,
  uk: dictBase.en,
};

function scoreTone(score: number | null): string {
  if (score == null) return 'text-slate-200';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

function McqResult({ q, t }: { q: CandidateResultQuestion; t: typeof dictBase.en }) {
  return (
    <div className="space-y-1.5">
      {(['A', 'B', 'C', 'D'] as const).map((letter) => {
        const isCorrect = letter === q.correctAnswer;
        const isChosen = letter === q.candidateAnswer;
        const tone = isCorrect
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100'
          : isChosen
            ? 'border-rose-500/50 bg-rose-500/10 text-rose-100'
            : 'border-slate-800 text-slate-400';
        return (
          <div key={letter} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tone}`}>
            <span className="font-bold shrink-0">{letter}.</span>
            <span className="flex-1 min-w-0 break-words">{q.options?.[letter]}</span>
            {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-label={t.correctAnswer} />}
            {isChosen && !isCorrect && <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-label={t.yourAnswer} />}
          </div>
        );
      })}
      {!q.candidateAnswer && <p className="text-xs text-slate-500">{t.noAnswer}</p>}
    </div>
  );
}

function OpenResult({ q, t }: { q: CandidateResultQuestion; t: typeof dictBase.en }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="text-xs font-bold text-slate-400 mb-1">{t.yourAnswer}</p>
        <div
          className={`rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-200 whitespace-pre-wrap break-words ${
            q.type === 'CODE' ? 'font-mono text-xs' : ''
          }`}
        >
          {q.candidateAnswer?.trim() ? q.candidateAnswer : <span className="text-slate-500">{t.noAnswer}</span>}
        </div>
      </div>
      <p className="text-xs font-bold text-slate-300">
        {t.score}: <span className={scoreTone(q.aiScore)}>{q.aiScore != null ? `${Math.round(q.aiScore)} / 100` : t.notGraded}</span>
      </p>
      {q.aiFeedback && (
        <p className="rounded-lg bg-slate-800/70 px-3 py-2 text-slate-200">
          <span className="font-bold">{t.feedback}:</span> {q.aiFeedback}
        </p>
      )}
      {q.expectedAnswer && (
        <p className="text-xs text-slate-400">
          <span className="font-bold text-slate-300">{t.expected}:</span> {q.expectedAnswer}
        </p>
      )}
    </div>
  );
}

export default function ExamResultsView({
  results,
  locale,
  email,
  showEmailNote = true,
}: {
  results: CandidateResults;
  locale: SupportedLocale;
  email?: string;
  showEmailNote?: boolean;
}) {
  const t = dict[locale];
  return (
    <div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.title}</p>
        <h1 className="blog-heading-safe text-lg font-black mt-1 mb-4 break-words">{results.examTitle}</h1>
        <p className={`text-5xl font-black ${scoreTone(results.totalScore)}`}>{results.totalScore != null ? `${Math.round(results.totalScore)}%` : '—'}</p>
        {results.mcqTotal > 0 && <p className="text-sm text-slate-300 mt-2">{t.correctOf(results.correctCount, results.mcqTotal)}</p>}
        {showEmailNote && (
          <p className="mt-4 inline-flex items-start gap-1.5 text-xs text-cyan-300 text-left">
            <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {email ? t.emailSent(email) : t.emailSentNoAddress}
          </p>
        )}
      </div>

      {results.flagged && (
        <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-100">{t.flagged}</p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {results.questions.map((q) => (
          <div key={q.number} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-start gap-2 mb-3">
              {q.type === 'MCQ' &&
                (q.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-label={t.correct} />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" aria-label={t.wrong} />
                ))}
              <p className="text-sm font-bold break-words min-w-0">
                {q.number}. {q.question}
              </p>
            </div>
            {q.type === 'MCQ' ? <McqResult q={q} t={t} /> : <OpenResult q={q} t={t} />}
            {q.explanation && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 text-sm text-slate-200">
                <Lightbulb className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
                <span>
                  <span className="font-bold">{t.explanation}:</span> {q.explanation}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
