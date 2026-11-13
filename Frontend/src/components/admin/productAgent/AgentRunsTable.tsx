// Recent product-agent runs: what it tried, with which theme, the measured
// Azure cost and any error. Used by pages/admin/product-agent.tsx.
import { AgentCategory, AgentRun } from '../../../services/adminProductAgentService';

const STATUS: Record<AgentRun['status'], string> = {
  QUEUED: 'რიგშია',
  RUNNING: 'მიმდინარეობს',
  SUCCEEDED: 'შეიქმნა',
  FAILED: 'ვერ შეიქმნა',
};
const STATUS_CLS: Record<AgentRun['status'], string> = {
  QUEUED: 'text-gray-500',
  RUNNING: 'text-indigo-600',
  SUCCEEDED: 'text-emerald-700',
  FAILED: 'text-red-600',
};

export default function AgentRunsTable({ runs, categories }: { runs: AgentRun[]; categories: AgentCategory[] }) {
  if (!runs.length) return <p className="text-sm text-gray-500">ჯერ არცერთი გაშვება არ ყოფილა.</p>;
  const label = (key: string) => categories.find((c) => c.key === key)?.labelKa ?? key;
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="px-4 py-2">დრო</th>
            <th className="px-4 py-2">კატეგორია</th>
            <th className="px-4 py-2">სტატუსი</th>
            <th className="px-4 py-2">თემა</th>
            <th className="px-4 py-2">ხარჯი</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b last:border-0 align-top">
              <td className="px-4 py-2 whitespace-nowrap text-gray-600">{new Date(r.startedAt).toLocaleString('ka-GE')}</td>
              <td className="px-4 py-2">
                {label(r.category)}
                <div className="text-[11px] text-gray-400">{r.trigger === 'SCHEDULE' ? 'განრიგით' : 'ხელით'}</div>
              </td>
              <td className={`px-4 py-2 font-medium ${STATUS_CLS[r.status]}`}>
                {STATUS[r.status]}
                {r.error && <div className="text-[11px] font-normal text-red-500 max-w-xs break-words">{r.error}</div>}
              </td>
              <td className="px-4 py-2 text-gray-600 max-w-xs">{r.theme ?? '—'}</td>
              <td className="px-4 py-2 whitespace-nowrap text-gray-700">${r.estimatedCostUsd.toFixed(2)}{r.imageCount ? ` · ${r.imageCount} სურ.` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
