import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ShieldAlert, Clock, CheckCircle2, AlertTriangle, Camera, Mic, Loader2, Circle } from 'lucide-react';
import {
  getCandidateExamInfo,
  startCandidateExam,
  resumeCandidateExam,
  submitCandidateExam,
  logProctoringEvent,
  CandidateExamInfo,
  ExamQuestionRow,
  ProctoringEventType,
  CandidateResults,
  getCandidateResults,
} from '../../src/services/examProctoringService';
import { resolveLocale } from '@/src/utils/locale';
import ExamResultsView from '@/src/components/exam/ExamResultsView';

// Same anti-cheat mechanism as pages/freelancer/exam.tsx's registerStrike —
// tab-switch / window-blur / fullscreen-exit strikes, auto-submitting (here,
// flagging rather than failing, since this is a screening tool for the
// business, not a self-credentialing exam) once the limit is hit.
const MAX_STRIKES = 3;

// ============================================================
// Camera-feed face detection — loaded lazily, client-only, from the
// long-standing community CDN hosting for face-api.js's tiny face detector
// model (the npm package itself ships only compiled JS, not the model
// weight files — see the backend PR/commit note for the same reasoning
// applied to this feature). A production deployment that wants to avoid
// depending on external hosting could self-host these same files under
// public/models/ instead and point MODEL_URL at that path unchanged.
// ============================================================
const FACE_API_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const FACE_API_MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const FACE_CHECK_INTERVAL_MS = 3000;
const LOOKING_AWAY_OFFSET_RATIO = 0.32; // face-center offset from frame-center, as a fraction of frame width/height
const AUDIO_CHECK_INTERVAL_MS = 400;
const AUDIO_VOLUME_THRESHOLD = 0.12; // 0-1 RMS scale, tuned for "clearly audible talking" vs. normal room noise
const AUDIO_STRIKE_COOLDOWN_MS = 8000; // sustained/repeated talking shouldn't spam a strike every 400ms

let faceApiScriptPromise: Promise<void> | null = null;
function loadFaceApiScript(): Promise<void> {
  if ((window as any).faceapi) return Promise.resolve();
  if (!faceApiScriptPromise) {
    faceApiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = FACE_API_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load face-api.js'));
      document.head.appendChild(script);
    });
  }
  return faceApiScriptPromise;
}

let faceApiModelsPromise: Promise<void> | null = null;
// Face detection is a best-effort enhancement layered on top of the hard
// camera/mic permission gate below, not a requirement to start the exam —
// a script/CDN load failure here degrades to "camera is on but unmonitored
// for face presence," never blocks the candidate.
async function ensureFaceApiReady(): Promise<void> {
  await loadFaceApiScript();
  const faceapi = (window as any).faceapi;
  if (!faceApiModelsPromise) {
    faceApiModelsPromise = faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL);
  }
  await faceApiModelsPromise;
}

type Phase = 'landing' | 'starting' | 'in-progress' | 'submitting' | 'done' | 'error';

// The in-progress attempt (submission token + answers so far) is kept in
// this browser so an accidental refresh / closed tab can continue the SAME
// attempt — same questions, same shuffled layout, same server-side timer —
// instead of losing everything. Wrapped in try/catch: storage can be
// unavailable (private mode, blocked site data) and the exam must still work.
interface SavedAttempt {
  submissionToken: string;
  answers: Record<string, string>;
}
const storageKey = (examToken: string) => `cdc-exam-attempt:${examToken}`;
function readSavedAttempt(examToken: string): SavedAttempt | null {
  try {
    const raw = window.localStorage.getItem(storageKey(examToken));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.submissionToken === 'string' ? { submissionToken: parsed.submissionToken, answers: parsed.answers ?? {} } : null;
  } catch {
    return null;
  }
}
function writeSavedAttempt(examToken: string, attempt: SavedAttempt) {
  try {
    window.localStorage.setItem(storageKey(examToken), JSON.stringify(attempt));
  } catch {
    // ignore — resume just won't be available
  }
}
function clearSavedAttempt(examToken: string) {
  try {
    window.localStorage.removeItem(storageKey(examToken));
  } catch {
    // ignore
  }
}

const dict = {
  ka: {
    loadFailed: 'ეს გამოცდის ბმული აღარ არის აქტიური.',
    name: 'სახელი, გვარი',
    email: 'ელ. ფოსტა',
    start: 'გამოცდის დაწყება',
    starting: 'იწყება…',
    duration: (m: number) => `ხანგრძლივობა: ${m} წუთი`,
    submit: 'დასრულება და გაგზავნა',
    submitting: 'იგზავნება…',
    doneTitle: 'გმადლობთ!',
    doneBody: 'თქვენი პასუხები წარმატებით გაიგზავნა. შედეგებს გამოცდის ორგანიზატორი (მასწავლებელი) გაგიზიარებთ.',
    warningNote: (n: number) => `⚠️ დარღვევა შეინიშნა (${n}/${MAX_STRIKES}). კიდევ ერთი და გამოცდა ავტომატურად დასრულდება.`,
    proctoringNotice: `ტაბის გადართვა, ფოკუსის დაკარგვა, ტექსტის ჩასმა ან სრულეკრანიანი რეჟიმიდან გამოსვლა ითვლება დარღვევად — ${MAX_STRIKES} დარღვევის შემთხვევაში გამოცდა ავტომატურად წყდება. კამერა და მიკროფონი აკვირდება სახესა და ხმას — ეს ჩანიშნება მასწავლებლისთვის, მაგრამ გამოცდას არ წყვეტს.`,
    practicalPlaceholder: 'დაწერეთ თქვენი პასუხი აქ…',
    codePlaceholder: '// დაწერეთ თქვენი კოდი აქ…',
    errorGeneric: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
    cameraMicLabel: 'კამერა & მიკროფონი',
    cameraMicHint: 'გამოცდის დაწყებამდე საჭიროა კამერასა და მიკროფონზე წვდომის დართვა — ეს სავალდებულოა.',
    cameraMicAllow: 'კამერისა და მიკროფონის ჩართვა',
    cameraMicChecking: 'ინიშნება…',
    cameraMicDenied: 'წვდომა უარყოფილია. გამოცდის დასაწყებად საჭიროა კამერისა და მიკროფონის ჩართვა ბრაუზერის პარამეტრებში.',
    cameraMicLive: '✓ კამერა და მიკროფონი აქტიურია',
    examDate: 'თარიღი',
    warningFaceMissing: '⚠️ სახე არ ჩანს კადრში',
    warningMultipleFaces: '⚠️ კადრში რამდენიმე ადამიანია',
    warningLookingAway: '⚠️ გთხოვთ, შეხედოთ ეკრანს',
    warningBackgroundVoice: '⚠️ ფონური ხმა/საუბარი აღმოჩენილია',
    warningFullscreenExit: '⚠️ სრულეკრანიანი რეჟიმიდან გამოსვლა',
    softWarningSuffix: 'ეს ჩანიშნება მასწავლებლისთვის.',
    resumeTitle: 'თქვენ უკვე დაიწყეთ ეს გამოცდა ამ მოწყობილობაზე.',
    resumeCta: 'გამოცდის გაგრძელება',
    resumeFailed: 'წინა მცდელობის გაგრძელება ვერ მოხერხდა — შეგიძლიათ დაიწყოთ თავიდან.',
    submitFailed: 'პასუხების გაგზავნა ვერ მოხერხდა (ინტერნეტი?). პასუხები შენახულია — დააჭირეთ „დასრულება და გაგზავნა“ კიდევ ერთხელ.',
    answeredCount: (a: number, n: number) => `პასუხი გაცემულია: ${a}/${n}`,
    resultsNotice: 'დასრულებისთანავე ნახავთ ქულას და ყველა პასუხს ახსნით. იგივე გამოგეგზავნებათ აქ მითითებულ ელ. ფოსტაზე.',
  },
  en: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The exam organizer will share the results with you.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, pasting, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam. Camera and microphone signals are recorded for the organizer but do not end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
    cameraMicLabel: 'Camera & Microphone',
    cameraMicHint: 'Camera and microphone access is required before you can start the exam.',
    cameraMicAllow: 'Enable Camera & Microphone',
    cameraMicChecking: 'Checking…',
    cameraMicDenied: 'Access denied. Enable camera and microphone permissions in your browser settings to start the exam.',
    cameraMicLive: '✓ Camera and microphone are live',
    examDate: 'Date',
    warningFaceMissing: '⚠️ Face not visible in frame',
    warningMultipleFaces: '⚠️ Multiple people detected in frame',
    warningLookingAway: '⚠️ Please look at the screen',
    warningBackgroundVoice: '⚠️ Background voice/talking detected',
    warningFullscreenExit: '⚠️ Exited fullscreen mode',
    softWarningSuffix: 'This is noted for the organizer.',
    resumeTitle: 'You already started this exam on this device.',
    resumeCta: 'Continue Exam',
    resumeFailed: 'Could not continue the previous attempt — you can start again.',
    submitFailed: 'Could not submit your answers (internet?). Your answers are saved — press "Finish & Submit" again.',
    answeredCount: (a: number, n: number) => `Answered: ${a}/${n}`,
    resultsNotice: 'When you finish you will see your score and every answer with an explanation. The same results are emailed to the address you enter here.',
  },
  de: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The exam organizer will share the results with you.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, pasting, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam. Camera and microphone signals are recorded for the organizer but do not end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
    cameraMicLabel: 'Camera & Microphone',
    cameraMicHint: 'Camera and microphone access is required before you can start the exam.',
    cameraMicAllow: 'Enable Camera & Microphone',
    cameraMicChecking: 'Checking…',
    cameraMicDenied: 'Access denied. Enable camera and microphone permissions in your browser settings to start the exam.',
    cameraMicLive: '✓ Camera and microphone are live',
    examDate: 'Date',
    warningFaceMissing: '⚠️ Face not visible in frame',
    warningMultipleFaces: '⚠️ Multiple people detected in frame',
    warningLookingAway: '⚠️ Please look at the screen',
    warningBackgroundVoice: '⚠️ Background voice/talking detected',
    warningFullscreenExit: '⚠️ Exited fullscreen mode',
    softWarningSuffix: 'This is noted for the organizer.',
    resumeTitle: 'You already started this exam on this device.',
    resumeCta: 'Continue Exam',
    resumeFailed: 'Could not continue the previous attempt — you can start again.',
    submitFailed: 'Could not submit your answers (internet?). Your answers are saved — press "Finish & Submit" again.',
    answeredCount: (a: number, n: number) => `Answered: ${a}/${n}`,
    resultsNotice: 'When you finish you will see your score and every answer with an explanation. The same results are emailed to the address you enter here.',
  },
  es: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The exam organizer will share the results with you.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, pasting, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam. Camera and microphone signals are recorded for the organizer but do not end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
    cameraMicLabel: 'Camera & Microphone',
    cameraMicHint: 'Camera and microphone access is required before you can start the exam.',
    cameraMicAllow: 'Enable Camera & Microphone',
    cameraMicChecking: 'Checking…',
    cameraMicDenied: 'Access denied. Enable camera and microphone permissions in your browser settings to start the exam.',
    cameraMicLive: '✓ Camera and microphone are live',
    examDate: 'Date',
    warningFaceMissing: '⚠️ Face not visible in frame',
    warningMultipleFaces: '⚠️ Multiple people detected in frame',
    warningLookingAway: '⚠️ Please look at the screen',
    warningBackgroundVoice: '⚠️ Background voice/talking detected',
    warningFullscreenExit: '⚠️ Exited fullscreen mode',
    softWarningSuffix: 'This is noted for the organizer.',
    resumeTitle: 'You already started this exam on this device.',
    resumeCta: 'Continue Exam',
    resumeFailed: 'Could not continue the previous attempt — you can start again.',
    submitFailed: 'Could not submit your answers (internet?). Your answers are saved — press "Finish & Submit" again.',
    answeredCount: (a: number, n: number) => `Answered: ${a}/${n}`,
    resultsNotice: 'When you finish you will see your score and every answer with an explanation. The same results are emailed to the address you enter here.',
  },
  fr: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The exam organizer will share the results with you.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, pasting, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam. Camera and microphone signals are recorded for the organizer but do not end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
    cameraMicLabel: 'Camera & Microphone',
    cameraMicHint: 'Camera and microphone access is required before you can start the exam.',
    cameraMicAllow: 'Enable Camera & Microphone',
    cameraMicChecking: 'Checking…',
    cameraMicDenied: 'Access denied. Enable camera and microphone permissions in your browser settings to start the exam.',
    cameraMicLive: '✓ Camera and microphone are live',
    examDate: 'Date',
    warningFaceMissing: '⚠️ Face not visible in frame',
    warningMultipleFaces: '⚠️ Multiple people detected in frame',
    warningLookingAway: '⚠️ Please look at the screen',
    warningBackgroundVoice: '⚠️ Background voice/talking detected',
    warningFullscreenExit: '⚠️ Exited fullscreen mode',
    softWarningSuffix: 'This is noted for the organizer.',
    resumeTitle: 'You already started this exam on this device.',
    resumeCta: 'Continue Exam',
    resumeFailed: 'Could not continue the previous attempt — you can start again.',
    submitFailed: 'Could not submit your answers (internet?). Your answers are saved — press "Finish & Submit" again.',
    answeredCount: (a: number, n: number) => `Answered: ${a}/${n}`,
    resultsNotice: 'When you finish you will see your score and every answer with an explanation. The same results are emailed to the address you enter here.',
  },
  uk: {
    loadFailed: 'This exam link is no longer active.',
    name: 'Full Name',
    email: 'Email',
    start: 'Start Exam',
    starting: 'Starting…',
    duration: (m: number) => `Duration: ${m} minutes`,
    submit: 'Finish & Submit',
    submitting: 'Submitting…',
    doneTitle: 'Thank you!',
    doneBody: 'Your answers were submitted successfully. The exam organizer will share the results with you.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, pasting, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam. Camera and microphone signals are recorded for the organizer but do not end the exam.`,
    practicalPlaceholder: 'Write your answer here…',
    codePlaceholder: '// Write your code here…',
    errorGeneric: 'Something went wrong. Please try again.',
    cameraMicLabel: 'Camera & Microphone',
    cameraMicHint: 'Camera and microphone access is required before you can start the exam.',
    cameraMicAllow: 'Enable Camera & Microphone',
    cameraMicChecking: 'Checking…',
    cameraMicDenied: 'Access denied. Enable camera and microphone permissions in your browser settings to start the exam.',
    cameraMicLive: '✓ Camera and microphone are live',
    examDate: 'Date',
    warningFaceMissing: '⚠️ Face not visible in frame',
    warningMultipleFaces: '⚠️ Multiple people detected in frame',
    warningLookingAway: '⚠️ Please look at the screen',
    warningBackgroundVoice: '⚠️ Background voice/talking detected',
    warningFullscreenExit: '⚠️ Exited fullscreen mode',
    softWarningSuffix: 'This is noted for the organizer.',
    resumeTitle: 'You already started this exam on this device.',
    resumeCta: 'Continue Exam',
    resumeFailed: 'Could not continue the previous attempt — you can start again.',
    submitFailed: 'Could not submit your answers (internet?). Your answers are saved — press "Finish & Submit" again.',
    answeredCount: (a: number, n: number) => `Answered: ${a}/${n}`,
    resultsNotice: 'When you finish you will see your score and every answer with an explanation. The same results are emailed to the address you enter here.',
  },
};

// Shown while the answers are being submitted and graded (it can take a
// while when there is an AI-graded open question). The submit is one
// request, so the steps follow the order the server works in, paced by
// typical timings: save answers -> check multiple-choice -> AI grades the
// open answers -> prepare results. Before this a student saw only a small
// "Submitting..." on a black screen and thought the page had frozen.
const submitStepsDict = {
  ka: {
    title: 'პასუხები იგზავნება და მოწმდება',
    send: 'პასუხები იგზავნება სერვერზე',
    mcq: 'ტესტური კითხვები მოწმდება',
    open: 'AI აფასებს წერით პასუხს',
    results: 'შედეგები და ახსნები მზადდება',
    elapsed: (s: number) => `გავიდა ${s} წამი`,
    keepOpen: 'გთხოვთ, არ დახუროთ და არ განაახლოთ ეს გვერდი. ჩვეულებრივ 5–30 წამი სჭირდება.',
    slow: 'ჯერ კიდევ მუშავდება — AI სერვისი ახლა ნელა პასუხობს. თქვენი პასუხები უკვე შენახულია, უბრალოდ დაელოდეთ.',
  },
  en: {
    title: 'Submitting and checking your answers',
    send: 'Sending your answers to the server',
    mcq: 'Checking multiple-choice answers',
    open: 'AI is grading your written answer',
    results: 'Preparing your results and explanations',
    elapsed: (s: number) => `${s} seconds so far`,
    keepOpen: 'Please do not close or refresh this page. It usually takes 5–30 seconds.',
    slow: 'Still working — the AI service is slow right now. Your answers are already saved, please wait.',
  },
  de: {
    title: 'Antworten werden gesendet und geprüft',
    send: 'Antworten werden an den Server gesendet',
    mcq: 'Multiple-Choice-Antworten werden geprüft',
    open: 'KI bewertet deine schriftliche Antwort',
    results: 'Ergebnisse und Erklärungen werden vorbereitet',
    elapsed: (s: number) => `${s} Sekunden`,
    keepOpen: 'Bitte diese Seite nicht schließen oder neu laden. Das dauert meist 5–30 Sekunden.',
    slow: 'Wird noch bearbeitet — der KI-Dienst ist gerade langsam. Deine Antworten sind bereits gespeichert.',
  },
  es: {
    title: 'Enviando y revisando tus respuestas',
    send: 'Enviando tus respuestas al servidor',
    mcq: 'Revisando las preguntas de opción múltiple',
    open: 'La IA está calificando tu respuesta escrita',
    results: 'Preparando tus resultados y explicaciones',
    elapsed: (s: number) => `${s} segundos`,
    keepOpen: 'No cierres ni recargues esta página. Suele tardar 5–30 segundos.',
    slow: 'Todavía en proceso: el servicio de IA va lento. Tus respuestas ya están guardadas.',
  },
  fr: {
    title: 'Envoi et vérification de vos réponses',
    send: 'Envoi de vos réponses au serveur',
    mcq: 'Vérification des questions à choix multiples',
    open: "L'IA évalue votre réponse écrite",
    results: 'Préparation de vos résultats et explications',
    elapsed: (s: number) => `${s} secondes`,
    keepOpen: 'Ne fermez pas et ne rechargez pas cette page. Cela prend généralement 5 à 30 secondes.',
    slow: "Toujours en cours : le service d'IA est lent en ce moment. Vos réponses sont déjà enregistrées.",
  },
  uk: {
    title: 'Відповіді надсилаються та перевіряються',
    send: 'Відповіді надсилаються на сервер',
    mcq: 'Перевіряються тестові питання',
    open: 'ШІ оцінює вашу письмову відповідь',
    results: 'Готуються результати та пояснення',
    elapsed: (s: number) => `Минуло ${s} с`,
    keepOpen: 'Будь ласка, не закривайте й не оновлюйте цю сторінку. Зазвичай це 5–30 секунд.',
    slow: 'Ще обробляється — сервіс ШІ зараз працює повільно. Ваші відповіді вже збережено.',
  },
};

function SubmittingPanel({ lang, hasOpenQuestions, showResults }: { lang: keyof typeof submitStepsDict; hasOpenQuestions: boolean; showResults: boolean }) {
  const t = submitStepsDict[lang] ?? submitStepsDict.en;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // [label, second at which this step usually starts]
  const steps: [string, number][] = [
    [t.send, 0],
    [t.mcq, 2],
    ...(hasOpenQuestions ? ([[t.open, 4]] as [string, number][]) : []),
    ...(showResults ? ([[t.results, hasOpenQuestions ? 18 : 5]] as [string, number][]) : []),
  ];
  let active = 0;
  steps.forEach(([, start], i) => {
    if (elapsed >= start) active = i;
  });
  return (
    <div className="mt-10 rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-6 sm:p-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3 mb-5">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin shrink-0" />
        <h2 className="text-lg font-black text-white">{t.title}</h2>
      </div>
      <ol className="space-y-3 mb-5">
        {steps.map(([label], i) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            {i < active ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : i === active ? (
              <Loader2 className="w-5 h-5 text-cyan-300 animate-spin shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-slate-600 shrink-0" />
            )}
            <span className={i < active ? 'text-slate-400' : i === active ? 'text-white font-bold' : 'text-slate-500'}>{label}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-400 mb-1">{t.elapsed(elapsed)}</p>
      <p className="text-xs text-amber-300">{elapsed >= 40 ? t.slow : t.keepOpen}</p>
    </div>
  );
}

export default function CandidateExamPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const token = typeof router.query.token === 'string' ? router.query.token : null;

  const [phase, setPhase] = useState<Phase>('landing');
  const [info, setInfo] = useState<CandidateExamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');

  const [submissionToken, setSubmissionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [copyPasteCount, setCopyPasteCount] = useState(0);
  const [warningToast, setWarningToast] = useState<string | null>(null);
  const [examStartedAt, setExamStartedAt] = useState<Date | null>(null);
  const [savedAttempt, setSavedAttempt] = useState<SavedAttempt | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<CandidateResults | null>(null);

  // ---- Camera & microphone gate ----
  const [mediaStatus, setMediaStatus] = useState<'idle' | 'requesting' | 'live' | 'denied'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const inProgressVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const faceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAudioStrikeRef = useRef(0);

  const phaseRef = useRef<Phase>('landing');
  const strikeGuardRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  const tabSwitchRef = useRef(0);
  const copyPasteRef = useRef(0);
  const submissionTokenRef = useRef<string | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!token) return;
    getCandidateExamInfo(token)
      .then(setInfo)
      .catch(() => setError(t.loadFailed));
    setSavedAttempt(readSavedAttempt(token));
  }, [token, t.loadFailed]);

  // Keep the saved attempt's answers current so a refresh loses nothing.
  useEffect(() => {
    if (!token || !submissionToken || phase !== 'in-progress') return;
    writeSavedAttempt(token, { submissionToken, answers });
  }, [token, submissionToken, answers, phase]);

  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (faceIntervalRef.current) {
      clearInterval(faceIntervalRef.current);
      faceIntervalRef.current = null;
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
  }, []);

  useEffect(() => stopMedia, [stopMedia]);

  // Camera AND microphone in one request — the exam start button stays
  // disabled (see the landing form's disabled prop below) until this
  // resolves to 'live', a hard gate rather than a dismissible warning.
  const handleEnableMedia = async () => {
    setMediaStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMediaStatus('live');
      // Non-blocking — a slow/failed model load just means face-presence
      // warnings never start firing; the camera/mic gate itself already
      // did its job by this point.
      ensureFaceApiReady().catch(() => {});
    } catch {
      setMediaStatus('denied');
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!submissionTokenRef.current || phaseRef.current === 'submitting' || phaseRef.current === 'done') return;
    setPhase('submitting');
    try {
      // Only answers travel here now — tab-switch/paste counts are recorded
      // server-side in real time by logProctoringEvent below (see
      // registerStrike) and the server recomputes the integrity score from
      // those at submit time, rather than trusting anything this call sends.
      const submitted = await submitCandidateExam(submissionTokenRef.current, { answers: answersRef.current, locale: lang });
      setResults(submitted.results);
      if (token) clearSavedAttempt(token);
      setSubmitError(null);
      setPhase('done');
      stopMedia();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (err: any) {
      // "already submitted" means the server has it — treat as done.
      if (err?.response?.status === 400 && /already submitted/i.test(err?.response?.data?.message ?? '')) {
        const sub = submissionTokenRef.current;
        if (sub) getCandidateResults(sub).then(setResults).catch(() => {});
        if (token) clearSavedAttempt(token);
        setPhase('done');
        stopMedia();
        return;
      }
      // Otherwise (network hiccup in a busy classroom) keep the student on
      // their answers so they can press submit again — previously this
      // dropped them on a dead error screen with no way to retry.
      setSubmitError(t.submitFailed);
      setPhase('in-progress');
    }
  }, [t.submitFailed, stopMedia, token, lang]);

  type StrikeKind = 'tab' | 'copyPaste' | 'fullscreen' | 'faceMissing' | 'multipleFaces' | 'lookingAway' | 'backgroundVoice';

  const STRIKE_EVENT_TYPE: Record<StrikeKind, ProctoringEventType> = {
    tab: 'TAB_SWITCH',
    copyPaste: 'COPY_PASTE',
    fullscreen: 'FULLSCREEN_EXIT',
    faceMissing: 'FACE_MISSING',
    multipleFaces: 'MULTIPLE_FACES',
    lookingAway: 'LOOKING_AWAY',
    backgroundVoice: 'BACKGROUND_VOICE',
  };

  const registerStrike = useCallback(
    (kind: StrikeKind) => {
      if (phaseRef.current !== 'in-progress' || strikeGuardRef.current) return;
      strikeGuardRef.current = true;
      setTimeout(() => {
        strikeGuardRef.current = false;
      }, 800);

      if (submissionTokenRef.current) {
        // Fire-and-forget — this is the server-authoritative record of the
        // violation; the local strikes/toast state below is only for the
        // candidate's own on-screen warning and the client-side auto-submit
        // at MAX_STRIKES.
        logProctoringEvent(submissionTokenRef.current, STRIKE_EVENT_TYPE[kind]).catch(() => {});
      }

      if (kind === 'tab' || kind === 'fullscreen') {
        tabSwitchRef.current += 1;
        setTabSwitchCount(tabSwitchRef.current);
      } else if (kind === 'copyPaste') {
        copyPasteRef.current += 1;
        setCopyPasteCount(copyPasteRef.current);
      }

      // Live, specific on-screen warning (per the spec: "face missing,
      // multiple faces, looking away, speech detected") layered on top of
      // the existing strike-count note — tab/copyPaste keep exactly their
      // prior wording (no specific reason line) since that copy is already
      // established and understood.
      const reason =
        kind === 'faceMissing'
          ? t.warningFaceMissing
          : kind === 'multipleFaces'
          ? t.warningMultipleFaces
          : kind === 'lookingAway'
          ? t.warningLookingAway
          : kind === 'backgroundVoice'
          ? t.warningBackgroundVoice
          : kind === 'fullscreen'
          ? t.warningFullscreenExit
          : null;

      // Camera/microphone signals are logged (server-side) and shown as a
      // warning, but don't count toward the auto-submit limit — in a real
      // classroom they fire on normal behaviour (looking down at paper, a
      // neighbour or the teacher talking) and used to end exams within a
      // minute. The teacher still sees them in the report.
      const isSoftSignal = kind === 'faceMissing' || kind === 'multipleFaces' || kind === 'lookingAway' || kind === 'backgroundVoice';
      if (isSoftSignal) {
        setWarningToast(`${reason} — ${t.softWarningSuffix}`);
        return;
      }

      setStrikes((prev) => {
        const next = prev + 1;
        if (next >= MAX_STRIKES) {
          handleSubmit();
        } else {
          setWarningToast(reason ? `${reason} — ${t.warningNote(next)}` : t.warningNote(next));
        }
        return next;
      });
    },
    [handleSubmit, t]
  );

  useEffect(() => {
    if (phase !== 'in-progress') return;

    const onVisibilityChange = () => {
      if (document.hidden) registerStrike('tab');
    };
    const onBlur = () => registerStrike('tab');
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) registerStrike('fullscreen');
    };
    // Paste is both blocked (preventDefault) AND counted as a proctoring
    // violation — detection alone (per the spec) wouldn't stop a candidate
    // from pasting an AI-generated answer, and blocking alone would give no
    // integrityScore signal to the business.
    const onPaste = (e: Event) => {
      e.preventDefault();
      registerStrike('copyPaste');
    };
    const blockEvent = (e: Event) => e.preventDefault();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('paste', onPaste);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('paste', onPaste);
    };
  }, [phase, registerStrike]);

  // Face-presence monitoring — periodic snapshot from the (already-granted)
  // camera stream onto a hidden canvas, run through face-api.js's tiny
  // detector. 0 faces / >1 faces / an off-center single face (a rough
  // "looking away" proxy — this isn't true gaze tracking, just bounding-box
  // position) each register their own strike kind.
  useEffect(() => {
    if (phase !== 'in-progress') return;
    // The landing-screen <video> (videoRef) is unmounted once the exam
    // starts, so face detection must read from the in-progress preview —
    // reading videoRef here meant face checks silently never ran at all.
    const video = inProgressVideoRef.current ?? videoRef.current;
    if (!video) return;
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;

    const interval = setInterval(async () => {
      const faceapi = (window as any).faceapi;
      // face-api.js loads lazily in the background — skip until it's ready.
      if (!faceapi?.nets?.tinyFaceDetector?.isLoaded) return;
      if (!video.videoWidth || !video.videoHeight) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const detections = await faceapi.detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions());
        if (detections.length === 0) {
          registerStrike('faceMissing');
        } else if (detections.length > 1) {
          registerStrike('multipleFaces');
        } else {
          const box = detections[0].box;
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          const offsetX = Math.abs(faceCenterX - canvas.width / 2) / canvas.width;
          const offsetY = Math.abs(faceCenterY - canvas.height / 2) / canvas.height;
          if (offsetX > LOOKING_AWAY_OFFSET_RATIO || offsetY > LOOKING_AWAY_OFFSET_RATIO) {
            registerStrike('lookingAway');
          }
        }
      } catch {
        // A transient detection error (e.g. a dropped frame) isn't itself a
        // violation — just skip this tick.
      }
    }, FACE_CHECK_INTERVAL_MS);
    faceIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [phase, registerStrike]);

  // Background-voice monitoring — Web Audio API amplitude thresholding on
  // the mic stream (real voice-activity detection, not speech-to-text or
  // speaker identification). AUDIO_STRIKE_COOLDOWN_MS keeps continuous
  // background chatter from generating a strike every single tick.
  useEffect(() => {
    if (phase !== 'in-progress' || !streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(streamRef.current);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const normalized = (buffer[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      if (rms > AUDIO_VOLUME_THRESHOLD && Date.now() - lastAudioStrikeRef.current > AUDIO_STRIKE_COOLDOWN_MS) {
        lastAudioStrikeRef.current = Date.now();
        registerStrike('backgroundVoice');
      }
    }, AUDIO_CHECK_INTERVAL_MS);
    audioIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      audioContext.close().catch(() => {});
    };
  }, [phase, registerStrike]);

  // The landing screen's <video> (videoRef) unmounts once phase leaves
  // 'landing' — the already-granted stream just gets handed to the
  // in-progress view's own small preview element instead of being
  // re-requested.
  useEffect(() => {
    if (phase === 'in-progress' && inProgressVideoRef.current && streamRef.current) {
      inProgressVideoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  useEffect(() => {
    if (!warningToast) return;
    const timeout = setTimeout(() => setWarningToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [warningToast]);

  useEffect(() => {
    if (phase !== 'in-progress' || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, secondsLeft, handleSubmit]);

  const handleStart = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || mediaStatus !== 'live') return;
    setPhase('starting');
    setError(null);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Some browsers/contexts block fullscreen — the exam still proceeds,
      // the listeners above just won't catch a fullscreen-exit that never
      // entered fullscreen to begin with.
    }
    if (savedAttempt) {
      try {
        const result = await resumeCandidateExam(savedAttempt.submissionToken);
        if ((result.secondsLeft ?? 0) <= 0) throw new Error('expired');
        setSubmissionToken(result.submissionToken);
        submissionTokenRef.current = result.submissionToken;
        setQuestions(result.questions);
        setAnswers(savedAttempt.answers);
        answersRef.current = savedAttempt.answers;
        setSecondsLeft(result.secondsLeft ?? result.durationMinutes * 60);
        setExamStartedAt(new Date());
        setPhase('in-progress');
        return;
      } catch {
        // Already submitted / expired / unknown — fall back to a fresh start.
        clearSavedAttempt(token);
        setSavedAttempt(null);
        setError(t.resumeFailed);
        setPhase('landing');
        return;
      }
    }
    try {
      const result = await startCandidateExam(token, { candidateName, candidateEmail });
      setSubmissionToken(result.submissionToken);
      submissionTokenRef.current = result.submissionToken;
      writeSavedAttempt(token, { submissionToken: result.submissionToken, answers: {} });
      setQuestions(result.questions);
      setSecondsLeft(result.secondsLeft ?? result.durationMinutes * 60);
      setExamStartedAt(new Date());
      setPhase('in-progress');
    } catch {
      setError(t.errorGeneric);
      setPhase('error');
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 min-h-screen bg-slate-950 text-white flex flex-col">
      <Head>
        <title>{info ? `${info.title} | CDC Exam` : 'CDC Exam'}</title>
      </Head>

      {warningToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-bold text-sm px-5 py-3 rounded-xl shadow-lg">
          {warningToast}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10 flex-1 w-full">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300 mb-6">{error}</div>
        )}

        {phase === 'landing' && info && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
            <h1 className="blog-heading-safe text-xl font-black mb-1">{info.title}</h1>
            {info.description && <p className="text-sm text-slate-400 mb-3">{info.description}</p>}
            <p className="text-xs text-cyan-400 font-bold flex items-center gap-1.5 mb-6">
              <Clock className="w-3.5 h-3.5" />
              {t.duration(info.durationMinutes)}
            </p>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3 mb-6">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300">{t.proctoringNotice}</p>
            </div>
            {info.showResultsToCandidate && (
              <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-4 flex items-start gap-3 mb-6">
                <CheckCircle2 className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300">{t.resultsNotice}</p>
              </div>
            )}

            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 mb-6">
              <p className="text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                <Mic className="w-3.5 h-3.5" />
                {t.cameraMicLabel}
              </p>
              <p className="text-[11px] text-slate-500 mb-3">{t.cameraMicHint}</p>
              {mediaStatus === 'live' ? (
                <>
                  <video ref={videoRef} autoPlay muted playsInline className="w-full max-w-xs rounded-lg aspect-video bg-black object-cover mb-2" />
                  <p className="text-[11px] font-bold text-emerald-400">{t.cameraMicLive}</p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableMedia}
                  disabled={mediaStatus === 'requesting'}
                  className="text-xs font-bold text-cyan-400 bg-transparent border border-cyan-500/40 rounded-lg px-3 py-2 cursor-pointer disabled:opacity-60"
                >
                  {mediaStatus === 'requesting' ? t.cameraMicChecking : t.cameraMicAllow}
                </button>
              )}
              {mediaStatus === 'denied' && <p className="text-[11px] text-rose-400 mt-2">{t.cameraMicDenied}</p>}
            </div>

            <form onSubmit={handleStart} className="space-y-4">
              {savedAttempt && (
                <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">{t.resumeTitle}</p>
              )}
              {!savedAttempt && (<>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.name}</label>
                <input
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">{t.email}</label>
                <input
                  required
                  type="email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              </>)}
              <button
                type="submit"
                disabled={mediaStatus !== 'live'}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savedAttempt ? t.resumeCta : t.start}
              </button>
            </form>
          </div>
        )}

        {phase === 'starting' && <p className="text-sm text-slate-400">{t.starting}</p>}

        {phase === 'in-progress' && (
          <div>
            <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-6 bg-slate-950/95 backdrop-blur border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-black flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
                {examStartedAt && (
                  <span className="hidden sm:inline text-[11px] text-slate-500">
                    {t.examDate}: {examStartedAt.toLocaleDateString('en-GB')} {examStartedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {strikes > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                    <ShieldAlert className="w-3.5 h-3.5" /> {strikes}/{MAX_STRIKES}
                  </span>
                )}
                <video ref={inProgressVideoRef} autoPlay muted playsInline className="w-16 h-10 rounded-md bg-black object-cover border border-slate-700" />
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <p className="text-sm font-bold mb-3">
                    {i + 1}. {q.question}
                  </p>
                  {q.type === 'MCQ' && q.options ? (
                    <div className="space-y-2">
                      {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                        <label key={letter} className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === letter}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                          />
                          <span className="font-bold text-slate-500">{letter}.</span> {q.options![letter]}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      rows={q.type === 'CODE' ? 8 : 4}
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={q.type === 'CODE' ? t.codePlaceholder : t.practicalPlaceholder}
                      spellCheck={q.type !== 'CODE'}
                      className={`w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        q.type === 'CODE' ? 'font-mono' : ''
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {submitError && (
              <div className="mt-6 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">{submitError}</div>
            )}
            <p className="mt-6 text-xs text-slate-400 text-center">
              {t.answeredCount(questions.filter((q) => (answers[q.id] ?? '').trim() !== '').length, questions.length)}
            </p>
            <button
              type="button"
              onClick={() => handleSubmit()}
              className="mt-3 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white"
            >
              {t.submit}
            </button>
          </div>
        )}

        {phase === 'submitting' && (
          <SubmittingPanel
            lang={lang}
            hasOpenQuestions={questions.some((q) => q.type !== 'MCQ')}
            showResults={info?.showResultsToCandidate ?? true}
          />
        )}

        {phase === 'done' && results && <ExamResultsView results={results} locale={lang} email={candidateEmail || undefined} />}

        {phase === 'done' && !results && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-lg font-black mb-2">{t.doneTitle}</h1>
            <p className="text-sm text-slate-400">{t.doneBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
