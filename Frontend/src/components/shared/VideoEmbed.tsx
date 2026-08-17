interface VideoEmbedProps {
  url: string;
  title?: string;
}

type ParsedVideo = { kind: 'youtube' | 'vimeo'; id: string } | { kind: 'file' } | null;

// Accepts the handful of URL shapes an admin is realistically going to
// paste: a full YouTube watch/share/embed link, youtu.be, a Vimeo link, or a
// direct .mp4/.webm/.ogg file. Anything else (typo, unsupported host,
// private/unlisted link that still resolves) falls through to `null` and
// the caller renders nothing rather than a broken iframe — see
// pages/cases/[slug].tsx, which only shows this section when parse succeeds.
function parseVideoUrl(url: string): ParsedVideo {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    return id ? { kind: 'youtube', id } : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      return id ? { kind: 'youtube', id } : null;
    }
    const embedMatch = parsed.pathname.match(/^\/(embed|shorts)\/([^/]+)/);
    if (embedMatch) return { kind: 'youtube', id: embedMatch[2] };
    return null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = parsed.pathname.match(/(\d+)/);
    return match ? { kind: 'vimeo', id: match[1] } : null;
  }
  if (/\.(mp4|webm|ogg)$/i.test(parsed.pathname)) {
    return { kind: 'file' };
  }
  return null;
}

// Responsive 16:9 video embed — YouTube/Vimeo render as an iframe, a direct
// file link renders as a native <video>. Renders nothing when the URL
// doesn't match a known shape (see parseVideoUrl above).
export default function VideoEmbed({ url, title }: VideoEmbedProps) {
  const parsed = parseVideoUrl(url);
  if (!parsed) return null;

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800">
      {parsed.kind === 'youtube' && (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${parsed.id}`}
          title={title ?? 'Video'}
          className="absolute inset-0 w-full h-full border-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
      {parsed.kind === 'vimeo' && (
        <iframe
          src={`https://player.vimeo.com/video/${parsed.id}`}
          title={title ?? 'Video'}
          className="absolute inset-0 w-full h-full border-none"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      )}
      {parsed.kind === 'file' && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url} controls className="absolute inset-0 w-full h-full object-contain bg-black" />
      )}
    </div>
  );
}
