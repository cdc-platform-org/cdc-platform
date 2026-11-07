import { useEffect, useState } from 'react';
import VideoEmbed, { parseVideoUrl } from '../shared/VideoEmbed';
import { getSiteContent } from '../../services/siteContentService';
import { resolveBlogImageUrl } from '../../services/blogService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { findToolEntry } from '../../utils/toolCatalog';
import type { ToolCatalogContent } from '../../types/siteContent';

// Banner at the top of a tool's own page, driven by /admin/tools: the
// admin's video (YouTube / Vimeo / direct .mp4) when one is set, otherwise
// the cover photo, otherwise nothing (the page looks exactly as before).
export default function ToolMediaBanner({ slug, alt, className = 'mb-8' }: { slug: string; alt?: string; className?: string }) {
  const [media, setMedia] = useState<{ imageUrl?: string; videoUrl?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSiteContent<ToolCatalogContent>('tool-catalog')
      .then((row) => {
        if (cancelled) return;
        const entry = findToolEntry(row?.content?.tools, slug);
        setMedia({ imageUrl: entry?.imageUrl, videoUrl: entry?.videoUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const videoUrl = media?.videoUrl?.trim();
  if (videoUrl && parseVideoUrl(videoUrl)) {
    return (
      <div className={`${className} w-full max-w-3xl`}>
        <VideoEmbed url={videoUrl} title={alt} />
      </div>
    );
  }
  const imageUrl = media?.imageUrl?.trim();
  if (!imageUrl) return null;
  return (
    <div className={`${className} w-full aspect-[3/1] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10 shadow-sm`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded CMS image on the API origin */}
      <img src={resolveBlogImageUrl(imageUrl)} alt={alt ?? ''} onError={onImageErrorFallback} className="w-full h-full object-cover" />
    </div>
  );
}
