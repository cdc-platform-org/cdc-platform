// Product agent settings: on/off, per-category daily counts with live cost
// estimate, image quality, monthly budget, run hour, and "create now"
// buttons. Used by pages/admin/product-agent.tsx.
import { useEffect, useMemo, useState } from 'react';
import { Play, Save } from 'lucide-react';
import { useRouter } from 'next/router';
import { AgentCategory, AgentCategoryKey, ProductAgentSettings } from '../../../services/adminProductAgentService';

import { at } from '../../../i18n/admin';
import { useCanSeeMoney } from '../useCanSeeMoney';
interface Props {
  settings: ProductAgentSettings;
  categories: AgentCategory[];
  busy: boolean;
  configured: boolean;
  onSave: (s: ProductAgentSettings) => Promise<void>;
  onRun: (keys: AgentCategoryKey[]) => Promise<void>;
}

// "medium" image quality costs roughly a third of "high" for image-heavy
// categories; text-only categories are unaffected.
const qualityFactor = (q: 'high' | 'medium', c: AgentCategory) => (q === 'medium' && c.estimatedCostUsd > 0.2 ? 0.35 : 1);
const TBILISI_OFFSET = 4;

export default function AgentSettingsCard({ settings, categories, busy, configured, onSave, onRun }: Props) {
  const {locale} = useRouter();
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  useEffect(() => setDraft(settings), [settings]);
  const canSeeMoney = useCanSeeMoney();

  const daily = useMemo(
    () => categories.reduce((sum, c) => sum + (draft.dailyCounts[c.key] ?? 0) * (c.estimatedCostUsd ?? 0) * qualityFactor(draft.imageQuality, c), 0),
    [categories, draft]
  );
  const perDay = categories.reduce((s, c) => s + (draft.dailyCounts[c.key] ?? 0), 0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };
  const run = async (keys: AgentCategoryKey[], tag: string) => {
    setRunning(tag);
    try {
      await onRun(keys);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-emerald-600" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
          <span className="text-sm font-semibold text-gray-900">ყოველდღიური ავტომატური შექმნა ჩართულია</span>
        </label>
        <button
          type="button"
          disabled={!configured || running !== null}
          onClick={() => run(categories.map((c) => c.key), 'all')}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {running === 'all' ? 'იგზავნება…' : 'შექმენი თითო ნიმუში ყველა კატეგორიიდან'}
        </button>
      </div>
      {!configured && <p className="text-sm text-red-600">Azure gpt-image-2 არ არის კონფიგურირებული სერვერზე (AZURE_IMAGE_*).</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2 pr-3">კატეგორია</th>
              <th className="py-2 pr-3">დღეში</th>
              {canSeeMoney && <th className="py-2 pr-3">ფასი</th>}
              {canSeeMoney && <th className="py-2 pr-3">ხარჯი / პროდუქტი</th>}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.key} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <div className="font-medium text-gray-900">{locale === 'en' ? c.labelEn : c.labelKa}</div>
                  <div className="text-xs text-gray-400">{c.storeCategory}{c.needsFactCheck ? ' · ფაქტების შემოწმება სავალდებულოა' : ''}</div>
                  {c.key === 'VECTOR_LOGOS' && <div className="mt-1 text-xs text-gray-500">{locale === 'en' ? at("SVG + transparent PNG · editable text, colors and symbol parts") : 'SVG + გამჭვირვალე PNG · ტექსტის, ფერებისა და სიმბოლოს ნაწილების რედაქტირება'}</div>}
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={draft.dailyCounts[c.key] ?? 0}
                    onChange={(e) => setDraft({ ...draft, dailyCounts: { ...draft.dailyCounts, [c.key]: Math.max(0, Math.min(50, Number(e.target.value) || 0)) } })}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1"
                  />
                </td>
                {canSeeMoney && <td className="py-2 pr-3 text-gray-700">{c.defaultPriceGel} ₾</td>}
                {canSeeMoney && <td className="py-2 pr-3 text-gray-700">≈ ${(c.estimatedCostUsd * qualityFactor(draft.imageQuality, c)).toFixed(2)}</td>}
                <td className="py-2 text-right">
                  <button
                    type="button"
                    disabled={!configured || running !== null}
                    onClick={() => run([c.key], c.key)}
                    className="text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {running === c.key ? '…' : 'შექმენი 1 ახლა'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <label className="text-sm">
          <span className="block text-xs text-gray-500 mb-1">სურათების ხარისხი</span>
          <select value={draft.imageQuality} onChange={(e) => setDraft({ ...draft, imageQuality: e.target.value as 'high' | 'medium' })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5">
            <option value="high">მაღალი (ბეჭდვისთვის საუკეთესო)</option>
            <option value="medium">საშუალო (იაფი)</option>
          </select>
        </label>
        {canSeeMoney && (
        <label className="text-sm">
          <span className="block text-xs text-gray-500 mb-1">თვის ბიუჯეტი (USD) — მიღწევისას ჩერდება</span>
          <input type="number" min={0} max={5000} value={draft.monthlyBudgetUsd} onChange={(e) => setDraft({ ...draft, monthlyBudgetUsd: Number(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 px-2 py-1.5" />
        </label>
        )}
        <label className="text-sm">
          <span className="block text-xs text-gray-500 mb-1">დაწყების საათი (თბილისის დროით)</span>
          <select
            value={(draft.runHourUtc + TBILISI_OFFSET) % 24}
            onChange={(e) => setDraft({ ...draft, runHourUtc: (Number(e.target.value) - TBILISI_OFFSET + 24) % 24 })}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap bg-gray-50 rounded-lg px-4 py-3">
        <p className="text-sm text-gray-700">
          დღეში <b>{perDay}</b> პროდუქტი
          {canSeeMoney && <> · სავარაუდო ხარჯი ≈ <b>${daily.toFixed(2)}</b> დღეში, ≈ <b>${(daily * 30).toFixed(0)}</b> თვეში (Azure)</>}
        </p>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'ინახება…' : 'შენახვა'}
        </button>
      </div>
      {busy && <p className="text-xs text-indigo-600">აგენტი ახლა მუშაობს — ერთი პროდუქტის შექმნას 2–10 წუთი სჭირდება.</p>}
    </div>
  );
}
