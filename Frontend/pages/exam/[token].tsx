import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ShieldAlert, Clock, CheckCircle2, AlertTriangle, Camera, Mic } from 'lucide-react';
import {
  getCandidateExamInfo,
  startCandidateExam,
  submitCandidateExam,
  logProctoringEvent,
  CandidateExamInfo,
  ExamQuestionRow,
  ProctoringEventType,
} from '../../src/services/examProctoringService';
import { resolveLocale } from '@/src/utils/locale';

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
    doneBody: 'თქვენი პასუხები წარმატებით გაიგზავნა. დამსაქმებელი დაგიკავშირდებათ შედეგების შესახებ.',
    warningNote: (n: number) => `⚠️ დარღვევა შეინიშნა (${n}/${MAX_STRIKES}). კიდევ ერთი და გამოცდა ავტომატურად დასრულდება.`,
    proctoringNotice: `ტაბის გადართვა, ფოკუსის დაკარგვა ან სრულეკრანიანი რეჟიმიდან გამოსვლა ითვლება დარღვევად — ${MAX_STRIKES} დარღვევის შემთხვევაში გამოცდა ავტომატურად წყდება.`,
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
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
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
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
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
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
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
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
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
    doneBody: 'Your answers were submitted successfully. The employer will be in touch about next steps.',
    warningNote: (n: number) => `⚠️ Violation detected (${n}/${MAX_STRIKES}). One more and the exam will auto-submit.`,
    proctoringNotice: `Tab switching, losing window focus, or exiting fullscreen counts as a violation — ${MAX_STRIKES} violations auto-submit and end the exam.`,
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
  },
};

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
  }, [token, t.loadFailed]);

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
      await submitCandidateExam(submissionTokenRef.current, { answers: answersRef.current });
      setPhase('done');
      stopMedia();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch {
      setError(t.errorGeneric);
      setPhase('error');
    }
  }, [t.errorGeneric, stopMedia]);

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
    const faceapi = (window as any).faceapi;
    if (!faceapi || !videoRef.current) return;

    const video = videoRef.current;
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;

    const interval = setInterval(async () => {
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
    try {
      const result = await startCandidateExam(token, { candidateName, candidateEmail });
      setSubmissionToken(result.submissionToken);
      submissionTokenRef.current = result.submissionToken;
      setQuestions(result.questions);
      setSecondsLeft(result.durationMinutes * 60);
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
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
              <button
                type="submit"
                disabled={mediaStatus !== 'live'}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.start}
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

            <button
              type="button"
              onClick={() => handleSubmit()}
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-black text-white"
            >
              {t.submit}
            </button>
          </div>
        )}

        {phase === 'submitting' && <p className="text-sm text-slate-400">{t.submitting}</p>}

        {phase === 'done' && (
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
