import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, Maximize2, Minimize2, Pause, Play, Repeat, Sparkles } from 'lucide-react';
import { useTranslation } from 'next-i18next';
import { bookFontFamily } from './bookFonts';

// ============================================================
// Children's Book — on-site flip book. Opens on the front cover like a real
// book; turning a page is a 3D page turn (the right-hand leaf swings over
// the spine on a wide screen, a single page turns on a phone). Reading
// order, the same on every screen:
//   0 front cover · 1 title page · 2..N+1 story pages · N+2 back cover
// On a wide screen every story page is a spread (picture left, words
// right); on a phone the picture sits above the words on one page.
// "Play Full Story" reads every page aloud and turns the page by itself
// when the narration of a page ends. Used by the owner's reader and by the
// public /book/<token> page, which only differ in where the files come from.
// No dependency: plain CSS 3D transforms, honouring prefers-reduced-motion.
// ============================================================

export interface FlipBookPage {
  pageNumber: number;
  storyText: string;
  imageUrl: string | null;
  audioUrl: string | null;
}

export interface FlipBookData {
  title: string;
  heroName: string | null;
  dedication: string | null;
  blurb: string | null;
  fontId: string | null;
  coverUrl: string | null;
  portraitUrl: string | null;
  pages: FlipBookPage[];
}

interface FlipBookProps {
  book: FlipBookData;
  // Narration exists for this book (it may still be on its way).
  hasNarration: boolean;
  audioPreparing?: boolean;
  onDownloadMp3?: (() => void) | null;
  downloadingMp3?: boolean;
  createUrl?: string | null;
  // Shown under the book (e.g. the owner's manual "generate audio" fallback).
  footer?: ReactNode;
}

const FLIP_MS = 750;
const AUTO_TURN_PAUSE_MS = 900;

type Flip = { from: number; to: number; dir: 1 | -1 };
type Side = 'left' | 'right' | 'single';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export default function FlipBook({ book, hasNarration, audioPreparing, onDownloadMp3, downloadingMp3, createUrl, footer }: FlipBookProps) {
  const { t } = useTranslation('childrensBook');
  const total = book.pages.length;
  const lastView = total + 2;
  const wide = useMediaQuery('(min-width: 900px)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [view, setView] = useState(0);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [playing, setPlaying] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const autoTurnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);
  const font = bookFontFamily(book.fontId);

  const storyIndex = (v: number) => (v >= 2 && v <= total + 1 ? v - 2 : -1);
  const currentStory = storyIndex(view);
  const currentPage = currentStory >= 0 ? book.pages[currentStory] : null;
  const allAudioReady = total > 0 && book.pages.every((p) => !!p.audioUrl);

  const goTo = useCallback((target: number) => {
    const next = Math.max(0, Math.min(lastView, target));
    if (next === view || flip) return;
    audioRef.current?.pause();
    setCurrentTime(0);
    setDuration(0);
    if (reducedMotion) {
      setView(next);
      return;
    }
    setFlip({ from: view, to: next, dir: next > view ? 1 : -1 });
  }, [flip, lastView, reducedMotion, view]);

  const finishFlip = useCallback(() => {
    setFlip((current) => {
      if (current) setView(current.to);
      return null;
    });
  }, []);

  function userTurn(target: number) {
    // A manual turn ends "read to me" so the book doesn't run away.
    if (autoTurnRef.current) clearTimeout(autoTurnRef.current);
    setReadAloud(false);
    goTo(target);
  }

  // Keyboard: ← → turn pages, space plays/pauses.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'ArrowRight') userTurn(view + 1);
      if (event.key === 'ArrowLeft') userTurn(view - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => () => {
    if (autoTurnRef.current) clearTimeout(autoTurnRef.current);
  }, []);

  // Read-to-me: once a story page is open, play it.
  useEffect(() => {
    if (!readAloud || flip || !currentPage?.audioUrl) return;
    const player = audioRef.current;
    if (!player) return;
    player.currentTime = 0;
    player.play().catch(() => {
      setReadAloud(false);
      setError(t('readerPlaybackContinueFailed'));
    });
  }, [readAloud, flip, view, currentPage?.audioUrl, t]);

  function handleEnded() {
    setPlaying(false);
    if (!readAloud) return;
    autoTurnRef.current = setTimeout(() => {
      if (view < total + 1) goTo(view + 1);
      else {
        setReadAloud(false);
        goTo(lastView);
      }
    }, AUTO_TURN_PAUSE_MS);
  }

  async function togglePlay() {
    const player = audioRef.current;
    if (!player || !currentPage?.audioUrl) return;
    setError(null);
    if (playing) {
      player.pause();
      setReadAloud(false);
      return;
    }
    try {
      await player.play();
    } catch {
      setError(t('readerPlaybackFailed'));
    }
  }

  function playFullStory() {
    setError(null);
    setReadAloud(true);
    if (currentStory < 0) goTo(2);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shellRef.current?.requestFullscreen();
    } catch {
      /* not supported (iPhone Safari): ignore */
    }
  }

  // ---------- page faces ----------
  const paper = 'bg-[#fffaf2]';

  const renderCover = () => (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-purple-800 via-fuchsia-700 to-amber-500">
      {book.coverUrl && <img src={book.coverUrl} alt={t('flipCoverAlt', { title: book.title })} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      <div className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-[#140a24]/80 via-[#140a24]/35 to-transparent" />
      <div className="relative px-[8%] pt-[9%] text-center">
        <h2 className="text-[clamp(1.6rem,3.4vw,2.5rem)] font-bold leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]"><span style={{ fontFamily: font }}>{book.title}</span></h2>
        {book.heroName && <p className="mt-3 text-[clamp(0.9rem,1.6vw,1.15rem)] text-amber-100 drop-shadow" style={{ fontFamily: font }}>{t('flipStarring', { name: book.heroName })}</p>}
      </div>
      <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/35 to-transparent" />
    </div>
  );

  const portrait = (size: string) => (book.portraitUrl ? (
    <div className={`${size} mx-auto overflow-hidden rounded-full border-4 border-white shadow-lg ring-2 ring-purple-200`}>
      <img src={book.portraitUrl} alt={book.heroName ?? ''} className="h-full w-full object-cover" draggable={false} onError={(event) => { const frame = event.currentTarget.parentElement; if (frame) frame.style.display = 'none'; }} />
    </div>
  ) : null);

  const renderTitleLeft = () => (
    <div className={`flex h-full flex-col items-center justify-center gap-4 px-[10%] text-center ${paper}`}>
      {portrait('w-[55%] aspect-square')}
      {book.heroName && (
        <div>
          <p className="text-sm text-gray-500">{t('flipBelongsTo')}</p>
          <p className="mt-1 text-2xl font-bold text-purple-800" style={{ fontFamily: font }}>{book.heroName}</p>
        </div>
      )}
    </div>
  );

  const renderTitleRight = () => (
    <div className={`flex h-full flex-col items-center gap-4 overflow-y-auto px-[10%] py-8 text-center ${paper} [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto`}>
      <h2 className="text-[clamp(1.4rem,2.6vw,2.1rem)] font-bold leading-tight text-gray-900"><span style={{ fontFamily: font }}>{book.title}</span></h2>
      {book.dedication && <p className="italic text-gray-500" style={{ fontFamily: font }}>„{book.dedication}“</p>}
      {book.blurb && (
        <>
          <span className="h-px w-16 bg-purple-300" aria-hidden />
          <p className="text-[clamp(0.95rem,1.4vw,1.1rem)] leading-relaxed text-gray-700" style={{ fontFamily: font }}>{book.blurb}</p>
        </>
      )}
    </div>
  );

  const renderTitleSingle = () => (
    <div className={`flex h-full flex-col items-center gap-3 overflow-y-auto px-6 py-6 text-center ${paper} [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto`}>
      {portrait('w-28 h-28')}
      {book.heroName && <p className="text-xs text-gray-500">{t('flipBelongsTo')} <span className="font-bold text-purple-800" style={{ fontFamily: font }}>{book.heroName}</span></p>}
      <h2 className="text-2xl font-bold leading-tight text-gray-900"><span style={{ fontFamily: font }}>{book.title}</span></h2>
      {book.dedication && <p className="text-sm italic text-gray-500" style={{ fontFamily: font }}>„{book.dedication}“</p>}
      {book.blurb && <p className="text-[15px] leading-relaxed text-gray-700" style={{ fontFamily: font }}>{book.blurb}</p>}
    </div>
  );

  const renderStoryImage = (page: FlipBookPage) => (
    <div className="relative h-full w-full overflow-hidden bg-purple-50">
      {page.imageUrl
        ? <img src={page.imageUrl} alt={t('readerImageAlt', { title: book.title, number: page.pageNumber })} className="h-full w-full object-cover" draggable={false} />
        : <div className="flex h-full items-center justify-center text-sm text-gray-400">{t('readerIllustrationUnavailable')}</div>}
      <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/20 to-transparent" />
    </div>
  );

  const renderStoryText = (page: FlipBookPage) => (
    <div className={`relative flex h-full flex-col overflow-y-auto px-[11%] py-10 ${paper}`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/10 to-transparent" />
      <div className="my-auto">
      <p className="whitespace-pre-wrap text-center text-[clamp(1.05rem,1.8vw,1.45rem)] leading-[1.75] text-gray-800" style={{ fontFamily: font }}>{page.storyText || t('readerStoryTextUnavailable')}</p>
      {page.pageNumber === total && <p className="mt-8 text-center text-lg font-semibold text-purple-700" style={{ fontFamily: font }}>{t('flipTheEnd')}</p>}
      </div>
      <span className="absolute inset-x-0 bottom-4 text-center text-xs text-gray-400">{page.pageNumber}</span>
    </div>
  );

  const renderStorySingle = (page: FlipBookPage) => (
    <div className={`flex h-full flex-col ${paper}`}>
      <div className="aspect-[5/4] w-full shrink-0 overflow-hidden bg-purple-50">
        {page.imageUrl
          ? <img src={page.imageUrl} alt={t('readerImageAlt', { title: book.title, number: page.pageNumber })} className="h-full w-full object-cover" draggable={false} />
          : <div className="flex h-full items-center justify-center text-sm text-gray-400">{t('readerIllustrationUnavailable')}</div>}
      </div>
      {/* my-auto centres short text but lets long text scroll from its top */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-3 pt-4">
        <div className="my-auto">
          <p className="whitespace-pre-wrap text-center text-[16px] leading-[1.6] text-gray-800" style={{ fontFamily: font }}>{page.storyText || t('readerStoryTextUnavailable')}</p>
          {page.pageNumber === total && <p className="mt-3 text-center font-semibold text-purple-700" style={{ fontFamily: font }}>{t('flipTheEnd')}</p>}
        </div>
        <span className="mt-2 text-center text-[11px] text-gray-400">{page.pageNumber}</span>
      </div>
    </div>
  );

  const renderBackCover = () => (
    <div className="flex h-full flex-col items-center gap-4 overflow-y-auto bg-gradient-to-b from-[#3b1f63] to-[#24123f] px-[10%] py-8 [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto text-center text-white">
      {portrait('w-24 h-24')}
      <h2 className="text-xl font-bold leading-tight"><span style={{ fontFamily: font }}>{book.title}</span></h2>
      {book.blurb && <p className="text-sm leading-relaxed text-purple-100" style={{ fontFamily: font }}>{book.blurb}</p>}
      {onDownloadMp3 && allAudioReady && (
        <button onClick={onDownloadMp3} disabled={downloadingMp3} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/40 hover:bg-white/25 disabled:opacity-60">
          {downloadingMp3 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('flipDownloadMp3')}
        </button>
      )}
      {createUrl && (
        <div className="mt-2 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
          <p className="text-sm text-purple-100">{t('flipCreateOwnHint')}</p>
          <a href={createUrl} className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-[#24123f] hover:bg-amber-300">
            <Sparkles className="h-4 w-4" /> {t('flipCreateOwn')}
          </a>
        </div>
      )}
      <p className="text-[11px] text-purple-200/80">cdc.org.ge</p>
    </div>
  );

  function face(v: number, side: Side): ReactNode {
    if (v === 0) return side === 'left' ? null : renderCover();
    if (v === lastView) return side === 'right' ? null : renderBackCover();
    if (v === 1) return side === 'left' ? renderTitleLeft() : side === 'right' ? renderTitleRight() : renderTitleSingle();
    const page = book.pages[storyIndex(v)];
    if (!page) return null;
    return side === 'left' ? renderStoryImage(page) : side === 'right' ? renderStoryText(page) : renderStorySingle(page);
  }

  // Paper only where there is a page (the cover's left half and the back
  // cover's right half are empty: the closed book sits in the middle).
  const half = (v: number, side: 'left' | 'right') => {
    const content = face(v, side);
    return <div className={`absolute inset-y-0 w-1/2 overflow-hidden ${side === 'left' ? 'left-0 rounded-l-md' : 'left-1/2 rounded-r-md'} ${content ? 'shadow-[0_10px_30px_rgba(40,20,70,0.25)]' : ''}`}>{content}</div>;
  };

  // Closed book: shift so the visible cover is centred.
  const shiftFor = (v: number) => (v === 0 ? '-25%' : v === lastView ? '25%' : '0%');
  const shownView = flip ? flip.to : view;

  let stage: ReactNode;
  if (wide) {
    stage = (
      <div className="relative mx-auto aspect-[1.8/1] w-full max-w-[1100px] [perspective:2200px]" style={{ maxWidth: fullscreen ? 'min(96vw, calc((100vh - 140px) * 1.8))' : undefined }}>
        <div className="absolute inset-0 transition-transform duration-700 ease-in-out" style={{ transform: `translateX(${shiftFor(shownView)})` }}>
          {!flip && <>{half(view, 'left')}{half(view, 'right')}</>}
          {flip && flip.dir === 1 && (
            <>
              {half(flip.from, 'left')}
              {half(flip.to, 'right')}
              <div className="absolute inset-y-0 left-1/2 w-1/2 [transform-style:preserve-3d]" style={{ transformOrigin: 'left center', animation: `cdcFlipNext ${FLIP_MS}ms cubic-bezier(.45,.05,.35,1) forwards` }} onAnimationEnd={finishFlip}>
                <div className="absolute inset-0 overflow-hidden rounded-r-md [backface-visibility:hidden]">{face(flip.from, 'right')}<div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/0 to-black/30" style={{ animation: `cdcShade ${FLIP_MS}ms ease-in-out forwards` }} /></div>
                <div className="absolute inset-0 overflow-hidden rounded-l-md [backface-visibility:hidden] [transform:rotateY(180deg)]">{face(flip.to, 'left')}</div>
              </div>
            </>
          )}
          {flip && flip.dir === -1 && (
            <>
              {half(flip.to, 'left')}
              {half(flip.from, 'right')}
              <div className="absolute inset-y-0 left-0 w-1/2 [transform-style:preserve-3d]" style={{ transformOrigin: 'right center', animation: `cdcFlipPrev ${FLIP_MS}ms cubic-bezier(.45,.05,.35,1) forwards` }} onAnimationEnd={finishFlip}>
                <div className="absolute inset-0 overflow-hidden rounded-l-md [backface-visibility:hidden]">{face(flip.from, 'left')}<div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/0 to-black/30" style={{ animation: `cdcShade ${FLIP_MS}ms ease-in-out forwards` }} /></div>
                <div className="absolute inset-0 overflow-hidden rounded-r-md [backface-visibility:hidden] [transform:rotateY(180deg)]">{face(flip.to, 'right')}</div>
              </div>
            </>
          )}
          {shownView !== 0 && shownView !== lastView && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/10" aria-hidden />}
        </div>
      </div>
    );
  } else {
    stage = (
      <div className="relative mx-auto aspect-[1/1.55] w-full max-w-[460px] [perspective:1600px]">
        {!flip && <div className="absolute inset-0 overflow-hidden rounded-md shadow-[0_10px_30px_rgba(40,20,70,0.25)]">{face(view, 'single')}</div>}
        {flip && (
          <>
            <div className="absolute inset-0 overflow-hidden rounded-md shadow-[0_10px_30px_rgba(40,20,70,0.25)]">{face(flip.dir === 1 ? flip.to : flip.from, 'single')}</div>
            <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ transformOrigin: 'left center', animation: `${flip.dir === 1 ? 'cdcFlipNext' : 'cdcFlipIn'} ${FLIP_MS}ms cubic-bezier(.45,.05,.35,1) forwards` }} onAnimationEnd={finishFlip}>
              <div className="absolute inset-0 overflow-hidden rounded-md shadow-xl [backface-visibility:hidden]">{face(flip.dir === 1 ? flip.from : flip.to, 'single')}</div>
              <div className={`absolute inset-0 rounded-md ${paper} [backface-visibility:hidden] [transform:rotateY(180deg)]`} />
            </div>
          </>
        )}
      </div>
    );
  }

  const position = view === 0 ? t('flipCover') : view === 1 ? t('flipTitlePage') : view === lastView ? t('flipBackCover') : t('readerPageOf', { number: currentStory + 1, total });
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div ref={shellRef} className={fullscreen ? 'flex h-full flex-col justify-center overflow-auto bg-[#f4effa] p-4' : ''}>
      <style>{`
        @keyframes cdcFlipNext { from { transform: rotateY(0deg); } to { transform: rotateY(-180deg); } }
        @keyframes cdcFlipPrev { from { transform: rotateY(0deg); } to { transform: rotateY(180deg); } }
        @keyframes cdcFlipIn { from { transform: rotateY(-180deg); } to { transform: rotateY(0deg); } }
        @keyframes cdcShade { 0% { opacity: 0; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
      `}</style>

      <div
        className="select-none"
        onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          touchX.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (start === null || end === undefined || Math.abs(end - start) < 50) return;
          userTurn(end < start ? view + 1 : view - 1);
        }}
        onClick={(event) => {
          // Tapping the right/left third of the book turns the page.
          if ((event.target as HTMLElement).closest('a,button')) return;
          const box = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - box.left) / box.width;
          if (x > 0.66) userTurn(view + 1);
          else if (x < 0.34) userTurn(view - 1);
        }}
      >
        {stage}
      </div>

      <div className="mx-auto mt-5 flex max-w-[1100px] items-center justify-between gap-3">
        <button disabled={view <= 0 || !!flip} onClick={() => userTurn(view - 1)} className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-800 shadow-sm disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />{t('readerPrevious')}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600" aria-live="polite">{position}</span>
          <button onClick={toggleFullscreen} className="hidden rounded-full p-2 text-gray-500 hover:bg-purple-50 hover:text-purple-700 sm:inline-flex" aria-label={t('flipFullscreen')} title={t('flipFullscreen')}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
        <button disabled={view >= lastView || !!flip} onClick={() => userTurn(view + 1)} className="inline-flex items-center gap-1 rounded-full bg-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-40">
          {view === 0 ? t('flipOpenBook') : t('readerNext')}<ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {view === 0 && <p className="mt-2 text-center text-xs text-gray-400">{t('flipSwipeHint')}</p>}

      {error && <p role="alert" className="mx-auto mt-3 max-w-[1100px] text-sm text-red-700">{error}</p>}

      {hasNarration && (
        <section className="mx-auto mt-5 max-w-[1100px] rounded-2xl border border-purple-100 bg-white p-4 shadow-sm" aria-label="Audio controls">
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={!currentPage?.audioUrl || !!flip} onClick={togglePlay} className="inline-flex items-center gap-2 rounded-full bg-purple-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? t('readerPause') : t('readerPlay')}
            </button>
            <button disabled={!allAudioReady || readAloud} onClick={playFullStory} className="inline-flex items-center gap-2 rounded-full border border-purple-300 px-4 py-2 text-sm font-medium text-purple-700 disabled:opacity-40">
              <Repeat className="h-4 w-4" />{t('readerPlayFullStory')}
            </button>
            {onDownloadMp3 && (
              <button disabled={!allAudioReady || downloadingMp3} onClick={onDownloadMp3} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40">
                {downloadingMp3 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t('flipDownloadMp3')}
              </button>
            )}
            {audioPreparing && <span className="inline-flex items-center gap-1.5 text-sm text-purple-700"><Loader2 className="h-4 w-4 animate-spin" />{t('readerPreparingAudio')}</span>}
            {readAloud && <span className="text-sm text-purple-700">{t('flipReadingAloud')}</span>}
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-purple-100" role="progressbar" aria-label="Audio progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <div className="h-full bg-purple-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <audio
            ref={audioRef}
            src={currentPage?.audioUrl ?? undefined}
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
            onEnded={handleEnded}
            className="sr-only"
          />
        </section>
      )}
      {footer}
    </div>
  );
}
