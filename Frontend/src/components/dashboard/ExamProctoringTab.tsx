import { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import { ClipboardList, Plus, Trash2, Copy, Check, Lock, Unlock, Users, UploadCloud, Download, RefreshCw, ShieldAlert, FileText, Type, Video, Link2, Image as ImageIcon } from 'lucide-react';
import {
  getMyExamSessions,
  createExamSession,
  getExamSession,
  updateExamSessionStatus,
  deleteExamSession,
  parseExamSourceFile,
  parseExamSourceVideoFile,
  parseExamSourceYoutube,
  parseExamSourceImage,
  downloadExamReport,
  generateAdaptiveRetest,
  ExamSessionSummary,
  ExamSessionDetail,
  ExamSubmissionRow,
} from '../../services/examProctoringService';
import { SupportedLocale } from '../../utils/locale';

type SourceMode = 'file' | 'text' | 'video' | 'image';
type VideoSourceMode = 'youtube' | 'upload';

type SetupGuidePlatform = 'wordpress' | 'shopify' | 'html';
type QuestionPreset = 'quick' | 'standard' | 'deep';

const PRESET_COUNTS: Record<QuestionPreset, number> = { quick: 4, standard: 12, deep: 24 };

const dictBase = {
  ka: {
    title: 'AI გამოცდის პროქტორინგი',
    subtitle: 'შექმენით AI-გენერირებული სკრინინგ-გამოცდები კანდიდატებისთვის — უნიკალური ბმულით.',
    newExam: '+ ახალი გამოცდა',
    noExams: 'ჯერ არცერთი გამოცდა არ შეგიქმნიათ.',
    createFirst: 'შექმენით პირველი გამოცდა',
    examTitle: 'გამოცდის სახელი',
    topic: 'თემა / პოზიცია',
    topicPlaceholder: 'მაგ: Senior React დეველოპერი — hooks, state მართვა, წარმადობა',
    description: 'აღწერა (არასავალდებულო)',
    sourceUpload: 'წყარო მასალა (არასავალდებულო)',
    sourceUploadHint: 'AI გამოიყენებს ამ მასალას დამატებით კონტექსტად კითხვების გენერირებისას.',
    uploadFile: 'ფაილის ატვირთვა',
    uploadingFile: 'მუშავდება…',
    sourceAttached: 'მასალა მიბმულია ✓',
    sourceModeFile: 'ფაილი',
    sourceModeText: 'ტექსტი',
    sourceModeVideo: 'ვიდეო',
    sourceModeImage: 'სურათი',
    sourceTextPlaceholder: 'ჩასვით წყარო ტექსტი აქ — ვაკანსიის აღწერა, სასწავლო მასალა და ა.შ.',
    sourceVideoYoutubeTab: 'YouTube ბმული',
    sourceVideoUploadTab: 'ფაილის ატვირთვა',
    sourceVideoYoutubePlaceholder: 'https://www.youtube.com/watch?v=...',
    sourceVideoTranscribeButton: 'ტრანსკრიფციის გენერაცია',
    sourceVideoTranscribing: 'მუშავდება… (შეიძლება რამდენიმე წუთი დასჭირდეს)',
    sourceImageUploadCta: 'სურათის ატვირთვა',
    sourceImageHint: 'ფოტო სახელმძღვანელოდან, სლაიდი ან სამუშაო ფურცელი — AI ამოიღებს ტექსტს ხედვის მეშვეობით.',
    sourceImageProcessing: 'სურათის ანალიზი…',
    presetTitle: 'კითხვების რაოდენობა',
    presetQuick: 'სწრაფი ტესტი (3-5)',
    presetStandard: 'სტანდარტული (10-15)',
    presetDeep: 'ღრმა შეფასება (20+)',
    mcqCount: 'ტესტის კითხვების რაოდენობა',
    duration: 'ხანგრძლივობა (წუთი)',
    includeCode: 'დაამატე პროგრამირების კითხვა',
    create: 'გამოცდის გენერირება',
    creating: 'AI აგენერირებს კითხვებს…',
    cancel: 'გაუქმება',
    active: 'აქტიური',
    closed: 'დახურული',
    close: 'დახურვა',
    reopen: 'ხელახლა გახსნა',
    delete: 'წაშლა',
    deleteConfirm: 'დარწმუნებული ხართ, რომ გსურთ ამ გამოცდის წაშლა?',
    tabCandidate: 'კანდიდატის ბმული',
    tabEmbed: 'ჩაშენება',
    tabResults: 'შედეგები & ანალიტიკა',
    candidateLinkTitle: 'კანდიდატის ბმული',
    candidateLinkHint: 'გაუზიარეთ ეს ბმული კანდიდატებს პირდაპირ.',
    embedTitle: 'ჩაშენების კოდი',
    embedHint: 'ჩასვით ეს კოდი თქვენი კარიერის გვერდზე — გამოჩნდება "შეფასების გავლა" ღილაკი.',
    setupGuideTitle: 'დაყენებისა და ინტეგრაციის სახელმძღვანელო',
    setupWordpress: 'WordPress',
    setupShopify: 'Shopify',
    setupHtml: 'Custom HTML',
    setupWordpressSteps: [
      'WordPress ადმინ პანელში გადადით Appearance → Theme File Editor-ში.',
      'გახსენით footer.php და ჩასვით კოდი </body> ტეგის წინ.',
      'ან გამოიყენეთ "Insert Headers and Footers" ტიპის plugin.',
    ],
    setupShopifySteps: [
      'Shopify ადმინში გადადით Online Store → Themes → Edit Code-ზე.',
      'გახსენით theme.liquid ფაილი Layout საქაღალდეში.',
      'ჩასვით კოდი </body> ტეგის წინ და შეინახეთ.',
    ],
    setupHtmlSteps: [
      'გახსენით თქვენი საიტის HTML ფაილი ან CMS-ის template რედაქტორი.',
      'იპოვეთ დახურვის </body> ტეგი გვერდის ბოლოში.',
      'ჩასვით კოდი პირდაპირ </body> ტეგის წინ.',
    ],
    copy: 'კოპირება',
    copied: 'დაკოპირდა ✓',
    submissionsTitle: 'კანდიდატების შედეგები',
    noSubmissions: 'ჯერ არცერთ კანდიდატს არ ჩაუბარებია.',
    mcqScore: 'ტესტი',
    practicalScore: 'პრაქტიკული',
    totalScore: 'ჯამური',
    integrityScore: 'მთლიანობის ქულა',
    tabSwitches: 'ტაბის გადართვა',
    copyPasteCount: 'კოპირება/ჩასმა',
    cameraAudioViolations: 'კამერა/მიკროფონის დარღვევა',
    aiTextScore: 'AI-ტექსტის ალბათობა',
    status: 'სტატუსი',
    inProgress: 'მიმდინარეობს',
    completed: 'დასრულებული',
    flagged: 'მონიშნული (დარღვევა)',
    aiFeedback: 'AI შეფასება',
    downloadReport: 'PDF ანგარიშის ჩამოტვირთვა',
    downloading: 'იტვირთება…',
    generateRetest: 'ადაპტური Retest-ის გენერირება',
    generatingRetest: 'გენერირდება…',
    retestGenerated: 'Retest შექმნილია — იხილეთ ახალი გამოცდა სიაში.',
    studyGuideTitle: 'ადაპტური სასწავლო გზამკვლევი',
    weakTopics: 'გასაუმჯობესებელი თემები',
    noStudyGuide: 'ამ კანდიდატისთვის ჯერ არ არის გენერირებული სასწავლო გზამკვლევი (ქულა საკმარისად მაღალი იყო ან ჯერ არ დასრულებულა).',
    genericError: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
  },
  en: {
    title: 'AI Exam Proctoring',
    subtitle: 'Create AI-generated candidate screening exams — each with a unique link.',
    newExam: '+ New Exam',
    noExams: "You haven't created any exams yet.",
    createFirst: 'Create your first exam',
    examTitle: 'Exam Title',
    topic: 'Topic / Role',
    topicPlaceholder: 'e.g. Senior React Developer — hooks, state management, performance',
    description: 'Description (optional)',
    sourceUpload: 'Source Material (optional)',
    sourceUploadHint: 'AI will use this material as extra context when generating questions.',
    uploadFile: 'Upload File',
    uploadingFile: 'Processing…',
    sourceAttached: 'Material attached ✓',
    sourceModeFile: 'File',
    sourceModeText: 'Text',
    sourceModeVideo: 'Video',
    sourceModeImage: 'Image',
    sourceTextPlaceholder: 'Paste source text here — a job description, study material, etc.',
    sourceVideoYoutubeTab: 'YouTube Link',
    sourceVideoUploadTab: 'Upload File',
    sourceVideoYoutubePlaceholder: 'https://www.youtube.com/watch?v=...',
    sourceVideoTranscribeButton: 'Generate Transcript',
    sourceVideoTranscribing: 'Processing… (this can take a few minutes)',
    sourceImageUploadCta: 'Upload Image',
    sourceImageHint: 'A textbook photo, slide, or worksheet — AI will extract the text via vision.',
    sourceImageProcessing: 'Analyzing image…',
    presetTitle: 'Question Count',
    presetQuick: 'Quick Quiz (3-5)',
    presetStandard: 'Standard (10-15)',
    presetDeep: 'Deep Assessment (20+)',
    mcqCount: 'Multiple-choice question count',
    duration: 'Duration (minutes)',
    includeCode: 'Add a coding question',
    create: 'Generate Exam',
    creating: 'AI is generating questions…',
    cancel: 'Cancel',
    active: 'Active',
    closed: 'Closed',
    close: 'Close',
    reopen: 'Reopen',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this exam?',
    tabCandidate: 'Candidate Link',
    tabEmbed: 'Embed & Share',
    tabResults: 'Results & Analytics',
    candidateLinkTitle: 'Candidate Link',
    candidateLinkHint: 'Share this link with candidates directly.',
    embedTitle: 'Embed Script',
    embedHint: 'Paste this on your careers page — renders a "Take Assessment" button.',
    setupGuideTitle: 'Setup & Integration Guide',
    setupWordpress: 'WordPress',
    setupShopify: 'Shopify',
    setupHtml: 'Custom HTML',
    setupWordpressSteps: [
      'In your WordPress admin, go to Appearance → Theme File Editor.',
      'Open footer.php and paste the snippet right before the closing </body> tag.',
      'Or use a plugin like "Insert Headers and Footers".',
    ],
    setupShopifySteps: [
      'In your Shopify admin, go to Online Store → Themes → Edit Code.',
      'Open theme.liquid inside the Layout folder.',
      'Paste the snippet right before the closing </body> tag and save.',
    ],
    setupHtmlSteps: [
      "Open your site's HTML file or your CMS's template editor.",
      'Find the closing </body> tag near the bottom of the page.',
      'Paste the snippet directly before </body>.',
    ],
    copy: 'Copy',
    copied: 'Copied ✓',
    submissionsTitle: 'Candidate Reports',
    noSubmissions: 'No candidates have taken this exam yet.',
    mcqScore: 'MCQ',
    practicalScore: 'Practical',
    totalScore: 'Total',
    integrityScore: 'Integrity Score',
    tabSwitches: 'Tab Switches',
    copyPasteCount: 'Copy/Paste',
    cameraAudioViolations: 'Camera/Mic Violations',
    aiTextScore: 'AI-Written Likelihood',
    status: 'Status',
    inProgress: 'In Progress',
    completed: 'Completed',
    flagged: 'Flagged (violation)',
    aiFeedback: 'AI Feedback',
    downloadReport: 'Download PDF Report',
    downloading: 'Downloading…',
    generateRetest: 'Generate Adaptive Retest',
    generatingRetest: 'Generating…',
    retestGenerated: 'Retest created — see the new exam in the list.',
    studyGuideTitle: 'Adaptive Study Guide',
    weakTopics: 'Areas to Improve',
    noStudyGuide: "No study guide generated for this candidate yet (score was high enough, or the attempt isn't complete).",
    genericError: 'Something went wrong. Please try again.',
  },
};

// English fallback for locales without a translation yet.
const dict: Record<SupportedLocale, typeof dictBase.en> = {
  ...dictBase,
  de: dictBase.en,
  es: dictBase.en,
  fr: dictBase.en,
  uk: dictBase.en,
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  CLOSED: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
};
const SUBMISSION_BADGE: Record<string, string> = {
  IN_PROGRESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  FLAGGED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
};

const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5';

const emptyForm = { title: '', topic: '', description: '', mcqCount: 5, durationMinutes: 30, includeCodeQuestion: false, rawContent: '' };

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

function SubmissionCard({ sub, t, onError }: { sub: ExamSubmissionRow; t: typeof dict[SupportedLocale]; onError: (msg: string) => void }) {
  const [downloading, setDownloading] = useState(false);
  const [generatingRetest, setGeneratingRetest] = useState(false);
  const [retestDone, setRetestDone] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadExamReport(sub.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-report-${sub.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      onError(t.genericError);
    } finally {
      setDownloading(false);
    }
  };

  const handleGenerateRetest = async () => {
    setGeneratingRetest(true);
    try {
      await generateAdaptiveRetest(sub.id);
      setRetestDone(true);
    } catch (err: any) {
      onError(err?.response?.data?.message ?? t.genericError);
    } finally {
      setGeneratingRetest(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-white">{sub.candidateName}</p>
          <p className="text-[11px] text-slate-400">{sub.candidateEmail}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${SUBMISSION_BADGE[sub.status]}`}>
          {sub.status === 'IN_PROGRESS' ? t.inProgress : sub.status === 'FLAGGED' ? t.flagged : t.completed}
        </span>
      </div>
      {sub.status !== 'IN_PROGRESS' && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-center mb-2">
            <div>
              <p className="text-[10px] text-slate-400">{t.mcqScore}</p>
              <p className="text-sm font-black">{sub.mcqScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">{t.practicalScore}</p>
              <p className="text-sm font-black">{sub.practicalScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">{t.totalScore}</p>
              <p className="text-sm font-black text-cyan-600 dark:text-cyan-400">{sub.totalScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">{t.integrityScore}</p>
              <p className="text-sm font-black">{sub.integrityScore ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">{t.tabSwitches}/{t.copyPasteCount}</p>
              <p className="text-sm font-black">{sub.tabSwitches}/{sub.copyPasteCount}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">{t.cameraAudioViolations}</p>
              <p className="text-sm font-black">{sub.cameraAudioViolations}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">{t.aiTextScore}</p>
              <p className="text-sm font-black">{sub.aiTextScore != null ? `${sub.aiTextScore}%` : '—'}</p>
            </div>
          </div>
          {sub.aiEvaluation && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-3">
              {t.aiFeedback}: {sub.aiEvaluation}
            </p>
          )}

          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3 mb-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1.5">{t.studyGuideTitle}</p>
            {sub.studyGuide ? (
              <>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">{t.weakTopics}:</p>
                <ul className="list-disc list-inside text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {sub.studyGuide.weakTopics.map((topic, i) => (
                    <li key={i}>{topic}</li>
                  ))}
                </ul>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{sub.studyGuide.generatedGuideText}</p>
                {sub.studyGuide.retestExamSessionId && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-2">{t.retestGenerated}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400">{t.noStudyGuide}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? t.downloading : t.downloadReport}
            </button>
            {sub.studyGuide && !sub.studyGuide.retestExamSessionId && !retestDone && (
              <button
                type="button"
                onClick={handleGenerateRetest}
                disabled={generatingRetest}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {generatingRetest ? t.generatingRetest : t.generateRetest}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ExamProctoringTab({ lang }: { lang: SupportedLocale }) {
  const t = dict[lang];
  const [sessions, setSessions] = useState<ExamSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExamSessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<'candidate' | 'embed' | 'results'>('candidate');
  const [setupPlatform, setSetupPlatform] = useState<SetupGuidePlatform>('wordpress');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [preset, setPreset] = useState<QuestionPreset>('standard');
  const [sourceMode, setSourceMode] = useState<SourceMode>('file');
  const [videoSourceMode, setVideoSourceMode] = useState<VideoSourceMode>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadingSource, setUploadingSource] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyExamSessions();
      setSessions(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch {
      setActionError(t.genericError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    getExamSession(selectedId)
      .then(setDetail)
      .catch(() => setActionError(t.genericError))
      .finally(() => setLoadingDetail(false));
  }, [selectedId, t.genericError]);

  const handlePresetClick = (p: QuestionPreset) => {
    setPreset(p);
    setCreateForm((f) => ({ ...f, mcqCount: PRESET_COUNTS[p] }));
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSource(true);
    setCreateError(null);
    try {
      const rawContent = await parseExamSourceFile(file);
      setCreateForm((f) => ({ ...f, rawContent }));
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'Unable to parse this file.');
    } finally {
      setUploadingSource(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVideoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSource(true);
    setCreateError(null);
    try {
      const rawContent = await parseExamSourceVideoFile(file);
      setCreateForm((f) => ({ ...f, rawContent }));
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'Unable to transcribe this video.');
    } finally {
      setUploadingSource(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleTranscribeYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    setUploadingSource(true);
    setCreateError(null);
    try {
      const rawContent = await parseExamSourceYoutube(youtubeUrl.trim());
      setCreateForm((f) => ({ ...f, rawContent }));
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'Unable to transcribe this video.');
    } finally {
      setUploadingSource(false);
    }
  };

  const handleImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSource(true);
    setCreateError(null);
    try {
      const rawContent = await parseExamSourceImage(file);
      setCreateForm((f) => ({ ...f, rawContent }));
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'Unable to analyze this image.');
    } finally {
      setUploadingSource(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const session = await createExamSession({
        title: createForm.title,
        topic: createForm.topic,
        description: createForm.description || undefined,
        rawContent: createForm.rawContent || undefined,
        mcqCount: createForm.mcqCount,
        includeCodeQuestion: createForm.includeCodeQuestion,
        durationMinutes: createForm.durationMinutes,
      });
      await loadSessions();
      setSelectedId(session.id);
      setShowCreateForm(false);
      setCreateForm(emptyForm);
      setSourceMode('file');
      setVideoSourceMode('youtube');
      setYoutubeUrl('');
    } catch (err: any) {
      setCreateError(err?.response?.data?.message ?? 'Unable to create exam.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!detail) return;
    setActionError(null);
    try {
      const nextStatus = detail.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
      await updateExamSessionStatus(detail.id, nextStatus);
      const fresh = await getExamSession(detail.id);
      setDetail(fresh);
      setSessions((prev) => prev.map((s) => (s.id === fresh.id ? { ...s, status: fresh.status } : s)));
    } catch {
      setActionError(t.genericError);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    if (!window.confirm(t.deleteConfirm)) return;
    setActionError(null);
    try {
      await deleteExamSession(detail.id);
      setSessions((prev) => prev.filter((s) => s.id !== detail.id));
      setSelectedId(null);
    } catch {
      setActionError(t.genericError);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cdc.org.ge';
  const candidateUrl = detail ? `${origin}/exam/${detail.candidateToken}` : '';
  const embedSnippet = detail
    ? `<script src="${origin}/exam-widget.js" data-exam-token="${detail.candidateToken}" defer></script>`
    : '';

  return (
    <div id="exam-proctoring" className="mb-10 scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-lg font-black tracking-wide flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          {t.title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
      </div>

      {actionError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium px-4 py-2.5 mb-4 flex items-center justify-between gap-3">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="text-red-500/70 hover:text-red-500 font-bold">
            ×
          </button>
        </div>
      )}

      {sessions.length === 0 && !showCreateForm ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-12 text-center">
          <ClipboardList className="w-10 h-10 text-cyan-500 mx-auto mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.noExams}</p>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.createFirst}
          </button>
        </div>
      ) : showCreateForm ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 space-y-4 max-w-lg">
          {createError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{createError}</div>}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className={labelClass}>{t.examTitle}</label>
              <input required className={inputClass} value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t.topic}</label>
              <textarea
                required
                rows={2}
                className={inputClass}
                value={createForm.topic}
                onChange={(e) => setCreateForm({ ...createForm, topic: e.target.value })}
                placeholder={t.topicPlaceholder}
              />
            </div>
            <div>
              <label className={labelClass}>{t.description}</label>
              <textarea rows={2} className={inputClass} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </div>

            <div>
              <label className={labelClass}>{t.sourceUpload}</label>
              <p className="text-[11px] text-slate-400 mb-2">{t.sourceUploadHint}</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {([
                  ['file', t.sourceModeFile, FileText],
                  ['text', t.sourceModeText, Type],
                  ['video', t.sourceModeVideo, Video],
                  ['image', t.sourceModeImage, ImageIcon],
                ] as [SourceMode, string, typeof FileText][]).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSourceMode(mode)}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                      sourceMode === mode
                        ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {sourceMode === 'file' && (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 flex items-center gap-3">
                <UploadCloud className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
                  {createForm.rawContent ? t.sourceAttached : ' '}
                </div>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 shrink-0">
                  {uploadingSource ? t.uploadingFile : t.uploadFile}
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.md,.txt" onChange={handleFileChange} className="hidden" disabled={uploadingSource} />
                </label>
              </div>
              )}

              {sourceMode === 'text' && (
                <textarea
                  rows={4}
                  className={inputClass}
                  value={createForm.rawContent}
                  onChange={(e) => setCreateForm({ ...createForm, rawContent: e.target.value })}
                  placeholder={t.sourceTextPlaceholder}
                />
              )}

              {sourceMode === 'video' && (
                <div>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setVideoSourceMode('youtube')}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                        videoSourceMode === 'youtube' ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {t.sourceVideoYoutubeTab}
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoSourceMode('upload')}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${
                        videoSourceMode === 'upload' ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30' : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      {t.sourceVideoUploadTab}
                    </button>
                  </div>
                  {videoSourceMode === 'youtube' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        className={inputClass}
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder={t.sourceVideoYoutubePlaceholder}
                        disabled={uploadingSource}
                      />
                      <button
                        type="button"
                        onClick={handleTranscribeYoutube}
                        disabled={uploadingSource || !youtubeUrl.trim()}
                        className="shrink-0 rounded-lg bg-slate-900 dark:bg-cyan-600 text-white text-xs font-bold px-3 py-2.5 disabled:opacity-50"
                      >
                        {t.sourceVideoTranscribeButton}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 flex items-center gap-3">
                      <UploadCloud className="w-5 h-5 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
                        {createForm.rawContent ? t.sourceAttached : ' '}
                      </div>
                      <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 shrink-0">
                        {t.uploadFile}
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/*,audio/*,.mp4,.mov,.webm,.mp3,.wav,.m4a"
                          onChange={handleVideoFileChange}
                          className="hidden"
                          disabled={uploadingSource}
                        />
                      </label>
                    </div>
                  )}
                  {uploadingSource && <p className="text-[11px] text-slate-400 mt-2">{t.sourceVideoTranscribing}</p>}
                </div>
              )}

              {sourceMode === 'image' && (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
                    {uploadingSource ? t.sourceImageProcessing : createForm.rawContent ? t.sourceAttached : t.sourceImageHint}
                  </div>
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 shrink-0">
                    {uploadingSource ? t.uploadingFile : t.sourceImageUploadCta}
                    <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" disabled={uploadingSource} />
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>{t.presetTitle}</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {(['quick', 'standard', 'deep'] as QuestionPreset[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetClick(p)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                      preset === p ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {p === 'quick' ? t.presetQuick : p === 'standard' ? t.presetStandard : t.presetDeep}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t.mcqCount}</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  required
                  className={inputClass}
                  value={createForm.mcqCount}
                  onChange={(e) => setCreateForm({ ...createForm, mcqCount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>{t.duration}</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  required
                  className={inputClass}
                  value={createForm.durationMinutes}
                  onChange={(e) => setCreateForm({ ...createForm, durationMinutes: Number(e.target.value) })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={createForm.includeCodeQuestion}
                onChange={(e) => setCreateForm({ ...createForm, includeCodeQuestion: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700"
              />
              {t.includeCode}
            </label>

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                {t.cancel}
              </button>
              <button type="submit" disabled={creating || uploadingSource} className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {creating ? t.creating : t.create}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(s.id);
                    setDetailTab('candidate');
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                    selectedId === s.id ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent' : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  {s.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.newExam}
            </button>
          </div>

          {loadingDetail ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : detail ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${STATUS_BADGE[detail.status]}`}>
                  {detail.status === 'ACTIVE' ? t.active : t.closed}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {detail.submissions.length}
                </span>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                >
                  {detail.status === 'ACTIVE' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {detail.status === 'ACTIVE' ? t.close : t.reopen}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t.delete}
                </button>
              </div>

              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                {([
                  ['candidate', t.tabCandidate],
                  ['embed', t.tabEmbed],
                  ['results', t.tabResults],
                ] as [typeof detailTab, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDetailTab(key)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                      detailTab === key ? 'bg-slate-900 dark:bg-cyan-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {detailTab === 'candidate' && (
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 space-y-3">
                  <h3 className="text-sm font-black tracking-wide">{t.candidateLinkTitle}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.candidateLinkHint}</p>
                  <pre className="rounded-lg bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto"><code>{candidateUrl}</code></pre>
                  <CopyButton text={candidateUrl} label={t.copy} copiedLabel={t.copied} />
                </div>
              )}

              {detailTab === 'embed' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6 space-y-3">
                    <h3 className="text-sm font-black tracking-wide">{t.embedTitle}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.embedHint}</p>
                    <pre className="rounded-lg bg-slate-950 text-slate-100 p-4 text-xs overflow-x-auto"><code>{embedSnippet}</code></pre>
                    <CopyButton text={embedSnippet} label={t.copy} copiedLabel={t.copied} />
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6">
                    <h3 className="text-sm font-black tracking-wide mb-4">{t.setupGuideTitle}</h3>
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
                      {([
                        ['wordpress', t.setupWordpress],
                        ['shopify', t.setupShopify],
                        ['html', t.setupHtml],
                      ] as [SetupGuidePlatform, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSetupPlatform(key)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                            setupPlatform === key ? 'bg-slate-900 dark:bg-cyan-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <ol className="space-y-2.5 list-decimal list-inside">
                      {(setupPlatform === 'wordpress' ? t.setupWordpressSteps : setupPlatform === 'shopify' ? t.setupShopifySteps : t.setupHtmlSteps).map((step) => (
                        <li key={step} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {detailTab === 'results' && (
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none p-6">
                  <h3 className="text-sm font-black tracking-wide mb-4 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-slate-400" />
                    {t.submissionsTitle}
                  </h3>
                  {detail.submissions.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t.noSubmissions}</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.submissions.map((sub) => (
                        <SubmissionCard key={sub.id} sub={sub} t={t} onError={setActionError} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
