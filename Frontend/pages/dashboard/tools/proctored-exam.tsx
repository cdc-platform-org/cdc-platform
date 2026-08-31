import { useEffect, useRef, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import {
  ShieldCheck,
  Camera,
  Maximize,
  Loader2,
  AlertTriangle,
  Clock,
  Copy,
  Printer,
  FileDown,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import SEOHead from '../../../src/components/seo/SEOHead';
import { resolveLocale, contentLocale } from '../../../src/utils/locale';
import {
  generatePracticeExam,
  gradePracticalAnswer,
  ExamLevel,
  ExamQuestion,
  McqQuestion,
  OpenQuestion,
} from '../../../src/services/proctoredPracticeService';

type Stage = 'setup' | 'runner' | 'report';

const SECONDS_PER_QUESTION = 90;
const VIOLATION_PENALTY = 10;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function extractErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.message ?? fallback;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Violation {
  type: 'tab' | 'focus';
  time: string;
}

interface PracticalGrade {
  score: number;
  feedback: string;
}

interface ExamReport {
  topic: string;
  mcqCorrect: number;
  mcqTotal: number;
  practicalGrades: PracticalGrade[];
  overallScore: number;
  trustScore: number;
  violations: Violation[];
}

function ProctoredExamContent() {
  const router = useRouter();
  const lang = contentLocale(resolveLocale(router.locale));
  const { t } = useTranslation('proctoredExam');

  const [stage, setStage] = useState<Stage>('setup');

  // ---- Setup ----
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState<ExamLevel>('MID');
  const [questionCount, setQuestionCount] = useState(7);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'checking' | 'live' | 'denied'>('idle');
  const [fullscreenRequested, setFullscreenRequested] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const handleEnableCamera = async () => {
    setCameraStatus('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraStatus('live');
    } catch {
      setCameraStatus('denied');
    }
  };

  useEffect(() => stopCamera, []);

  // ---- Exam data ----
  const [examTopic, setExamTopic] = useState('');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);

  // ---- Runner ----
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [openAnswers, setOpenAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [trustScore, setTrustScore] = useState(100);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [runnerError, setRunnerError] = useState<string | null>(null);

  const recordViolation = (type: Violation['type']) => {
    setViolations((prev) => [...prev, { type, time: new Date().toLocaleTimeString() }]);
    setTrustScore((prev) => Math.max(0, prev - VIOLATION_PENALTY));
  };

  // Real-time proctoring signals — visibilitychange catches tab switches
  // AND minimizing; blur additionally catches losing focus to another app
  // while the tab stays visible. Blur is skipped when the document is
  // already hidden so a single tab-switch isn't double-counted as two
  // separate violations (visibilitychange + blur both fire for it).
  useEffect(() => {
    if (stage !== 'runner') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') recordViolation('tab');
    };
    const handleBlur = () => {
      if (document.visibilityState !== 'hidden') recordViolation('focus');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ---- Report ----
  const [report, setReport] = useState<ExamReport | null>(null);

  const handleGenerate = async () => {
    if (!subject.trim()) return;
    setGenerating(true);
    setSetupError(null);
    try {
      const result = await generatePracticeExam({ subject: subject.trim(), level, questionCount, language: lang });
      setExamTopic(result.topic);
      setQuestions(result.questions);
      setCurrentIndex(0);
      setMcqAnswers({});
      setOpenAnswers({});
      setTrustScore(100);
      setViolations([]);
      setTimeRemaining(result.questions.length * SECONDS_PER_QUESTION);
      if (fullscreenRequested && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setStage('runner');
    } catch (err) {
      setSetupError(extractErrorMessage(err, t('setupError')));
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitExam = async () => {
    setSubmitting(true);
    setRunnerError(null);
    try {
      const mcqQuestions = questions.filter((q): q is McqQuestion => q.type === 'MCQ');
      const openQuestions = questions.filter((q): q is OpenQuestion => q.type !== 'MCQ');

      const mcqCorrect = mcqQuestions.reduce((n, q) => (mcqAnswers[q.order] === q.correctAnswer ? n + 1 : n), 0);

      const practicalGrades = await Promise.all(
        openQuestions.map((q) =>
          gradePracticalAnswer({
            topic: examTopic,
            questionType: q.type,
            question: q.question,
            rubric: q.rubric,
            answer: openAnswers[q.order] ?? '',
          })
        )
      );

      const mcqScorePct = mcqQuestions.length > 0 ? (mcqCorrect / mcqQuestions.length) * 100 : null;
      const practicalScorePct =
        practicalGrades.length > 0 ? practicalGrades.reduce((sum, g) => sum + g.score, 0) / practicalGrades.length : null;
      const parts = [mcqScorePct, practicalScorePct].filter((p): p is number => p !== null);
      const overallScore = parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;

      setReport({
        topic: examTopic,
        mcqCorrect,
        mcqTotal: mcqQuestions.length,
        practicalGrades,
        overallScore,
        trustScore,
        violations,
      });
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      stopCamera();
      setStage('report');
    } catch (err) {
      setRunnerError(extractErrorMessage(err, t('genericError')));
    } finally {
      setSubmitting(false);
    }
  };

  // Countdown + auto-submit.
  useEffect(() => {
    if (stage !== 'runner') return;
    if (timeRemaining <= 0) {
      handleSubmitExam();
      return;
    }
    const interval = setInterval(() => setTimeRemaining((t2) => t2 - 1), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timeRemaining]);

  const handleExitExam = () => {
    if (!window.confirm(t('runnerExitConfirm'))) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    stopCamera();
    setStage('setup');
  };

  const handleRestart = () => {
    setReport(null);
    setQuestions([]);
    setStage('setup');
  };

  const handleCopyReport = async () => {
    if (!report) return;
    const lines = [
      `${t('reportTitle')} — ${report.topic}`,
      `${t('reportOverallScore')}: ${report.overallScore}%`,
      `${t('reportTrustScoreLabel')}: ${report.trustScore}%`,
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
  };

  const handleExportDocx = async () => {
    if (!report) return;
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
    const children: any[] = [
      new Paragraph({ text: report.topic, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ children: [new TextRun(`${t('reportOverallScore')}: ${report.overallScore}%`)] }),
      new Paragraph({ children: [new TextRun(`${t('reportTrustScoreLabel')}: ${report.trustScore}%`)] }),
      new Paragraph({ text: t('reportQuestionsHeading'), heading: HeadingLevel.HEADING_2 }),
    ];
    questions.forEach((q, i) => {
      children.push(new Paragraph({ children: [new TextRun(`${i + 1}. ${q.question}`)] }));
      if (q.type === 'MCQ') {
        const correct = mcqAnswers[q.order] === q.correctAnswer;
        children.push(new Paragraph({ children: [new TextRun(`${correct ? '✅' : '❌'} ${mcqAnswers[q.order] ?? '—'} (${q.correctAnswer})`)] }));
      } else {
        const grade = report.practicalGrades[questions.filter((qq) => qq.type !== 'MCQ').findIndex((qq) => qq.order === q.order)];
        children.push(new Paragraph({ children: [new TextRun(`${t('reportFeedbackHeading')}: ${grade?.feedback ?? ''}`)] }));
      }
    });
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, 'proctored-exam-report.docx');
  };

  const handlePrint = () => {
    document.body.setAttribute('data-print-target', 'print-report');
    window.print();
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => (q.type === 'MCQ' ? mcqAnswers[q.order] !== undefined : (openAnswers[q.order] ?? '').trim())).length;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        {stage !== 'runner' && (
          <div className="mb-4 no-print">
            <BackButton fallbackHref="/tools" className="dark:text-slate-400 dark:hover:text-slate-100" />
          </div>
        )}

        {stage === 'setup' && (
          <>
            <div className="mb-8 no-print">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t('liveBadge')}
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-wide mb-2">{t('examTitle', 'გამოცდის სათაური')}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">{t('pageSubtitle', 'გამოცდის აღწერა')}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-xl backdrop-blur-md bg-opacity-30">
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">{t('setupSubjectLabel', 'საგანი / თემა')}</label>
                  <input
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t('setupSubjectPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">{t('setupLevelLabel')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['JUNIOR', 'MID', 'SENIOR', 'EXPERT'] as ExamLevel[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLevel(lvl)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                          level === lvl
                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="flex-shrink-0">{lvl === 'JUNIOR' ? <ShieldCheck className="w-4 h-4" /> : lvl === 'MID' ? <Camera className="w-4 h-4" /> : lvl === 'SENIOR' ? <Maximize className="w-4 h-4" /> : <Loader2 className="w-4 h-4" />}</span>
                        {t(`level${lvl.charAt(0)}${lvl.slice(1).toLowerCase()}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">{t('setupQuestionCountLabel')}</label>
                  <input
                    type="number"
                    min={5}
                    max={10}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={questionCount}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      setQuestionCount(Number.isFinite(parsed) ? Math.min(10, Math.max(5, parsed)) : 5);
                    }}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    {t('setupCameraLabel')}
                  </p>
                  <p className="text-[11px] text-slate-400 mb-2">{t('setupCameraHint')}</p>
                  {cameraStatus === 'live' ? (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-lg aspect-video bg-black object-cover" />
                  ) : (
                    <button
                      type="button"
                      onClick={handleEnableCamera}
                      disabled={cameraStatus === 'checking'}
                      className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-transparent border border-cyan-500/30 rounded-lg px-3 py-2 cursor-pointer disabled:opacity-60"
                    >
                      {cameraStatus === 'checking' ? t('setupCameraChecking') : t('setupCameraAllow')}
                    </button>
                  )}
                  {cameraStatus === 'denied' && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">{t('setupCameraDenied')}</p>}
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Maximize className="w-3.5 h-3.5" />
                    {t('setupFullscreenLabel')}
                  </p>
                  <p className="text-[11px] text-slate-400 mb-2">{t('setupFullscreenHint')}</p>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input type="checkbox" checked={fullscreenRequested} onChange={(e) => setFullscreenRequested(e.target.checked)} />
                    {t('setupFullscreenLabel')}
                  </label>
                </div>
              </div>

              {setupError && <p className="text-xs text-rose-600 dark:text-rose-400 mb-3">{setupError}</p>}

              <button
                type="button"
                disabled={!subject.trim() || generating}
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-indigo-600 text-white font-black text-lg px-8 py-4 rounded-3xl border-none cursor-pointer hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {generating ? t('setupGenerating', { defaultValue: 'გენერირება...' }) : t('setupStartButton', { defaultValue: 'გამოცდის დაწყება' })}
              </button>
            </div>
          </>
        )}

        {stage === 'runner' && currentQuestion && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-sm font-black text-slate-700 dark:text-slate-200">
                  <Clock className="w-4 h-4" />
                  {formatTime(Math.max(0, timeRemaining))}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('runnerQuestionOf', { current: currentIndex + 1, total: questions.length })}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${trustScore >= 70 ? 'text-emerald-600 dark:text-emerald-400' : trustScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {t('runnerTrustScore')}: {trustScore}%
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {cameraStatus === 'live' ? t('runnerCameraLive') : t('runnerCameraOff')}
                </span>
                <button type="button" onClick={handleExitExam} className="text-xs font-bold text-rose-500 hover:text-rose-600 bg-transparent border-none cursor-pointer">
                  {t('runnerExitButton')}
                </button>
              </div>
            </div>

            {violations.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  {violations[violations.length - 1].type === 'tab' ? t('runnerTabSwitchWarning') : t('runnerFocusLossWarning')} — {t('runnerViolationCount', { count: violations.length })}
                </p>
              </div>
            )}

            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-xl">
              <p className="text-base font-bold mb-4">{currentQuestion.question}</p>
              {currentQuestion.type === 'MCQ' ? (
                <div className="flex flex-col gap-2">
                  {(Object.keys(currentQuestion.options) as Array<'A' | 'B' | 'C' | 'D'>).map((key) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                        mcqAnswers[currentQuestion.order] === key ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-500/10' : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${currentQuestion.order}`}
                        checked={mcqAnswers[currentQuestion.order] === key}
                        onChange={() => setMcqAnswers((prev) => ({ ...prev, [currentQuestion.order]: key }))}
                      />
                      <span>
                        <strong>{key}.</strong> {currentQuestion.options[key]}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={8}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  value={openAnswers[currentQuestion.order] ?? ''}
                  onChange={(e) => setOpenAnswers((prev) => ({ ...prev, [currentQuestion.order]: e.target.value }))}
                  placeholder={t('runnerOpenPlaceholder')}
                />
              )}

              {runnerError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">{runnerError}</p>}

              <div className="flex items-center justify-between mt-6">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="text-sm font-bold text-slate-500 dark:text-slate-400 bg-transparent border-none cursor-pointer disabled:opacity-40"
                >
                  {t('runnerPrevious')}
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-3xl px-8 py-4"
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-3xl px-8 py-4"
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-3xl px-8 py-4"
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-3xl px-8 py-4"
                    type="button"
                    onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold px-5 py-2.5 text-sm"
                  >
                    {t('runnerNext')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitExam}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-bold px-5 py-2.5 text-sm disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {submitting ? t('runnerSubmitting') : t('runnerSubmit')}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-3">{answeredCount} / {questions.length}</p>
            </div>
          </div>
        )}

        {stage === 'report' && report && (
          <div>
            <div className="flex items-center justify-between mb-6 no-print">
              <h1 className="text-2xl font-black tracking-wide">{t('reportTitle')}</h1>
              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-transparent border-none cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('reportRestartButton')}
              </button>
            </div>

            <div id="print-report">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 mb-6">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{report.topic}</p>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-black bg-gradient-to-r from-cyan-500 to-purple-600 bg-clip-text text-transparent">{report.overallScore}%</span>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{t('reportOverallScore')}</span>
                </div>

                <h3 className="text-sm font-black mb-2">{t('reportCompetencyHeading')}</h3>
                <div className="grid sm:grid-cols-2 gap-3 mb-5">
                  {report.mcqTotal > 0 && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('reportMcqScore')}</p>
                      <p className="text-lg font-black">{report.mcqCorrect} / {report.mcqTotal}</p>
                    </div>
                  )}
                  {report.practicalGrades.length > 0 && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('reportPracticalScore')}</p>
                      <p className="text-lg font-black">{Math.round(report.practicalGrades.reduce((s, g) => s + g.score, 0) / report.practicalGrades.length)}%</p>
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-black mb-2">{t('reportIntegrityHeading')}</h3>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 mb-2">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('reportTrustScoreLabel')}</p>
                  <p className="text-lg font-black">{report.trustScore}%</p>
                </div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{t('reportViolationsLogHeading')}</p>
                {report.violations.length === 0 ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{t('reportNoViolations')}</p>
                ) : (
                  <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    {report.violations.map((v, i) => (
                      <li key={i}>{t('reportTabSwitchEvent', { time: v.time })}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 shadow-xl">
                <h3 className="text-sm font-black mb-4">{t('reportQuestionsHeading')}</h3>
                <div className="flex flex-col gap-4">
                  {questions.map((q, i) => {
                    if (q.type === 'MCQ') {
                      const correct = mcqAnswers[q.order] === q.correctAnswer;
                      return (
                        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                          <p className="text-sm font-semibold mb-1.5">{i + 1}. {q.question}</p>
                          <p className={`text-xs font-bold flex items-center gap-1.5 ${correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {correct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {correct ? t('reportCorrect') : t('reportIncorrect')}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('reportYourAnswer')}: {mcqAnswers[q.order] ?? '—'} · {t('reportCorrectAnswer')}: {q.correctAnswer}</p>
                        </div>
                      );
                    }
                    const openIndex = questions.filter((qq) => qq.type !== 'MCQ').findIndex((qq) => qq.order === q.order);
                    const grade = report.practicalGrades[openIndex];
                    return (
                      <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                        <p className="text-sm font-semibold mb-1.5">{i + 1}. {q.question}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 whitespace-pre-wrap">{openAnswers[q.order] || '—'}</p>
                        {grade && (
                          <>
                            <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{grade.score}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <strong>{t('reportFeedbackHeading')}:</strong> {grade.feedback}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4 no-print">
              <button type="button" onClick={handleCopyReport} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
                <Copy className="w-3.5 h-3.5" />
                {t('exportCopy')}
              </button>
              <button type="button" onClick={handleExportDocx} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
                <FileDown className="w-3.5 h-3.5" />
                {t('exportDocx')}
              </button>
              <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
                <Printer className="w-3.5 h-3.5" />
                {t('exportPrint')}
              </button>
            </div>
          </div>
        )}
      </div>

      {stage !== 'runner' && (
        <div className="no-print">
          <SiteFooter />
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          body[data-print-target='print-report'] #print-report,
          body[data-print-target='print-report'] #print-report * {
            visibility: visible;
          }
          #print-report {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default function ProctoredExamPage() {
  const { t } = useTranslation('proctoredExam');
  return (
    <>
      {/* Rendered above ProtectedRoute — see educator-hub.tsx's identical
          comment for why: an unauthenticated crawler never renders
          ProctoredExamContent at all. */}
      <SEOHead title={t('pageTitle')} description={t('pageSubtitle')} noIndex />
      <ProtectedRoute>
        <ProctoredExamContent />
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['proctoredExam'])) },
});
