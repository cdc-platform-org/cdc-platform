import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

export interface LightboxImage {
  url: string;
  alt?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  // null = closed. Any other index opens the lightbox at that image.
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const SWIPE_THRESHOLD_PX = 50;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.5;

function distanceBetween(a: React.Touch, b: React.Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

// Full-screen image viewer reused across the photo gallery, blog post
// content images, product gallery, and success-story avatars — Esc/
// backdrop-click closes, ←/→ (and on-screen arrows) cycle with wraparound,
// a touch swipe does the same on mobile, and +/- buttons or a two-finger
// pinch zoom in on the current image (drag/single-finger-move pans while
// zoomed in; swipe-to-navigate only applies at the default 1x zoom, so
// panning and navigating gestures never fight each other). Renders nothing
// when index is null.
export default function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  const isOpen = index !== null && images.length > 0;
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef(1);

  useEscapeToClose(isOpen, onClose);

  // Move focus into the dialog on open so keyboard/screen-reader users land
  // somewhere sensible rather than the still-focused trigger button behind it.
  useEffect(() => {
    if (isOpen) containerRef.current?.focus();
  }, [isOpen]);

  // Reset zoom/pan whenever the viewed image changes (including on open) —
  // carrying a previous image's zoom level onto the next one is disorienting.
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [index]);

  const goPrev = () => {
    if (index === null) return;
    onIndexChange((index - 1 + images.length) % images.length);
  };
  const goNext = () => {
    if (index === null) return;
    onIndexChange((index + 1) % images.length);
  };

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP));
  const zoomOut = () =>
    setScale((s) => {
      const next = Math.max(MIN_SCALE, s - ZOOM_STEP);
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-') zoomOut();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, index, images.length]);

  // Lock page scroll while the lightbox is open.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || index === null) return null;
  const current = images[index];
  const hasMultiple = images.length > 1;
  const isZoomed = scale > 1;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartDistance.current = distanceBetween(e.touches[0], e.touches[1]);
      pinchStartScale.current = scale;
      touchStartX.current = null;
      return;
    }
    if (isZoomed) {
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, offsetX: offset.x, offsetY: offset.y };
    } else {
      touchStartX.current = e.touches[0]?.clientX ?? null;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistance.current !== null) {
      const newDistance = distanceBetween(e.touches[0], e.touches[1]);
      const ratio = newDistance / pinchStartDistance.current;
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale.current * ratio)));
      return;
    }
    if (dragStart.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setOffset({ x: dragStart.current.offsetX + dx, y: dragStart.current.offsetY + dy });
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    pinchStartDistance.current = null;
    dragStart.current = null;
    if (touchStartX.current === null) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (deltaX > 0) goPrev();
    else goNext();
  };

  // Mouse drag-to-pan — only meaningful once zoomed in.
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isZoomed) return;
    e.preventDefault();
    dragStart.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    setOffset({ x: dragStart.current.offsetX + (e.clientX - dragStart.current.x), y: dragStart.current.offsetY + (e.clientY - dragStart.current.y) });
  };
  const stopDrag = () => {
    dragStart.current = null;
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt || 'Image viewer'}
      tabIndex={-1}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-8 outline-none"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
      >
        <X size={20} />
      </button>

      {/* Zoom controls — top-left, mirroring Close's top-right placement. */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ZoomOut size={18} />
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous image"
          className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt || ''}
        onError={onImageErrorFallback}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (isZoomed) {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          } else {
            setScale(2);
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        draggable={false}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: dragStart.current ? 'none' : 'transform 0.2s ease-out',
          cursor: isZoomed ? 'grab' : 'zoom-in',
        }}
        className="max-w-full max-h-full object-contain rounded-lg select-none"
      />

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next image"
          className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {hasMultiple && (
        <span aria-live="polite" className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-xs font-bold tracking-wider">
          {index + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
