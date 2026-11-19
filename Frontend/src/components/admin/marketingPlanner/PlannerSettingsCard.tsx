// Marketing planner settings: weekly auto-plan switch, posts per week per
// platform, default hour and brand notes. Used by pages/admin/marketing-planner.tsx.
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { PlannerSettings } from '../../../services/adminMarketingPlannerService';

interface Props {
  settings: PlannerSettings;
  onSave: (s: PlannerSettings) => Promise<void>;
}

export default function PlannerSettingsCard({ settings, onSave }: Props) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || 0));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" className="w-4 h-4" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
        <span className="text-sm font-medium text-gray-900">ავტომატური დაგეგმვა: ყოველ პარასკევს აგენტი შემდეგი კვირის დრაფტებს ამზადებს</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="text-sm text-gray-700">
          Facebook პოსტები კვირაში
          <input
            type="number"
            min={0}
            max={14}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
            value={draft.facebookPerWeek}
            onChange={(e) => setDraft({ ...draft, facebookPerWeek: num(e.target.value, 0, 14) })}
          />
        </label>
        <label className="text-sm text-gray-700">
          Instagram პოსტები კვირაში
          <input
            type="number"
            min={0}
            max={14}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
            value={draft.instagramPerWeek}
            onChange={(e) => setDraft({ ...draft, instagramPerWeek: num(e.target.value, 0, 14) })}
          />
        </label>
        <label className="text-sm text-gray-700">
          საწყისი საათი (თბილისი)
          <input
            type="number"
            min={8}
            max={23}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
            value={draft.postHourTbilisi}
            onChange={(e) => setDraft({ ...draft, postHourTbilisi: num(e.target.value, 8, 23) })}
          />
        </label>
      </div>
      <label className="block text-sm text-gray-700">
        ბრენდის ხმა და წესები (აგენტი ყველა პოსტში გაითვალისწინებს)
        <textarea
          rows={3}
          maxLength={2000}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
          placeholder="მაგ.: მეგობრული, მოკლე წინადადებები; ვახსენოთ, რომ ფაილი ყიდვისთანავე ჩამოიტვირთება…"
          value={draft.brandNotes}
          onChange={(e) => setDraft({ ...draft, brandNotes: e.target.value })}
        />
      </label>
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={save}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> {saving ? 'ინახება…' : 'შენახვა'}
      </button>
    </div>
  );
}
