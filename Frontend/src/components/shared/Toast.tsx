import { TriangleAlert, CircleCheck } from 'lucide-react';
interface ToastProps {
  message: string;
  icon?: 'success' | 'warning';
}

// Fixed-position, self-contained success/info banner. No context/provider —
// callers own the `show` boolean and render this conditionally, same pattern
// as the ad-hoc toast already used on the homepage (pages/index.tsx).
export default function Toast({ message, icon = 'success' }: ToastProps) {
  return (
    <div className="fixed bottom-[calc(1.5rem+var(--tabbar-h,0px))] sm:bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
      {icon === 'warning' ? <TriangleAlert className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" /> : <CircleCheck className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />}
      {message}
    </div>
  );
}
