import { Volume2 } from 'lucide-react';
import { speakEnglish, supportsSpeechSynthesis } from './speechUtils';

interface WordAudioButtonProps {
  text: string;
  label: string; // accessible label, e.g. 'Listen to "Hello"' — localized by the caller
  size?: 'sm' | 'lg';
}

// Section 5/6's "clearly visible audio button" — plays ONLY the given
// text, nothing else (no surrounding paragraph/explanation). Hidden
// entirely (not just disabled) when the browser has no speechSynthesis at
// all, rather than showing a dead button — a learner on an unsupported
// browser should see a clean card with no audio control, not a button that
// silently does nothing when tapped.
export default function WordAudioButton({ text, label, size = 'sm' }: WordAudioButtonProps) {
  if (!supportsSpeechSynthesis()) return null;
  const dimension = size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const iconSize = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speakEnglish(text);
      }}
      aria-label={label}
      className={`inline-flex items-center justify-center ${dimension} rounded-full bg-gradient-to-br from-purple-500/15 to-cyan-500/15 border border-purple-400/30 text-purple-500 dark:text-purple-300 hover:scale-105 hover:shadow-md hover:shadow-purple-500/20 transition-all duration-200 active:scale-95 shrink-0`}
    >
      <Volume2 className={iconSize} />
    </button>
  );
}
