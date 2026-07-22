import { useAuth } from '../../context/AuthContext';

interface CourseVideoPlayerProps {
  embedUrl: string | null;
  title: string;
}

// Bunny Stream iframe embed, plus a low-opacity floating identity watermark.
// This is a casual screen-recording deterrent (makes a leaked recording
// traceable to the account that made it) — not real DRM or forensic-grade
// protection, which Bunny Stream doesn't provide at this tier.
export default function CourseVideoPlayer({ embedUrl, title }: CourseVideoPlayerProps) {
  const { user } = useAuth();
  const watermarkText = user?.email ?? '';

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
      {embedUrl ? (
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full border-none"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
          Video is not available for this lesson yet.
        </div>
      )}

      {watermarkText && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          <div className="grid grid-cols-2 gap-16 -rotate-[20deg] opacity-[0.14] select-none">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="text-white text-sm font-bold tracking-wide whitespace-nowrap">
                {watermarkText}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
