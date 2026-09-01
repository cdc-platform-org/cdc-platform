import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import {
  FileText,
  ClipboardList,
  PenSquare,
  Puzzle,
  BookOpen,
  FolderKanban,
  Mail,
  Crown,
  Copy,
  Printer,
  FileDown,
  Loader2,
  AlertCircle,
  X,
  Link2,
  Users,
} from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import BackButton from '../../../src/components/common/BackButton';
import SEOHead from '../../../src/components/seo/SEOHead';
import RichTextEditor from '../../../src/components/shared/RichTextEditor';
import FileDropzone from '../../../src/components/shared/FileDropzone';
import { resolveLocale, contentLocale } from '../../../src/utils/locale';
import {
  getEducatorHubState,
  startEducatorVipTrial,
  generateTest,
  generateRubric,
  gradeHomework,
  createQuiz,
  getQuizSubmissions,
  EducatorHubState,
  QuestionType,
  Difficulty,
  GeneratedTest,
  GeneratedRubric,
  GradedHomework,
  QuizSubmissionSummary,
  generateDifferentiatedTask,
  GeneratedDifferentiatedTask,
  generateLessonPlan,
  GeneratedLessonPlan,
  LessonType,
  generateBureaucracyDoc,
  GeneratedBureaucracyDoc,
  BureaucracyDocumentType,
  generateParentLetter,
  GeneratedParentLetter,
  ParentLetterPurpose,
} from '../../../src/services/educatorHubService';

type TabId = 'test' | 'rubric' | 'grading' | 'sen' | 'lessonPlan' | 'bureaucracy' | 'parentReports';

// All 7 modules are real generation now — no more "coming soon" tier.
const REAL_TABS: { id: TabId; icon: typeof FileText }[] = [
  { id: 'test', icon: FileText },
  { id: 'rubric', icon: ClipboardList },
  { id: 'grading', icon: PenSquare },
  { id: 'sen', icon: Puzzle },
  { id: 'lessonPlan', icon: BookOpen },
  { id: 'bureaucracy', icon: FolderKanban },
  { id: 'parentReports', icon: Mail },
  { id: 'certificates', icon: Crown }, // New tab for certificates
];

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

async function exportDocx(sections: { heading: string; body: string }[], filename: string) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  async function exportPdf(sections: { heading: string; body: string }[], filename: string) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points
    const { width, height } = page.getSize();
    const fontSize = 12;

    let y = height - 50; // Start 50 points from the top
    sections.forEach(({ heading, body }) => {
      page.drawText(heading, { x: 50, y, size: fontSize + 2, font, color: rgb(0, 0, 0) });
      y -= fontSize + 10;
      body.split('\n').forEach((line) => {
        page.drawText(line, { x: 50, y, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= fontSize + 5;
      });
      y -= 20; // Add spacing between sections
    });

    const pdfBytes = await pdfDoc.save();
    downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), filename);
  }
  const toParagraphs = (text: string) =>
    text.split('\n').map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, font: 'Times New Roman', size: 24 })],
          spacing: { after: 200 },
        })
    );
  const children: any[] = [];
  sections.forEach(({ heading, body }) => {
    children.push(new Paragraph({ text: heading, heading: HeadingLevel.HEADING_1 }));
    children.push(...toParagraphs(body));
  });
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename);
}

function exportTxt(sections: { heading: string; body: string }[], filename: string) {
  const text = sections.map(({ heading, body }) => `${heading}\n\n${body}`).join('\n\n---\n\n');
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}

// axios deserializes error bodies as expected here (no blob responseType on
// any Educator Hub call) — same shape as this codebase's other AI-route
// error extraction (see media-studio.tsx's own extractErrorMessage).
function extractErrorMessage(err: any, fallback: string): { message: string; code?: string } {
  const data = err?.response?.data;
  return { message: data?.message ?? fallback, code: data?.code };
}

function ExportBar({ t, sections, filenameBase, printAreaId }: { t: (k: string) => string; sections: { heading: string; body: string }[]; filenameBase: string; printAreaId: string }) {
  const handleTextToSpeech = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(sections.map((s) => `${s.heading}\n\n${s.body}`).join('\n\n---\n\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handlePrint = () => {
    document.body.setAttribute('data-print-target', printAreaId);
    window.print();
  };
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
        <Copy className="w-3.5 h-3.5" />
        {copied ? t('exportCopied') : t('exportCopy')}
      </button>
      <button
        type="button"
        onClick={async () => {
          setLoading(true);
          await exportDocx(sections, `${filenameBase}.docx`);
          setLoading(false);
        }}
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${
          loading ? 'bg-gray-300 dark:bg-gray-700' : 'bg-slate-100 dark:bg-slate-800'
        } text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700`}
        disabled={loading}
      >
        <FileDown className="w-3.5 h-3.5" />
        {t('exportDocx')}
      </button>
      <button
        type="button"
        onClick={async () => {
          setLoading(true);
          await exportPdf(sections, `${filenameBase}.pdf`);
          setLoading(false);
        }}
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg ${
          loading ? 'bg-gray-300 dark:bg-gray-700' : 'bg-slate-100 dark:bg-slate-800'
        } text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700`}
        disabled={loading}
      >
        <FileDown className="w-3.5 h-3.5" />
        {t('exportTxt')}
      </button>
      <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
        <Printer className="w-3.5 h-3.5" />
        {t('exportPrint')}
      </button>
      <button type="button" onClick={() => handleTextToSpeech(sections.map((s) => `${s.heading}\n\n${s.body}`).join('\n\n'))} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
        <FileText className="w-3.5 h-3.5" />
        {t('listenToExplanation')}
      </button>
        <Printer className="w-3.5 h-3.5" />
        {t('exportPrint')}
      </button>
    </div>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="flex-1 min-w-[160px]">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
        <span>{label}</span>
        <span>{used} / {limit}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-400 to-purple-600 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500';

function useSpeechToText(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognition.current = new (window as any).webkitSpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';
      recognition.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };
      recognition.current.onerror = () => setListening(false);
      recognition.current.onend = () => setListening(false);
    }
  }, [onResult]);

  const startListening = () => {
    if (recognition.current) {
      setListening(true);
      recognition.current.start();
    }
  };

  const stopListening = () => {
    if (recognition.current) {
      setListening(false);
      recognition.current.stop();
    }
  };

  return { listening, startListening, stopListening };
}
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5';
// Native <select> renders its <option> popup via the OS, outside the page's
// own light/dark styling — without an explicit color here, dark mode's
// light-on-dark <select> text can end up illegible (or invisible) against
// the option list's default background in some browsers.
const optionClass = 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white';

function EducatorHubContent() {
  const router = useRouter();
  const lang = contentLocale(resolveLocale(router.locale));
  const { t } = useTranslation('educatorHub');

  const [hubState, setHubState] = useState<EducatorHubState | null>(null);
  const [stateLoading, setStateLoading] = useState(true);
  // Distinct from "no VIP access" — a fetch failure (network/backend down)
  // previously fell through to the exact same "VIP Required" upsell banner
  // with no indication anything had actually gone wrong, silently hiding
  // real access from a paying VIP if their very first load happened to hit
  // a transient network error. Now surfaced with its own retry affordance.
  const [stateError, setStateError] = useState(false);
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('test');

  const refreshState = () =>
    getEducatorHubState()
      .then((s) => {
        setHubState(s);
        setStateError(false);
      })
      .catch(() => setStateError(true));

  useEffect(() => {
    refreshState().finally(() => setStateLoading(false));
  }, []);

  const handleStartTrial = async () => {
    setTrialStarting(true);
    setTrialError(null);
    try {
      await startEducatorVipTrial();
      await refreshState();
    } catch (err) {
      setTrialError(extractErrorMessage(err, t('trialStartError')).message);
    } finally {
      setTrialStarting(false);
    }
  };

  // Shared by all 3 real modules — VIP_REQUIRED/QUOTA_EXCEEDED refresh the
  // usage/access banner instead of just showing a toast, since both change
  // what the header CTA should say; SESSION_SUPERSEDED is a distinct,
  // sitewide-relevant state (see middleware/auth.ts's requireCurrentEducatorSession)
  // shown as a dismissible banner rather than inline per-tab.
  const handleModuleError = (err: any, fallback: string, setError: (msg: string) => void) => {
    const { message, code } = extractErrorMessage(err, fallback);
    if (code === 'VIP_REQUIRED' || code === 'QUOTA_EXCEEDED') {
      refreshState();
    }
    setError(message);
  };

  // ---- Module 1: Test generator ----
  const [testSubject, setTestSubject] = useState('');
  const [testGrade, setTestGrade] = useState('');
  const [testTopic, setTestTopic] = useState('');
  const [testTypes, setTestTypes] = useState<QuestionType[]>(['MULTIPLE_CHOICE']);
  const [testDifficulty, setTestDifficulty] = useState<Difficulty>('MIXED');
  const [testCount, setTestCount] = useState(10);
  const [quizTimer, setQuizTimer] = useState(60); // Default timer in seconds
  const [testSourceText, setTestSourceText] = useState('');
  const [testSourceFile, setTestSourceFile] = useState<File | null>(null);
  const [testGenerating, setTestGenerating] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<GeneratedTest | null>(null);

  // Quiz-sharing — a generated test's structured `questions` (see
  // GeneratedTest) turned into a no-login student link. Reset whenever a
  // fresh test is generated, since a previously shared link refers to the
  // old question set, not whatever testResult currently holds.
  const [quizSharing, setQuizSharing] = useState(false);
  const [quizShareError, setQuizShareError] = useState<string | null>(null);
  const [quizShareLink, setQuizShareLink] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmissionSummary[] | null>(null);
  const [quizSubmissionsLoading, setQuizSubmissionsLoading] = useState(false);

  const toggleTestType = (type: QuestionType) => {
    setTestTypes((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]));
  };

  const handleGenerateTest = async () => {
    if (!testSubject.trim() || !testGrade.trim() || !testTopic.trim() || testTypes.length === 0) return;
    setTestGenerating(true);
    setTestError(null);
    try {
      const result = await generateTest({
        subject: testSubject,
        grade: testGrade,
        topic: testTopic,
        questionTypes: testTypes,
        difficulty: testDifficulty,
        questionCount: testCount,
        language: lang,
        sourceText: testSourceText.trim() || undefined,
        sourceFile: testSourceFile ?? undefined,
      });
      setTestResult(result);
      setQuizShareLink(null);
      setQuizId(null);
      setQuizSubmissions(null);
      setQuizShareError(null);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setTestError);
    } finally {
      setTestGenerating(false);
    }
  };

  const handleShareQuiz = async () => {
    if (!testResult) return;
    setQuizSharing(true);
    setQuizShareError(null);
    try {
      const { id, shareToken } = await createQuiz({
        title: `${testSubject} — ${testTopic}`,
        language: lang,
        questions: testResult.questions,
      });
      setQuizId(id);
      setQuizShareLink(`${window.location.origin}/quiz/${shareToken}`);
    } catch (err) {
      handleModuleError(err, t('genericError'), setQuizShareError);
    } finally {
      setQuizSharing(false);
    }
  };

  const handleLoadSubmissions = async () => {
    if (!quizId) return;
    setQuizSubmissionsLoading(true);
    try {
      setQuizSubmissions(await getQuizSubmissions(quizId));
    } catch {
      setQuizSubmissions([]);
    } finally {
      setQuizSubmissionsLoading(false);
    }
  };

  // ---- Module 2: Rubric builder ----
  const [rubricSubject, setRubricSubject] = useState('');
  const [rubricGrade, setRubricGrade] = useState('');
  const [rubricAssessmentType, setRubricAssessmentType] = useState<'FORMATIVE' | 'SUMMATIVE' | 'DIAGNOSTIC' | 'PROJECT'>('SUMMATIVE');
  const [rubricSkill, setRubricSkill] = useState('');
  const [rubricScale, setRubricScale] = useState('0–10');
  const [rubricGenerating, setRubricGenerating] = useState(false);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricResult, setRubricResult] = useState<GeneratedRubric | null>(null);

  const handleGenerateRubric = async () => {
    if (!rubricSubject.trim() || !rubricGrade.trim() || !rubricSkill.trim() || !rubricScale.trim()) return;
    setRubricGenerating(true);
    setRubricError(null);
    try {
      const result = await generateRubric({
        subject: rubricSubject,
        grade: rubricGrade,
        assessmentType: rubricAssessmentType,
        skillOrTopic: rubricSkill,
        scoringScale: rubricScale,
        language: lang,
      });
      setRubricResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setRubricError);
    } finally {
      setRubricGenerating(false);
    }
  };

  // ---- Module 3: Homework grading ----
  const [gradingPrompt, setGradingPrompt] = useState('');
  const [workSource, setWorkSource] = useState<'text' | 'image'>('text');
  const [studentWorkText, setStudentWorkText] = useState('');
  const [studentWorkImage, setStudentWorkImage] = useState<File | null>(null);
  const [gradingScale, setGradingScale] = useState('0–100');
  const [gradingInProgress, setGradingInProgress] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingResult, setGradingResult] = useState<GradedHomework | null>(null);

  const handleGradeHomework = async () => {
    if (!gradingPrompt.trim() || !gradingScale.trim()) return;
    if (workSource === 'text' && !studentWorkText.trim()) return;
    if (workSource === 'image' && !studentWorkImage) return;
    setGradingInProgress(true);
    setGradingError(null);
    try {
      const result = await gradeHomework({
        assignmentPrompt: gradingPrompt,
        studentWorkText: workSource === 'text' ? studentWorkText : undefined,
        studentWorkImage: workSource === 'image' ? studentWorkImage ?? undefined : undefined,
        gradingScale,
        language: lang,
      });
      setGradingResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setGradingError);
    } finally {
      setGradingInProgress(false);
    }
  };

  // ---- Module 4: Differentiated assignments & SEN adaptations ----
  const [senSubject, setSenSubject] = useState('');
  const [senGrade, setSenGrade] = useState('');
  const [senTopic, setSenTopic] = useState('');
  const [senAdaptations, setSenAdaptations] = useState(false);
  const [senGenerating, setSenGenerating] = useState(false);
  const [senError, setSenError] = useState<string | null>(null);
  const [senResult, setSenResult] = useState<GeneratedDifferentiatedTask | null>(null);

  const handleGenerateSen = async () => {
    if (!senSubject.trim() || !senGrade.trim() || !senTopic.trim()) return;
    setSenGenerating(true);
    setSenError(null);
    try {
      const result = await generateDifferentiatedTask({
        subject: senSubject,
        grade: senGrade,
        topic: senTopic,
        senAdaptations,
        language: lang,
      });
      setSenResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setSenError);
    } finally {
      setSenGenerating(false);
    }
  };

  // ---- Module 5: ESG lesson planner ----
  const [lessonSubject, setLessonSubject] = useState('');
  const [lessonGrade, setLessonGrade] = useState('');
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonDuration, setLessonDuration] = useState(45);
  const [lessonType, setLessonType] = useState<LessonType>('STANDARD');
  const [lessonGenerating, setLessonGenerating] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [lessonResult, setLessonResult] = useState<GeneratedLessonPlan | null>(null);

  const handleGenerateLessonPlan = async () => {
    if (!lessonSubject.trim() || !lessonGrade.trim() || !lessonTopic.trim()) return;
    setLessonGenerating(true);
    setLessonError(null);
    try {
      const result = await generateLessonPlan({
        subject: lessonSubject,
        grade: lessonGrade,
        topic: lessonTopic,
        durationMinutes: lessonDuration,
        lessonType,
        language: lang,
      });
      setLessonResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setLessonError);
    } finally {
      setLessonGenerating(false);
    }
  };

  // ---- Module 6: School bureaucracy & documentation ----
  const [bureaucracyDocType, setBureaucracyDocType] = useState<BureaucracyDocumentType>('ACTIVITY_REPORT');
  const [bureaucracySubject, setBureaucracySubject] = useState('');
  const [bureaucracyGrade, setBureaucracyGrade] = useState('');
  const [bureaucracyKeyPoints, setBureaucracyKeyPoints] = useState('');
  const [bureaucracyGenerating, setBureaucracyGenerating] = useState(false);
  const [bureaucracyError, setBureaucracyError] = useState<string | null>(null);
  const [bureaucracyResult, setBureaucracyResult] = useState<GeneratedBureaucracyDoc | null>(null);

  const handleGenerateBureaucracyDoc = async () => {
    if (!bureaucracySubject.trim() || !bureaucracyGrade.trim() || !bureaucracyKeyPoints.trim()) return;
    setBureaucracyGenerating(true);
    setBureaucracyError(null);
    try {
      const result = await generateBureaucracyDoc({
        documentType: bureaucracyDocType,
        subject: bureaucracySubject,
        grade: bureaucracyGrade,
        keyPoints: bureaucracyKeyPoints,
        language: lang,
      });
      setBureaucracyResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setBureaucracyError);
    } finally {
      setBureaucracyGenerating(false);
    }
  };

  // ---- Module 7: Student reports & parent letters ----
  const [letterStudentName, setLetterStudentName] = useState('');
  const [letterGrade, setLetterGrade] = useState('');
  const [letterPurpose, setLetterPurpose] = useState<ParentLetterPurpose>('PRAISE');
  const [letterTeacherNotes, setLetterTeacherNotes] = useState('');
  const [letterGenerating, setLetterGenerating] = useState(false);
  const [letterError, setLetterError] = useState<string | null>(null);
  const [letterResult, setLetterResult] = useState<GeneratedParentLetter | null>(null);

  const handleGenerateParentLetter = async () => {
    if (!letterStudentName.trim() || !letterGrade.trim() || !letterTeacherNotes.trim()) return;
    setLetterGenerating(true);
    setLetterError(null);
    try {
      const result = await generateParentLetter({
        studentName: letterStudentName,
        grade: letterGrade,
        letterPurpose,
        teacherNotes: letterTeacherNotes,
        language: lang,
      });
      setLetterResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setLetterError);
    } finally {
      setLetterGenerating(false);
    }
  };

  const hasAccess = hubState?.hasAccess ?? false;
  const usage = hubState?.usage;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <SiteHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4 no-print">
          <BackButton fallbackHref="/tools" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>


        {/* Module 8: Student Certificate & Diploma Builder */}
        {tab === 'certificates' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold mb-4">{t('certificatesTitle')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('certificatesDescription')}</p>
            <CertificateBuilder />
          </div>
        )}

        <div className="mb-8 no-print">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/20">
              <Crown className="w-3.5 h-3.5" />
              {t('vipBadge')}
            </span>
            {hubState?.isVipActive && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t('vipActiveLabel')}</span>
            )}
            {!hubState?.isVipActive && hubState?.trialActive && (
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                {t('trialActiveLabel', {
                  days: Math.max(1, Math.ceil((new Date(hubState.educatorVipTrialEndDate ?? 0).getTime() - Date.now()) / (24 * 60 * 60 * 1000))),
                })}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-wide mb-2">{t('pageTitle')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">{t('pageSubtitle')}</p>


          {!stateLoading && !stateError && !hasAccess && (
            <div className="mt-5 rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-5">
              <h3 className="text-sm font-black text-amber-800 dark:text-amber-300 mb-1">{t('vipRequiredTitle')}</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">{t('vipRequiredDesc')}</p>
              {hubState?.trialAvailable ? (
                <button
                  type="button"
                  disabled={trialStarting}
                  onClick={handleStartTrial}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-60"
                >
                  {trialStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                  {t('trialCta')}
                </button>
              ) : null}
              {trialError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{trialError}</p>}
            </div>
          )}

          {hasAccess && usage && (
            <div className="mt-5 flex flex-wrap gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
              <UsageMeter label={t('usageMeterGenerationsLabel')} used={usage.generationsUsed} limit={usage.generationsLimit} />
              <UsageMeter label={t('usageMeterGradingsLabel')} used={usage.gradingsUsed} limit={usage.gradingsLimit} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 no-print">
          {REAL_TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full border cursor-pointer transition-all duration-300 ${
                tab === id
                  ? 'bg-gradient-to-r from-amber-500 to-purple-600 text-white border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] backdrop-blur-md'
                  : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(
                `tab${
                  id === 'test'
                    ? 'TestGenerator'
                    : id === 'rubric'
                    ? 'Rubric'
                    : id === 'grading'
                    ? 'Grading'
                    : id === 'sen'
                    ? 'Sen'
                    : id === 'lessonPlan'
                    ? 'LessonPlan'
                    : id === 'bureaucracy'
                    ? 'Bureaucracy'
                    : 'ParentReports'
                }`
              )}
            </button>
          ))}
        </div>

        {/* Module 1: Test generator */}
        {tab === 'test' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('quizTimerLabel')}</label>
                <input
                  type="number"
                  min={30}
                  max={300}
                  className={inputClass}
                  value={quizTimer}
                  onChange={(e) => setQuizTimer(Number(e.target.value))}
                  placeholder={t('quizTimerPlaceholder')}
                  disabled={!hasAccess}
                />
              </div>
                <label className={labelClass}>{t('testSubjectLabel')}</label>
                <input className={inputClass} value={testSubject} onChange={(e) => setTestSubject(e.target.value)} placeholder={t('testSubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('testGradeLabel')}</label>
                <input className={inputClass} value={testGrade} onChange={(e) => setTestGrade(e.target.value)} placeholder={t('testGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('testTopicLabel')}</label>
                <input className={inputClass} value={testTopic} onChange={(e) => setTestTopic(e.target.value)} placeholder={t('testTopicPlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('testSourceUploadLabel')}</label>
                <FileDropzone
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  uploading={false}
                  selectedFileName={testSourceFile?.name ?? null}
                  onFile={setTestSourceFile}
                  label={t('testSourceUploadCta')}
                  hint={t('testSourceUploadHint')}
                  uploadingLabel={t('testSourceUploading')}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('testSourceTextLabel')}</label>
                <div className="relative">
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={testSourceText}
                    onChange={(e) => setTestSourceText(e.target.value)}
                    placeholder={t('testSourceTextPlaceholder')}
                    disabled={!hasAccess}
                  />
                  <button
                    type="button"
                    onClick={() => (listening ? stopListening() : startListening())}
                    className={`absolute right-3 top-3 text-sm font-bold px-3 py-1.5 rounded-full border cursor-pointer ${
                      listening ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {listening ? t('stopListening') : t('startListening')}
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('testQuestionTypesLabel')}</label>
                <div className="flex flex-wrap gap-3">
                  {(['MULTIPLE_CHOICE', 'OPEN', 'MATCHING'] as QuestionType[]).map((type) => (
                    <label key={type} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={testTypes.includes(type)} onChange={() => toggleTestType(type)} disabled={!hasAccess} />
                      {t(`testType${type === 'MULTIPLE_CHOICE' ? 'MultipleChoice' : type === 'OPEN' ? 'Open' : 'Matching'}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>{t('testDifficultyLabel')}</label>
                <select className={inputClass} value={testDifficulty} onChange={(e) => setTestDifficulty(e.target.value as Difficulty)} disabled={!hasAccess}>
                  <option className={optionClass} value="EASY">{t('difficultyEasy')}</option>
                  <option className={optionClass} value="MEDIUM">{t('difficultyMedium')}</option>
                  <option className={optionClass} value="HARD">{t('difficultyHard')}</option>
                  <option className={optionClass} value="MIXED">{t('difficultyMixed')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('testQuestionCountLabel')}</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className={inputClass}
                  value={testCount}
                  onChange={(e) => {
                    // A cleared field evaluates Number('') as 0, not NaN —
                    // silently sending questionCount:0 to a schema that
                    // requires >=1, which surfaced as a generic "something
                    // went wrong" instead of a clear reason. Clamped here
                    // instead of relying on the disabled-button guard below,
                    // since nothing else in this form validates testCount.
                    const parsed = Number(e.target.value);
                    setTestCount(Number.isFinite(parsed) ? Math.min(30, Math.max(1, parsed)) : 1);
                  }}
                  disabled={!hasAccess}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || testGenerating}
              onClick={handleGenerateTest}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
            >
              {testGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {testGenerating ? t('testGenerating') : t('testGenerateButton')}
            </button>
            {testError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{testError}</p>}

            <div id="print-test" className="mt-6">
              {testResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('testOutputSheetHeading')}</h3>
                  <RichTextEditor value={testResult.testSheet} onChange={(v) => setTestResult((prev) => (prev ? { ...prev, testSheet: v } : prev))} rows={14} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('testOutputKeyHeading')}</h3>
                  <RichTextEditor value={testResult.answerKey} onChange={(v) => setTestResult((prev) => (prev ? { ...prev, answerKey: v } : prev))} rows={10} />
                  <div className="no-print">
                    <ExportBar
                      t={t}
                      sections={[
                        { heading: t('testOutputSheetHeading'), body: testResult.testSheet },
                        { heading: t('testOutputKeyHeading'), body: testResult.answerKey },
                      ]}
                      filenameBase="test"
                      printAreaId="print-test"
                    />
                  </div>
                  <div className="no-print mt-6 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    {!quizShareLink ? (
                      <button
                        type="button"
                        disabled={quizSharing}
                        onClick={handleShareQuiz}
                        className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
                      >
                        {quizSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                        {t('quizShareButton')}
                      </button>
                    ) : (
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('quizShareLinkLabel')}</p>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <input
                            readOnly
                            value={quizShareLink}
                            onClick={(e) => e.currentTarget.select()}
                            className="flex-1 min-w-[16rem] rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(quizShareLink)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {t('exportCopy')}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadSubmissions}
                          disabled={quizSubmissionsLoading}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                          <Users className="w-3.5 h-3.5" />
                          {t('quizResultsRefresh')}
                        </button>
                        {quizSubmissions && (
                          <div className="mt-3 space-y-1.5">
                            {quizSubmissions.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 italic">{t('quizResultsEmpty')}</p>
                            ) : (
                              quizSubmissions.map((s) => (
                                <div key={s.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                                  <span className="font-bold">{s.studentName}</span>
                                  <span>{s.score}%</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {quizShareError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{quizShareError}</p>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('testEmptyState')}</p>
              )}
            </div>
          </div>
        )}

        {/* Module 2: Rubric builder */}
        {tab === 'rubric' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('rubricSubjectLabel')}</label>
                <input className={inputClass} value={rubricSubject} onChange={(e) => setRubricSubject(e.target.value)} placeholder={t('rubricSubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('rubricGradeLabel')}</label>
                <input className={inputClass} value={rubricGrade} onChange={(e) => setRubricGrade(e.target.value)} placeholder={t('rubricGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('rubricAssessmentTypeLabel')}</label>
                <select
                  className={inputClass}
                  value={rubricAssessmentType}
                  onChange={(e) => setRubricAssessmentType(e.target.value as 'FORMATIVE' | 'SUMMATIVE' | 'DIAGNOSTIC' | 'PROJECT')}
                  disabled={!hasAccess}
                >
                  <option className={optionClass} value="SUMMATIVE">{t('assessmentSummative')}</option>
                  <option className={optionClass} value="FORMATIVE">{t('assessmentFormative')}</option>
                  <option className={optionClass} value="DIAGNOSTIC">{t('assessmentDiagnostic')}</option>
                  <option className={optionClass} value="PROJECT">{t('assessmentProject')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('rubricScaleLabel')}</label>
                <input className={inputClass} value={rubricScale} onChange={(e) => setRubricScale(e.target.value)} placeholder={t('rubricScalePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('rubricSkillLabel')}</label>
                <input className={inputClass} value={rubricSkill} onChange={(e) => setRubricSkill(e.target.value)} placeholder={t('rubricSkillPlaceholder')} disabled={!hasAccess} />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || rubricGenerating}
              onClick={handleGenerateRubric}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
            >
              {rubricGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              {rubricGenerating ? t('rubricGenerating') : t('rubricGenerateButton')}
            </button>
            {rubricError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{rubricError}</p>}

            <div id="print-rubric" className="mt-6">
              {rubricResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('rubricOutputHeading')}</h3>
                  <RichTextEditor value={rubricResult.rubric} onChange={(v) => setRubricResult({ rubric: v })} rows={16} />
                  <div className="no-print">
                    <ExportBar t={t} sections={[{ heading: t('rubricOutputHeading'), body: rubricResult.rubric }]} filenameBase="rubric" printAreaId="print-rubric" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('rubricEmptyState')}</p>
              )}
            </div>
          </div>
        )}

        {/* Module 3: Homework grading */}
        {tab === 'grading' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('gradingPromptLabel')}</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={gradingPrompt}
                  onChange={(e) => setGradingPrompt(e.target.value)}
                  placeholder={t('gradingPromptPlaceholder')}
                  disabled={!hasAccess}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('gradingWorkSourceLabel')}</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setWorkSource('text')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer ${workSource === 'text' ? 'bg-amber-500 text-white border-transparent' : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`}
                  >
                    {t('gradingWorkTextTab')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkSource('image')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer ${workSource === 'image' ? 'bg-amber-500 text-white border-transparent' : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`}
                  >
                    {t('gradingWorkImageTab')}
                  </button>
                </div>
                {workSource === 'text' ? (
                  <textarea
                    className={inputClass}
                    rows={6}
                    value={studentWorkText}
                    onChange={(e) => setStudentWorkText(e.target.value)}
                    placeholder={t('gradingWorkTextPlaceholder')}
                    disabled={!hasAccess}
                  />
                ) : (
                  <FileDropzone
                    accept="image/jpeg,image/png,image/webp"
                    uploading={false}
                    selectedFileName={studentWorkImage?.name ?? null}
                    onFile={setStudentWorkImage}
                    label={t('gradingUploadCta')}
                    hint={t('gradingUploadHint')}
                    uploadingLabel={t('gradingUploading')}
                  />
                )}
              </div>
              <div>
                <label className={labelClass}>{t('gradingScaleLabel')}</label>
                <input className={inputClass} value={gradingScale} onChange={(e) => setGradingScale(e.target.value)} placeholder={t('gradingScalePlaceholder')} disabled={!hasAccess} />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || gradingInProgress}
              onClick={handleGradeHomework}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
            >
              {gradingInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenSquare className="w-4 h-4" />}
              {gradingInProgress ? t('gradingInProgress') : t('gradingButton')}
            </button>
            {gradingError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{gradingError}</p>}

            <div id="print-grading" className="mt-6">
              {gradingResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('gradingScoreHeading')}</h3>
                  <RichTextEditor value={gradingResult.score} onChange={(v) => setGradingResult((prev) => (prev ? { ...prev, score: v } : prev))} rows={2} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('gradingErrorsHeading')}</h3>
                  <RichTextEditor value={gradingResult.errorAnalysis} onChange={(v) => setGradingResult((prev) => (prev ? { ...prev, errorAnalysis: v } : prev))} rows={8} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('gradingFeedbackHeading')}</h3>
                  <RichTextEditor value={gradingResult.feedback} onChange={(v) => setGradingResult((prev) => (prev ? { ...prev, feedback: v } : prev))} rows={8} />
                  <div className="no-print">
                    <ExportBar
                      t={t}
                      sections={[
                        { heading: t('gradingScoreHeading'), body: gradingResult.score },
                        { heading: t('gradingErrorsHeading'), body: gradingResult.errorAnalysis },
                        { heading: t('gradingFeedbackHeading'), body: gradingResult.feedback },
                      ]}
                      filenameBase="grading"
                      printAreaId="print-grading"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('gradingEmptyState')}</p>
              )}
            </div>
          </div>
        )}

        {/* Module 4: Differentiated assignments & SEN adaptations */}
        {tab === 'sen' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('senSubjectLabel')}</label>
                <input className={inputClass} value={senSubject} onChange={(e) => setSenSubject(e.target.value)} placeholder={t('senSubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('senGradeLabel')}</label>
                <input className={inputClass} value={senGrade} onChange={(e) => setSenGrade(e.target.value)} placeholder={t('senGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('senTopicLabel')}</label>
                <input className={inputClass} value={senTopic} onChange={(e) => setSenTopic(e.target.value)} placeholder={t('senTopicPlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={senAdaptations} onChange={(e) => setSenAdaptations(e.target.checked)} disabled={!hasAccess} />
                  {t('senAdaptationsToggle')}
                </label>
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || senGenerating}
              onClick={handleGenerateSen}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
            >
              {senGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Puzzle className="w-4 h-4" />}
              {senGenerating ? t('senGenerating') : t('senGenerateButton')}
            </button>
            {senError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{senError}</p>}

            <div id="print-sen" className="mt-6">
              {senResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('senBasicHeading')}</h3>
                  <RichTextEditor value={senResult.basicLevel} onChange={(v) => setSenResult((prev) => (prev ? { ...prev, basicLevel: v } : prev))} rows={8} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('senStandardHeading')}</h3>
                  <RichTextEditor value={senResult.standardLevel} onChange={(v) => setSenResult((prev) => (prev ? { ...prev, standardLevel: v } : prev))} rows={8} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('senAdvancedHeading')}</h3>
                  <RichTextEditor value={senResult.advancedLevel} onChange={(v) => setSenResult((prev) => (prev ? { ...prev, advancedLevel: v } : prev))} rows={8} />
                  {senResult.senAdaptations && (
                    <>
                      <h3 className="text-base font-black mb-2 mt-6">{t('senAdaptationsHeading')}</h3>
                      <RichTextEditor value={senResult.senAdaptations} onChange={(v) => setSenResult((prev) => (prev ? { ...prev, senAdaptations: v } : prev))} rows={8} />
                    </>
                  )}
                  <div className="no-print">
                    <ExportBar
                      t={t}
                      sections={[
                        { heading: t('senBasicHeading'), body: senResult.basicLevel },
                        { heading: t('senStandardHeading'), body: senResult.standardLevel },
                        { heading: t('senAdvancedHeading'), body: senResult.advancedLevel },
                        ...(senResult.senAdaptations ? [{ heading: t('senAdaptationsHeading'), body: senResult.senAdaptations }] : []),
                      ]}
                      filenameBase="differentiated-task"
                      printAreaId="print-sen"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('senEmptyState')}</p>
              )}
            </div>
          </div>
        )}
        {/* Module 5: ESG lesson planner */}
        {tab === 'lessonPlan' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('lessonSubjectLabel')}</label>
                <input className={inputClass} value={lessonSubject} onChange={(e) => setLessonSubject(e.target.value)} placeholder={t('lessonSubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('lessonGradeLabel')}</label>
                <input className={inputClass} value={lessonGrade} onChange={(e) => setLessonGrade(e.target.value)} placeholder={t('lessonGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('lessonTopicLabel')}</label>
                <input className={inputClass} value={lessonTopic} onChange={(e) => setLessonTopic(e.target.value)} placeholder={t('lessonTopicPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('lessonDurationLabel')}</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  className={inputClass}
                  value={lessonDuration}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    setLessonDuration(Number.isFinite(parsed) ? Math.min(180, Math.max(5, parsed)) : 45);
                  }}
                  disabled={!hasAccess}
                />
              </div>
              <div>
                <label className={labelClass}>{t('lessonTypeLabel')}</label>
                <select className={inputClass} value={lessonType} onChange={(e) => setLessonType(e.target.value as LessonType)} disabled={!hasAccess}>
                  <option className={optionClass} value="STANDARD">{t('lessonTypeStandard')}</option>
                  <option className={optionClass} value="STEM">{t('lessonTypeStem')}</option>
                  <option className={optionClass} value="PROJECT_BASED">{t('lessonTypeProjectBased')}</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || lessonGenerating}
              onClick={handleGenerateLessonPlan}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
            >
              {lessonGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              {lessonGenerating ? t('lessonGenerating') : t('lessonGenerateButton')}
            </button>
            {lessonError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{lessonError}</p>}

            <div id="print-lesson" className="mt-6">
              {lessonResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('lessonOutputHeading')}</h3>
                  <RichTextEditor value={lessonResult.lessonPlan} onChange={(v) => setLessonResult({ lessonPlan: v })} rows={20} />
                  <div className="no-print">
                    <ExportBar t={t} sections={[{ heading: t('lessonOutputHeading'), body: lessonResult.lessonPlan }]} filenameBase="lesson-plan" printAreaId="print-lesson" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('lessonEmptyState')}</p>
              )}
            </div>
          </div>
        )}
        {/* Module 6: School bureaucracy & documentation */}
        {tab === 'bureaucracy' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('bureaucracyDocTypeLabel')}</label>
                <select className={inputClass} value={bureaucracyDocType} onChange={(e) => setBureaucracyDocType(e.target.value as BureaucracyDocumentType)} disabled={!hasAccess}>
                  <option className={optionClass} value="ACTIVITY_REPORT">{t('bureaucracyDocActivityReport')}</option>
                  <option className={optionClass} value="SELF_ASSESSMENT">{t('bureaucracyDocSelfAssessment')}</option>
                  <option className={optionClass} value="CLUB_PLAN">{t('bureaucracyDocClubPlan')}</option>
                  <option className={optionClass} value="PROJECT_APPLICATION">{t('bureaucracyDocProjectApplication')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('bureaucracySubjectLabel')}</label>
                <input className={inputClass} value={bureaucracySubject} onChange={(e) => setBureaucracySubject(e.target.value)} placeholder={t('bureaucracySubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('bureaucracyGradeLabel')}</label>
                <input className={inputClass} value={bureaucracyGrade} onChange={(e) => setBureaucracyGrade(e.target.value)} placeholder={t('bureaucracyGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('bureaucracyKeyPointsLabel')}</label>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={bureaucracyKeyPoints}
                  onChange={(e) => setBureaucracyKeyPoints(e.target.value)}
                  placeholder={t('bureaucracyKeyPointsPlaceholder')}
                  disabled={!hasAccess}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || bureaucracyGenerating}
              onClick={handleGenerateBureaucracyDoc}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
            >
              {bureaucracyGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderKanban className="w-4 h-4" />}
              {bureaucracyGenerating ? t('bureaucracyGenerating') : t('bureaucracyGenerateButton')}
            </button>
            {bureaucracyError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{bureaucracyError}</p>}

            <div id="print-bureaucracy" className="mt-6">
              {bureaucracyResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('bureaucracyOutputHeading')}</h3>
                  <RichTextEditor value={bureaucracyResult.document} onChange={(v) => setBureaucracyResult({ document: v })} rows={20} />
                  <div className="no-print">
                    <ExportBar t={t} sections={[{ heading: t('bureaucracyOutputHeading'), body: bureaucracyResult.document }]} filenameBase="school-document" printAreaId="print-bureaucracy" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('bureaucracyEmptyState')}</p>
              )}
            </div>
          </div>
        )}
        {/* Module 7: Student reports & parent letters */}
        {tab === 'parentReports' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('letterStudentNameLabel')}</label>
                <input className={inputClass} value={letterStudentName} onChange={(e) => setLetterStudentName(e.target.value)} placeholder={t('letterStudentNamePlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('letterGradeLabel')}</label>
                <input className={inputClass} value={letterGrade} onChange={(e) => setLetterGrade(e.target.value)} placeholder={t('letterGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('letterPurposeLabel')}</label>
                <select className={inputClass} value={letterPurpose} onChange={(e) => setLetterPurpose(e.target.value as ParentLetterPurpose)} disabled={!hasAccess}>
                  <option className={optionClass} value="PRAISE">{t('letterPurposePraise')}</option>
                  <option className={optionClass} value="ACADEMIC_IMPROVEMENT">{t('letterPurposeAcademicImprovement')}</option>
                  <option className={optionClass} value="BEHAVIORAL_NOTE">{t('letterPurposeBehavioralNote')}</option>
                  <option className={optionClass} value="ATTENDANCE">{t('letterPurposeAttendance')}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('letterTeacherNotesLabel')}</label>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={letterTeacherNotes}
                  onChange={(e) => setLetterTeacherNotes(e.target.value)}
                  placeholder={t('letterTeacherNotesPlaceholder')}
                  disabled={!hasAccess}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || letterGenerating}
              onClick={handleGenerateParentLetter}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
            >
              {letterGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {letterGenerating ? t('letterGenerating') : t('letterGenerateButton')}
            </button>
            {letterError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{letterError}</p>}

            <div id="print-letter" className="mt-6">
              {letterResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('letterOutputHeading')}</h3>
                  <RichTextEditor value={letterResult.letter} onChange={(v) => setLetterResult({ letter: v })} rows={14} />
                  <div className="no-print">
                    <ExportBar t={t} sections={[{ heading: t('letterOutputHeading'), body: letterResult.letter }]} filenameBase="parent-letter" printAreaId="print-letter" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('letterEmptyState')}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="no-print">
        <SiteFooter />
      </div>

      {/* Print mode: only the active module's #print-<tab> subtree stays
          visible — everything else (nav, forms, other tabs, buttons) is
          marked no-print or lives outside #print-<tab> entirely. The target
          id is written to document.body's data attribute by ExportBar's
          handlePrint right before window.print() fires. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          body[data-print-target='print-test'] #print-test,
          body[data-print-target='print-test'] #print-test *,
          body[data-print-target='print-rubric'] #print-rubric,
          body[data-print-target='print-rubric'] #print-rubric *,
          body[data-print-target='print-grading'] #print-grading,
          body[data-print-target='print-grading'] #print-grading *,
          body[data-print-target='print-sen'] #print-sen,
          body[data-print-target='print-sen'] #print-sen *,
          body[data-print-target='print-lesson'] #print-lesson,
          body[data-print-target='print-lesson'] #print-lesson *,
          body[data-print-target='print-bureaucracy'] #print-bureaucracy,
          body[data-print-target='print-bureaucracy'] #print-bureaucracy *,
          body[data-print-target='print-letter'] #print-letter,
          body[data-print-target='print-letter'] #print-letter * {
            visibility: visible;
          }
          #print-test,
          #print-rubric,
          #print-grading,
          #print-sen,
          #print-lesson,
          #print-bureaucracy,
          #print-letter {
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

export default function EducatorHubPage() {
  const { t } = useTranslation('educatorHub');
  return (
    <>
      {/* Rendered above ProtectedRoute — see english-tutor/index.tsx's
          identical comment for why: an unauthenticated crawler never
          renders EducatorHubContent at all. */}
      <SEOHead title={t('pageTitle')} description={t('pageSubtitle')} noIndex />
      <ProtectedRoute>
        <EducatorHubContent />
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['educatorHub'])) },
});
