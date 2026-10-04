import { useState } from 'react';
import { Play, X } from 'lucide-react';
import VideoEmbed, { parseVideoUrl } from './VideoEmbed';
import { SiteLocale } from '../../utils/seo';

// "▶ Watch how to use" — product spec's explicit requirement (2026-10):
// every CDC digital product (AI Tool, AI Teacher, Children's Book, Digital
// Store product) SUPPORTS an instruction/demo video, with a clear button
// that opens an accessible player, and — critically — renders NOTHING (not
// a disabled/broken button) when no video has been configured yet. Reuses
// VideoEmbed.tsx's own URL-shape validation (YouTube/Vimeo/direct file
// only) so a malformed or unsupported pasted URL degrades to "no button"
// here too, same as it already does on pages/cases/[slug].tsx — never an
// unsafe arbitrary iframe embed.
const LABELS: Record<SiteLocale, string> = {
  ka: '▶ გამოყენების ინსტრუქცია',
  en: '▶ Watch how to use',
  de: '▶ So funktioniert es',
  es: '▶ Cómo usarlo',
  fr: '▶ Comment l’utiliser',
  uk: '▶ Як користуватися',
  tr: '▶ Nasıl kullanılır',
  hy: '▶ Ինչպես օգտագործել',
  az: '▶ Necə istifadə etmək olar',
};

export default function ProductVideoButton({ videoUrl, locale, title }: { videoUrl: string | undefined; locale: SiteLocale; title: string }) {
  const [open, setOpen] = useState(false);
  if (!videoUrl || !parseVideoUrl(videoUrl)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 px-5 py-2.5 text-sm font-bold hover:bg-cyan-500/20 transition-colors"
      >
        <Play className="w-4 h-4" />
        {LABELS[locale]}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white truncate pr-4">{title}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <VideoEmbed url={videoUrl} title={title} />
          </div>
        </div>
      )}
    </>
  );
}
