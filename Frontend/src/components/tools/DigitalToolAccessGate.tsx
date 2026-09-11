import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { hasDigitalToolAccess } from '../../services/iakoAssistantService';

const copy = {
  ka: {
    checking: 'შემოწმდება წვდომა…',
    title: 'ეს ხელსაწყო წვდომას საჭიროებს',
    body: 'თქვენ ჯერ არ გაქვთ ამ ხელსაწყოს გამოყენების უფლება. დაგვიკავშირდით წვდომის მისაღებად.',
    contact: 'დაკავშირება',
  },
  en: {
    checking: 'Checking access…',
    title: 'This tool requires access',
    body: 'You don’t have access to this tool yet. Contact us to request it.',
    contact: 'Contact us',
  },
};

// Client-side companion to the tool's own backend gate (e.g.
// mediaStudio.ts's requireMediaStudioAccess) — the backend route is what
// actually enforces this; this just avoids rendering a full tool UI that
// would immediately fail its first real action for a visitor who isn't
// entitled yet.
export default function DigitalToolAccessGate({ toolKey, children }: { toolKey: string; children: ReactNode }) {
  const router = useRouter();
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const t = copy[lang];
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    setState('checking');
    hasDigitalToolAccess(toolKey)
      .then((allowed) => { if (!cancelled) setState(allowed ? 'allowed' : 'denied'); })
      .catch(() => { if (!cancelled) setState('denied'); });
    return () => { cancelled = true; };
  }, [toolKey]);

  if (state === 'checking') return <p role="status" className="text-center py-16 text-sm text-slate-500">{t.checking}</p>;
  if (state === 'denied') return (
    <div role="alert" className="max-w-md mx-auto text-center py-16">
      <h1 className="text-xl font-black mb-3">{t.title}</h1>
      <p className="text-sm text-slate-500 mb-6">{t.body}</p>
      <a href="mailto:contact@cdc.org.ge" className="inline-block rounded-xl bg-cyan-700 text-white px-5 py-3 text-sm font-bold no-underline">{t.contact}</a>
    </div>
  );
  return <>{children}</>;
}
