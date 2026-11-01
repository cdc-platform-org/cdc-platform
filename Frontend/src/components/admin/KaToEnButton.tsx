import { useState } from 'react';
import AITranslateButton from './AITranslateButton';
import { translateKaToEn } from '../../utils/translateToEnglish';

export interface KaEnPair {
  // Georgian source text (skipped when empty).
  ka?: string | null;
  // Writes the English translation into the matching EN field. Leave it
  // out and use `onTranslated` instead when the form's setter can't take
  // several updates in a row (stale-state setters).
  setEn?: (en: string) => void;
}

// One-click "translate every filled Georgian field of this form into its
// English twin" for admin pages that have KA/EN field pairs. Overwrites the
// EN fields it translates (the admin can still edit them afterwards).
export default function KaToEnButton({
  pairs,
  onTranslated,
  className = '',
}: {
  pairs: KaEnPair[];
  // Called once with every translation (undefined where the KA text was empty).
  onTranslated?: (values: (string | undefined)[]) => void;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async () => {
    const sources = pairs.map((p) => (p.ka ?? '').trim());
    if (!sources.some(Boolean)) {
      setError('ჯერ ქართული ტექსტი შეავსე.');
      return;
    }
    setLoading(true);
    setError(null);
    setDone(false);
    try {
      const translated = await translateKaToEn(sources);
      const values = translated.map((en, i) => (sources[i] && en ? en : undefined));
      values.forEach((en, i) => {
        if (en !== undefined) pairs[i].setEn?.(en);
      });
      onTranslated?.(values);
      setDone(true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 501 ? 'AI თარგმნა სერვერზე ჯერ ჩართული არ არის.' : 'თარგმნა ვერ მოხერხდა, სცადე თავიდან.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <AITranslateButton onClick={run} loading={loading} label="🌐 ქართულიდან ინგლისურად თარგმნა" className="!mb-0" />
      {done && !error && <span className="text-[11px] text-emerald-600">EN ველები შეივსო ✓ (შეამოწმე და შეინახე)</span>}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
