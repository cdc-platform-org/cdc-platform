import { useEffect, useState, useCallback } from 'react';
import { Loader2, ArrowRight, PartyPopper, Mic, SkipForward, Settings2 } from 'lucide-react';
import {
  BeginnerPathState,
  BeginnerBlockClient,
  getBeginnerPathState,
  advanceBeginnerPath,
  skipBeginnerPath,
} from '../../../services/englishTutorService';
import { TUTOR_SUPPORT_LANGUAGES } from '../../../data/tutorSupportLanguages';
import WordAudioButton from './WordAudioButton';
import ClickableSentence from './ClickableSentence';
import { primeEnglishVoice, supportsSpeechRecognition, createSpeechRecognizer } from './speechUtils';

interface BeginnerPathRunnerProps {
  lang: 'ka' | 'en';
  nativeLang: string;
  // Changing the support language is a pure re-render-in-a-different-
  // language action — it never touches currentStageId/currentBlockIndex/
  // masteredConceptIds/learnerDisplayName server-side (see
  // englishTutor.ts's serializeBeginnerState: nativeLang is a rendering
  // parameter, not part of the stored progress row), so switching mid-path
  // can never reset level/progress. This callback just hands the new code
  // up to the parent (EnglishTutorPanel), which both persists it (the same
  // fire-and-forget mechanism GET /beginner-path/state already uses) and
  // keeps its own lesson-generation form's default in sync for later.
  onNativeLangChange: (nativeLang: string) => void;
  // Called once the path becomes inactive (completed or skipped) — the
  // parent (EnglishTutorPanel) just re-renders its normal lesson-generation
  // UI at that point; this component has nothing left to show.
  onDone: () => void;
}

// Same ka/en content-locale boundary as TutorOnboardingFlow/
// EnglishTutorPanel (see utils/locale.ts's contentLocale — Georgian only
// for the ka site locale, English for every other of CDC's 9 site
// locales) — deliberately NOT a next-i18next namespace, consistent with
// every other string in this exact feature.
const dict = {
  ka: {
    continue: 'შემდეგი →',
    writeHere: 'დაწერეთ აქ',
    check: 'შემოწმება',
    checking: 'მოწმდება…',
    correct: 'სწორია! 🎉',
    tryAgain: 'სცადეთ თავიდან',
    listenFirst: 'მოსმენა',
    namePrompt: 'შეიყვანეთ თქვენი სახელი',
    nameSubmit: 'დადასტურება',
    yourTurn: 'თქვენი რიგია',
    repeat: 'გამეორება',
    heard: 'გავიგონე:',
    checkpointContinue: 'შემდეგ ეტაპზე →',
    checkpointFinish: 'სავარჯიშოების დაწყება →',
    skip: 'გამოტოვება — უკვე ვიცი საფუძვლები',
    loading: 'იტვირთება…',
    meaning: 'მნიშვნელობა',
    example: 'მაგალითი',
    settings: 'სწავლის პარამეტრები',
    supportLanguage: 'ახსნის ენა',
  },
  en: {
    continue: 'Continue →',
    writeHere: 'Write here',
    check: 'Check',
    checking: 'Checking…',
    correct: 'Correct! 🎉',
    tryAgain: 'Try again',
    listenFirst: 'Listen',
    namePrompt: 'Enter your name',
    nameSubmit: 'Confirm',
    yourTurn: 'Your turn',
    repeat: 'Repeat',
    heard: 'I heard:',
    checkpointContinue: 'Next stage →',
    checkpointFinish: 'Start practicing →',
    skip: "Skip — I already know the basics",
    loading: 'Loading…',
    meaning: 'Meaning',
    example: 'Example',
    settings: 'Learning settings',
    supportLanguage: 'Support language',
  },
};

export default function BeginnerPathRunner({ lang, nativeLang, onNativeLangChange, onDone }: BeginnerPathRunnerProps) {
  const t = dict[lang];
  const [state, setState] = useState<BeginnerPathState | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [incorrectFlash, setIncorrectFlash] = useState(false);
  const [heardText, setHeardText] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    primeEnglishVoice();
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    getBeginnerPathState(nativeLang)
      .then((s) => {
        setState(s);
        if (!s.active) onDone();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeLang]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A new block arriving means the previous one's local input state is
  // stale — clear it so e.g. a wrong WRITE answer's leftover text doesn't
  // bleed into the next block.
  const currentBlockId = state && state.active ? state.block.id : null;
  useEffect(() => {
    setResponseText('');
    setIncorrectFlash(false);
    setHeardText(null);
  }, [currentBlockId]);

  const handleAdvance = async (extra?: { responseText?: string; displayName?: string }) => {
    if (!state?.active) return;
    setSubmitting(true);
    try {
      const next = await advanceBeginnerPath({ blockId: state.block.id, nativeLang, ...extra });
      if (next.active === false) {
        setState(next);
        onDone();
        return;
      }
      if (next.correct === false) {
        setIncorrectFlash(true);
        return; // stay on the same block — the learner can retry
      }
      setState(next);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    await skipBeginnerPath();
    onDone();
  };

  if (loading && !state) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }
  if (!state || !state.active) return null; // onDone() already fired — parent takes over

  const block = state.block;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {Array.from({ length: state.totalBlocksInStage }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= state.blockIndex ? 'w-8 bg-gradient-to-r from-purple-500 to-cyan-500' : 'w-4 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            aria-label={t.settings}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-purple-500 hover:bg-purple-500/10 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={handleSkip} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline">
            {t.skip}
          </button>
        </div>
      </div>

      {/* Section 20/"changeable support language" requirement — reachable
          from the active learning experience without being visually
          intrusive during every exercise (collapsed by default). Changing
          this never touches stage/block/mastery state (see
          onNativeLangChange's own comment above) — only re-renders the
          CURRENT block's gloss/translation in the new language. */}
      {settingsOpen && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between gap-3">
          <label htmlFor="beginner-support-lang" className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            🌐 {t.supportLanguage}
          </label>
          <select
            id="beginner-support-lang"
            value={nativeLang}
            onChange={(e) => onNativeLangChange(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-1.5 text-sm font-medium"
          >
            {TUTOR_SUPPORT_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 backdrop-blur-md bg-gradient-to-br from-purple-500/10 via-white/40 dark:via-slate-900/40 to-cyan-500/10 p-6 sm:p-8 shadow-xl shadow-purple-500/10">
        <BeginnerBlockCard
          block={block}
          t={t}
          responseText={responseText}
          setResponseText={setResponseText}
          nameInput={nameInput}
          setNameInput={setNameInput}
          incorrectFlash={incorrectFlash}
          heardText={heardText}
          setHeardText={setHeardText}
        />

        <div className="mt-6 flex justify-end">
          <BlockActionButton
            block={block}
            t={t}
            submitting={submitting}
            responseText={responseText}
            nameInput={nameInput}
            isLastStage={state.isLastStage}
            onAdvance={handleAdvance}
          />
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  block: BeginnerBlockClient;
  t: typeof dict.en;
  responseText: string;
  setResponseText: (v: string) => void;
  nameInput: string;
  setNameInput: (v: string) => void;
  incorrectFlash: boolean;
  heardText: string | null;
  setHeardText: (v: string | null) => void;
}

// One small, clearly-scoped card per block type — premium-but-simple:
// gradient-bordered container, a word/sentence with audio, and whatever
// that block type specifically needs (gloss, grammar examples, a name
// input, a writing box, a two-line dialogue). See the product spec's
// section 15 for the visual language this follows (polished cards,
// contextual icons, large audio controls, strong typography).
function BeginnerBlockCard(props: CardProps) {
  const { block, t } = props;
  switch (block.type) {
    case 'GREETING':
      return (
        <div className="flex flex-col items-center gap-4 text-center py-4">
          <div className="text-6xl">{block.textEn?.match(/^\S+/)?.[0] ?? '👋'}</div>
          <ClickableSentence
            text={(block.textEn ?? '').replace(/^\S+\s*/, '') || block.textEn || ''}
            listenLabel={t.listenFirst}
            wordLabel={(w) => `${t.listenFirst}: ${w}`}
          />
        </div>
      );
    case 'WORD':
      return block.word ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <WordAudioButton text={block.word.word} label={`${t.listenFirst}: ${block.word.word}`} size="lg" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{block.word.word}</p>
              <p className="text-sm text-slate-400 font-mono">{block.word.ipa}</p>
            </div>
          </div>
          {block.word.translation !== block.word.word && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-semibold">{t.meaning}:</span> {block.word.translation}
            </p>
          )}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
            <p className="text-xs font-semibold text-slate-400 mb-1">{t.example}</p>
            <ClickableSentence text={block.word.exampleSentenceEn} listenLabel={t.listenFirst} wordLabel={(w) => `${t.listenFirst}: ${w}`} />
          </div>
        </div>
      ) : null;
    case 'SENTENCE':
    case 'PERSONAL_SENTENCE':
      return <ClickableSentence text={block.textEn ?? ''} listenLabel={t.listenFirst} wordLabel={(w) => `${t.listenFirst}: ${w}`} className="py-4" />;
    case 'GRAMMAR_TIP':
      return (
        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-purple-500">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Grammar
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{block.textEn}</p>
          {block.translation && block.translation !== block.textEn && <p className="text-sm text-slate-500 dark:text-slate-400">{block.translation}</p>}
          <div className="flex flex-col gap-2 mt-2">
            {(block.examplesEn ?? []).map((ex, i) => (
              <ClickableSentence key={i} text={ex} listenLabel={t.listenFirst} wordLabel={(w) => `${t.listenFirst}: ${w}`} />
            ))}
          </div>
        </div>
      );
    case 'QUESTION_NAME':
      return (
        <div className="flex flex-col gap-4">
          <ClickableSentence text={block.textEn ?? ''} listenLabel={t.listenFirst} wordLabel={(w) => `${t.listenFirst}: ${w}`} />
          {block.translation && block.translation !== block.textEn && <p className="text-sm text-slate-500 dark:text-slate-400">{block.translation}</p>}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400">{t.namePrompt}</span>
            <input
              type="text"
              value={props.nameInput}
              onChange={(e) => props.setNameInput(e.target.value)}
              maxLength={40}
              autoFocus
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Nino"
            />
          </label>
        </div>
      );
    case 'WRITE':
      return (
        <div className="flex flex-col gap-4">
          {block.audioTextEn && (
            <div className="flex items-center gap-3">
              <WordAudioButton text={block.audioTextEn} label={t.listenFirst} size="lg" />
              <span className="text-sm text-slate-500 dark:text-slate-400">{t.listenFirst}</span>
            </div>
          )}
          <p className="text-base text-slate-700 dark:text-slate-200">{block.textEn}</p>
          {block.translation && block.translation !== block.textEn && <p className="text-sm text-slate-500 dark:text-slate-400">{block.translation}</p>}
          <input
            type="text"
            value={props.responseText}
            onChange={(e) => props.setResponseText(e.target.value)}
            maxLength={200}
            autoFocus
            aria-label={t.writeHere}
            className={`rounded-xl border px-4 py-3 text-lg focus:outline-none focus:ring-2 transition-colors ${
              props.incorrectFlash
                ? 'border-red-400 ring-red-300 bg-red-50 dark:bg-red-500/10'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-purple-400'
            }`}
            placeholder={t.writeHere}
          />
          {props.incorrectFlash && <p className="text-sm text-red-500">{t.tryAgain}</p>}
        </div>
      );
    case 'MINI_DIALOGUE':
      return (
        <div className="flex flex-col gap-3">
          {(block.turns ?? []).map((turn, i) => (
            <div key={i} className={`flex ${turn.speaker === 'LEARNER' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 flex items-center gap-2 ${
                  turn.speaker === 'LEARNER'
                    ? 'bg-gradient-to-br from-purple-500 to-cyan-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                }`}
              >
                {turn.speaker === 'IMIAKO' && <WordAudioButton text={turn.textEn} label={t.listenFirst} />}
                <span className="font-medium">{turn.textEn}</span>
                {turn.speaker === 'LEARNER' && <Mic className="w-4 h-4 opacity-70" />}
              </div>
            </div>
          ))}
          {supportsSpeechRecognition() && (
            <RepeatControl
              phraseToRepeat={block.turns?.find((t2) => t2.speaker === 'LEARNER')?.textEn ?? ''}
              repeatLabel={t.repeat}
              heardLabel={t.heard}
              heardText={props.heardText}
              setHeardText={props.setHeardText}
            />
          )}
        </div>
      );
    case 'CHECKPOINT':
      return (
        <div className="flex flex-col items-center gap-3 text-center py-6">
          <PartyPopper className="w-12 h-12 text-amber-400" />
          <p className="text-xl font-bold text-slate-900 dark:text-white">{block.textEn}</p>
          {block.translation && block.translation !== block.textEn && <p className="text-sm text-slate-500 dark:text-slate-400">{block.translation}</p>}
        </div>
      );
  }
}

// Section 10 — basic listen-and-repeat, no fake scoring: just shows what
// the browser's recognizer actually heard, for the learner to judge
// themselves. Mic button is entirely absent (not disabled) when
// SpeechRecognition isn't supported — feature-detected by the caller.
function RepeatControl({
  phraseToRepeat,
  repeatLabel,
  heardLabel,
  heardText,
  setHeardText,
}: {
  phraseToRepeat: string;
  repeatLabel: string;
  heardLabel: string;
  heardText: string | null;
  setHeardText: (v: string | null) => void;
}) {
  const [listening, setListening] = useState(false);
  const startListening = () => {
    const recognizer = createSpeechRecognizer(
      (heard) => {
        setHeardText(heard);
        setListening(false);
      },
      () => setListening(false)
    );
    if (!recognizer) return;
    setListening(true);
    setHeardText(null);
    recognizer.start();
  };
  return (
    <div className="flex items-center gap-3 mt-1">
      <button
        type="button"
        onClick={startListening}
        disabled={listening || !phraseToRepeat}
        aria-label={repeatLabel}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 text-white text-sm font-bold px-4 py-2 disabled:opacity-60"
      >
        <Mic className="w-4 h-4" /> {listening ? '…' : repeatLabel}
      </button>
      {heardText && (
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {heardLabel} <span className="font-semibold text-slate-700 dark:text-slate-200">"{heardText}"</span>
        </span>
      )}
    </div>
  );
}

function BlockActionButton({
  block,
  t,
  submitting,
  responseText,
  nameInput,
  isLastStage,
  onAdvance,
}: {
  block: BeginnerBlockClient;
  t: typeof dict.en;
  submitting: boolean;
  responseText: string;
  nameInput: string;
  isLastStage: boolean;
  onAdvance: (extra?: { responseText?: string; displayName?: string }) => void;
}) {
  if (block.type === 'WRITE') {
    return (
      <button
        type="button"
        disabled={submitting || !responseText.trim()}
        onClick={() => onAdvance({ responseText })}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold px-6 py-3 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {submitting ? t.checking : t.check}
      </button>
    );
  }
  if (block.type === 'QUESTION_NAME') {
    return (
      <button
        type="button"
        disabled={submitting || !nameInput.trim()}
        onClick={() => onAdvance({ displayName: nameInput.trim() })}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold px-6 py-3 disabled:opacity-50"
      >
        {t.nameSubmit} <ArrowRight className="w-4 h-4" />
      </button>
    );
  }
  const label = block.type === 'CHECKPOINT' ? (isLastStage ? t.checkpointFinish : t.checkpointContinue) : t.continue;
  return (
    <button
      type="button"
      disabled={submitting}
      onClick={() => onAdvance()}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold px-6 py-3 disabled:opacity-50"
    >
      {label} {block.type !== 'CHECKPOINT' && <ArrowRight className="w-4 h-4" />}
      {block.type === 'CHECKPOINT' && <SkipForward className="w-4 h-4" />}
    </button>
  );
}
