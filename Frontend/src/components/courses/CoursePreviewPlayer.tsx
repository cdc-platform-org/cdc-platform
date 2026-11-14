import { parseVideoUrl } from '../shared/VideoEmbed';
import MinimalVideo from './MinimalVideo';
export default function CoursePreviewPlayer({ url, title }: { url: string; title: string }) {
  const parsed = parseVideoUrl(url);
  if (!parsed) return null;
  if (parsed.kind === 'file') return <MinimalVideo src={url} title={title} autoPlay />;
  const src = parsed.kind === 'youtube' ? `https://www.youtube-nocookie.com/embed/${parsed.id}?autoplay=1&rel=0` : `https://player.vimeo.com/video/${parsed.id}?autoplay=1${parsed.hash ? `&h=${parsed.hash}` : ''}`;
  return <iframe src={src} title={title} className="absolute inset-0 h-full w-full border-none" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen />;
}
