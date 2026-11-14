// What the product agent currently thinks is worth making: the newest
// weekly market brief per category (Backend services/productAgent/trends.ts),
// with a "refresh now" button. Used by pages/admin/product-agent.tsx.
import { useState } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { AgentCategory, TrendBrief } from '../../../services/adminProductAgentService';

interface Props {
  briefs: TrendBrief[];
  categories: AgentCategory[];
  onRefresh: () => Promise<void>;
}

export default function TrendBriefsCard({ briefs, categories, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" /> ტრენდები და სწავლა
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            კვირაში ერთხელ აგენტი ახლებურად აფასებს, რა ღირს გასაკეთებლად: სეზონს და მომავალ დღესასწაულებს, მაღაზიის გაყიდვებს და შენს გადაწყვეტილებებს (დამტკიცება, უარყოფა, წაშლა და მათი მიზეზი).
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> განაახლე ახლა
        </button>
      </div>
      <div className="divide-y">
        {categories.map((c) => {
          const b = briefs.find((x) => x.category === c.key);
          const expanded = open === c.key;
          return (
            <div key={c.key} className="py-3">
              <button type="button" onClick={() => setOpen(expanded ? null : c.key)} className="w-full flex items-center justify-between gap-3 text-left">
                <span className="text-sm font-medium text-gray-900">{c.labelKa}</span>
                <span className="text-xs text-gray-400">{b ? `განახლდა ${new Date(b.createdAt).toLocaleDateString('ka-GE')} · ${b.themes.length} თემა` : 'ჯერ არ არის — გამოიყენება საბაზო სია'}</span>
              </button>
              {expanded && b && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-gray-600">{b.summary}</p>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    {b.themes.map((t) => (
                      <li key={t.theme} className="text-sm text-gray-800">
                        <span className="font-medium">{t.theme}</span>
                        <span className="text-gray-500"> — {t.why}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
