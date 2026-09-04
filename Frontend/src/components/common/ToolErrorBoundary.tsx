import { Component, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { resolveLocale, SupportedLocale } from '../../utils/locale';

// React error boundaries can only be class components — hooks can't
// implement getDerivedStateFromError/componentDidCatch — so the actual
// catching logic lives here, and the exported ToolErrorBoundary below is a
// thin functional wrapper that reads the current locale via useRouter()
// and passes it down as a prop.
//
// Scope: this catches a render-time exception in whatever tree it wraps
// and shows a recoverable fallback (reload the page) instead of Next's
// generic "Application error: a client-side exception has occurred" blank
// screen — it does NOT catch errors in event handlers, effects, or async
// code (those already have their own try/catch throughout this codebase),
// and it does NOT catch errors during SSR (error boundaries are
// client-only by React's own design).

const DICT: Record<SupportedLocale, { title: string; body: string; reload: string }> = {
  ka: {
    title: 'დაფიქსირდა შეცდომა',
    body: 'ამ გვერდის ჩატვირთვისას მოულოდნელი შეცდომა მოხდა. სცადეთ გვერდის განახლება — თუ პრობლემა გაგრძელდება, დაგვიკავშირდით მხარდაჭერის ჩატში.',
    reload: 'გვერდის განახლება',
  },
  en: {
    title: 'Something went wrong',
    body: 'This page hit an unexpected error while loading. Try reloading — if the problem persists, contact support.',
    reload: 'Reload Page',
  },
  de: {
    title: 'Something went wrong',
    body: 'This page hit an unexpected error while loading. Try reloading — if the problem persists, contact support.',
    reload: 'Reload Page',
  },
  es: {
    title: 'Something went wrong',
    body: 'This page hit an unexpected error while loading. Try reloading — if the problem persists, contact support.',
    reload: 'Reload Page',
  },
  fr: {
    title: 'Something went wrong',
    body: 'This page hit an unexpected error while loading. Try reloading — if the problem persists, contact support.',
    reload: 'Reload Page',
  },
  uk: {
    title: 'Something went wrong',
    body: 'This page hit an unexpected error while loading. Try reloading — if the problem persists, contact support.',
    reload: 'Reload Page',
  },
};

interface Props {
  locale: SupportedLocale;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundaryClass extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('[ToolErrorBoundary] caught a render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = DICT[this.props.locale];
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">{t.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{t.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            {t.reload}
          </button>
        </div>
      </div>
    );
  }
}

export default function ToolErrorBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <ErrorBoundaryClass locale={resolveLocale(router.locale)}>{children}</ErrorBoundaryClass>;
}
