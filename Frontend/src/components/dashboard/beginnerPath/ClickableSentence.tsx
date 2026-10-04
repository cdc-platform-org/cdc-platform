import { speakEnglish, supportsSpeechSynthesis } from './speechUtils';
import WordAudioButton from './WordAudioButton';

interface ClickableSentenceProps {
  text: string;
  listenLabel: string; // localized "Listen to the full sentence" accessible label
  wordLabel: (word: string) => string; // localized per-word accessible label builder
  className?: string;
}

// Section 7 — "click/select word -> pronounce word": tokenizes a sentence
// into individually tappable words (each plays just that one word) while
// still offering one button to play the whole sentence naturally. Plain
// whitespace-tokenization is intentional — this only ever renders fixed,
// hand-authored curriculum sentences (see Backend's
// beginnerCurriculumService.ts), never arbitrary free text, so there's no
// punctuation-stripping/locale-aware-tokenizer edge case to handle.
export default function ClickableSentence({ text, listenLabel, wordLabel, className }: ClickableSentenceProps) {
  const words = text.split(/(\s+)/); // keep whitespace segments so spacing round-trips exactly
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ''}`}>
      {supportsSpeechSynthesis() && <WordAudioButton text={text} label={listenLabel} />}
      <p className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-relaxed">
        {words.map((segment, i) =>
          /^\s+$/.test(segment) ? (
            <span key={i}>{segment}</span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => speakEnglish(segment)}
              aria-label={wordLabel(segment)}
              className="rounded px-0.5 hover:bg-purple-500/15 hover:text-purple-600 dark:hover:text-purple-300 active:scale-95 transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
            >
              {segment}
            </button>
          )
        )}
      </p>
    </div>
  );
}
