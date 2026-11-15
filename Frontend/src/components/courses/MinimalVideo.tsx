import { useRef, useState } from 'react';
import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'next-i18next';
function time(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
/** Direct media files use these controls; hosted iframes retain provider controls. */
export default function MinimalVideo({ src, title, autoPlay = false }: { src: string; title: string; autoPlay?: boolean }) {
  const { t } = useTranslation('courses');
  const video = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const togglePlay = () => { const media = video.current; if (!media) return; if (media.paused) void media.play().catch(() => setPlaying(false)); else media.pause(); };
  return <div ref={root} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black text-white">
    <video ref={video} src={src} aria-label={title} playsInline autoPlay={autoPlay} controls={failed} preload="metadata" className="h-full w-full" onClick={togglePlay} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onError={() => setFailed(true)} />
    {!failed && <div className="absolute bottom-0 inset-x-0 flex flex-wrap sm:flex-nowrap items-center gap-3 bg-gradient-to-t from-black/90 to-black/40 p-3">
      <button type="button" onClick={togglePlay} aria-label={t(playing ? 'academy.pause' : 'academy.play')} className="rounded p-1 focus-visible:outline focus-visible:outline-white">{playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}</button>
      <input type="range" min={0} max={duration || 1} step={0.1} value={position} disabled={!duration} onChange={event => { const next = Number(event.target.value); if (video.current) video.current.currentTime = next; setPosition(next); }} aria-label={t('academy.seek')} className="min-w-0 flex-1 accent-white" />
      <span className="text-[10px] tabular-nums">{time(position)} / {time(duration)}</span>
      <button type="button" onClick={() => { if (video.current) video.current.muted = !muted; setMuted(!muted); }} aria-label={t(muted ? 'academy.unmute' : 'academy.mute')} className="p-1">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
      <button type="button" onClick={() => { void root.current?.requestFullscreen?.().catch(() => {}); }} aria-label={t('academy.fullscreen')} className="p-1"><Maximize className="h-4 w-4" /></button>
    </div>}
    {failed && <p role="status" className="absolute inset-0 flex items-center justify-center bg-black/80 p-5 text-center text-sm">{t('academy.videoUnavailable')}</p>}
  </div>;
}
