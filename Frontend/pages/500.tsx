export default function ServerError() {
  return (
    <div className="min-h-screen bg-midnight px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-slate-950/80 p-10 shadow-glass">
        <h1 className="text-5xl font-semibold">500</h1>
        <p className="mt-4 text-lg text-slate-300">Server error occurred. The premium portal is temporarily unavailable.</p>
      </div>
    </div>
  );
}
