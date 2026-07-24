interface ToastProps {
  message: string;
  icon?: string;
}

// Fixed-position, self-contained success/info banner. No context/provider —
// callers own the `show` boolean and render this conditionally, same pattern
// as the ad-hoc toast already used on the homepage (pages/index.tsx).
export default function Toast({ message, icon = '✅' }: ToastProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2">
      <span>{icon}</span>
      {message}
    </div>
  );
}
