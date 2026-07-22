interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  accent?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose';
  sublabel?: string;
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps['accent']>, string> = {
  cyan: 'from-cyan-500 to-sky-600',
  purple: 'from-purple-500 to-indigo-600',
  emerald: 'from-emerald-500 to-teal-600',
  amber: 'from-amber-400 to-orange-500',
  rose: 'from-rose-500 to-pink-600',
};

export default function StatCard({ label, value, icon, accent = 'cyan', sublabel }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</span>
        <span
          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${ACCENT_CLASSES[accent]} text-white flex items-center justify-center text-base shadow-sm`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black text-gray-900">{value}</div>
      {sublabel && <div className="mt-1 text-xs text-gray-400">{sublabel}</div>}
    </div>
  );
}
