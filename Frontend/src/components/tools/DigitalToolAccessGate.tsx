import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Lock, Mail, LayoutGrid, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { hasDigitalToolAccess } from '../../services/iakoAssistantService';
import ToolShell, { ToolPageHeader, ToolStateCard, ToolLinkButton, ToolAccent } from './ToolShell';

const copy = {
  ka: {
    checking: 'შემოწმდება წვდომა…',
    title: 'ეს ხელსაწყო წვდომას საჭიროებს',
    body: 'ამ ინსტრუმენტის გამოწერა შეგიძლია ციფრულ მარკეტში. სწავლის პერიოდში კოლეჯის წვდომა უფასოა.',
    contact: 'წვდომის მოთხოვნა',
    browse: 'AI ინსტრუმენტების მარკეტი',
    mailSubject: 'ხელსაწყოზე წვდომის მოთხოვნა',
  },
  en: {
    checking: 'Checking access…',
    title: 'This tool requires access',
    body: 'Subscribe to this tool in the Digital Market. College access is included while you study.',
    contact: 'Request access',
    browse: 'AI tools in the Digital Market',
    mailSubject: 'Tool access request',
  },
};

// Client-side companion to the tool's own backend gate (e.g.
// mediaStudio.ts's requireMediaStudioAccess) — the backend route is what
// actually enforces this; this just avoids rendering a full tool UI that
// would immediately fail its first real action for a visitor who isn't
// entitled yet.
interface GateProps {
  toolKey: string;
  children: ReactNode;
  /** Tool name/icon so the checking + locked states keep the tool's own
   *  header instead of a bare white page with no site navigation. */
  toolTitle?: ReactNode;
  toolSubtitle?: ReactNode;
  toolIcon?: LucideIcon;
  accent?: ToolAccent;
}

export default function DigitalToolAccessGate({ toolKey, children, toolTitle, toolSubtitle, toolIcon, accent }: GateProps) {
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

  if (state === 'allowed') return <>{children}</>;

  const header = toolTitle && toolIcon
    ? <ToolPageHeader icon={toolIcon} accent={accent} title={toolTitle} subtitle={toolSubtitle} />
    : null;

  if (state === 'checking') return (
    <ToolShell>
      {header}
      <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        {t.checking}
      </p>
    </ToolShell>
  );

  const subject = encodeURIComponent(`${t.mailSubject}: ${toolKey}`);
  return (
    <ToolShell>
      {header}
      <div role="alert">
        <ToolStateCard icon={Lock} accent={accent} title={t.title} body={t.body}>
          <ToolLinkButton variant="secondary" href={`mailto:contact@cdc.org.ge?subject=${subject}`}><Mail className="w-4 h-4" aria-hidden />{t.contact}</ToolLinkButton>
          <ToolLinkButton href="/marketplace?category=ai-tools"><LayoutGrid className="w-4 h-4" aria-hidden />{t.browse}</ToolLinkButton>
        </ToolStateCard>
      </div>
    </ToolShell>
  );
}
