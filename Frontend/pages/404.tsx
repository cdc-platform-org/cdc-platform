import Link from 'next/link';
import BackButton from '../src/components/common/BackButton';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-midnight px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-slate-950/80 p-10 shadow-glass">
        <BackButton fallbackHref="/" className="mb-6 text-slate-400 hover:text-slate-100" />
        <h1 className="text-5xl font-semibold">404</h1>
        <p className="mt-4 text-lg text-slate-300">Page not found. Return to the CDC Platform home dashboard.</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 no-underline transition hover:bg-slate-200"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
