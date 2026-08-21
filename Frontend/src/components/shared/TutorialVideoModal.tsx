import { X, ExternalLink } from 'lucide-react';
import { Tutorial } from '../../types/tutorial';
import { getEmbedUrl } from '../../services/tutorialService';

// Shared between /tutorials (the video hub) and the homepage's promo-video
// button — same YouTube/Vimeo/Loom embed logic, same "can't embed it, open
// in a new tab instead" fallback for anything getEmbedUrl doesn't recognize.
export default function TutorialVideoModal({
  tutorial,
  title,
  openExternallyLabel,
  openInNewTabLabel,
  onClose,
}: {
  tutorial: Tutorial;
  title: string;
  openExternallyLabel: string;
  openInNewTabLabel: string;
  onClose: () => void;
}) {
  const embedUrl = getEmbedUrl(tutorial.videoUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white truncate pr-4">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {embedUrl ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={embedUrl}
              title={title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-400 mb-4">{openExternallyLabel}</p>
            <a
              href={tutorial.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-400 hover:text-cyan-300"
            >
              {openInNewTabLabel} <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
