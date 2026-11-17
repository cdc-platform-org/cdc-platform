/**
 * About-page cover video (CDC students at work). Self-hosted in
 * public/videos (WebM + MP4, 1280w, no audio track — optimized from the
 * user's Cloudinary upload), so it starts muted and looping like a living
 * photo. A "full video" button opens the same clip with native controls.
 * Respects reduced motion: no autoplay, the poster shows instead.
 */
import { useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';

export default function AboutVideo({ label, caption }: { label: string; caption: React.ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [controls, setControls] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    video.play().catch(() => { /* autoplay blocked: poster stays */ });
  }, []);

  const openFull = () => {
    const video = ref.current;
    if (!video) return;
    setControls(true);
    video.currentTime = 0;
    video.play().catch(() => {});
    video.requestFullscreen?.().catch(() => {});
  };

  return (
    <figure className="relative m-0 overflow-hidden rounded-xl bg-cdc-primary-soft">
      <video
        ref={ref}
        className="aspect-[16/10] w-full object-cover"
        poster="/images/about-video-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        controls={controls}
        aria-label={label}
      >
        <source src="/videos/about-cdc.webm" type="video/webm" />
        <source src="/videos/about-cdc.mp4" type="video/mp4" />
      </video>
      {!controls && (
        <>
          <figcaption className="absolute bottom-5 left-5 rounded bg-cdc-surface/95 px-4 py-2 text-xs font-bold text-cdc-ink">{caption}</figcaption>
          <button
            type="button"
            onClick={openFull}
            aria-label={label}
            className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded bg-cdc-surface/95 px-3 py-2 text-xs font-bold text-cdc-ink border-none cursor-pointer hover:bg-cdc-surface"
          >
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        </>
      )}
    </figure>
  );
}
