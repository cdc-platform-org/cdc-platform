// ============================================================
// Children's Book animation — pure planning helpers (no I/O), so the
// page choice and the timeline maths are unit-testable on their own.
// The renderer (bookAnimationRenderer.ts) and the job orchestration
// (bookAnimationService.ts) only consume what is computed here.
// ============================================================

export const ANIMATION_PRICE_TETRI = 1000; // 10 GEL
// Promo codes target the animation through the AI_TOOL type with this fixed
// id (same pattern as 'english-tutor'), so no new coupon enum is needed.
export const ANIMATION_PROMO_TARGET_ID = 'book-animation';

export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const VIDEO_FPS = 25;

export const MIN_SEGMENT_SECONDS = 4;
// Silence kept before and after the narration of each page.
export const NARRATION_LEAD_SECONDS = 0.6;
export const NARRATION_TAIL_SECONDS = 0.9;
export const TRANSITION_SECONDS = 0.8;
export const SORA_CLIP_SECONDS = 8;
// Number of story pages animated by Sora (the cover is always the 4th clip).
export const SORA_STORY_PAGES = 3;

export type SegmentKind = 'cover' | 'page';
export type SegmentMotion = 'sora' | 'kenburns';

export interface SegmentInput {
  kind: SegmentKind;
  // 0 for the cover, otherwise the book page number.
  pageNumber: number;
  // Narration length in seconds (0 when the segment has no narration).
  narrationSeconds: number;
  // A Sora clip is available for this segment.
  hasSoraClip: boolean;
}

export interface TimelineSegment extends SegmentInput {
  index: number;
  motion: SegmentMotion;
  // How long this segment's own video is (transitions overlap neighbours).
  duration: number;
  // Where the segment starts in the final video (after xfade overlaps).
  start: number;
  // Where the narration of the segment starts in the final video.
  narrationStart: number;
  // xfade offset used to join this segment onto the previous ones (null for
  // the first segment).
  xfadeOffset: number | null;
  // Ken Burns variant, cycled so consecutive pages don't move the same way.
  kenBurns: KenBurnsVariant;
}

export type KenBurnsVariant = 'zoom-in' | 'zoom-out' | 'pan-right' | 'pan-left';
const KEN_BURNS_CYCLE: KenBurnsVariant[] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left'];

export interface Timeline {
  segments: TimelineSegment[];
  totalDuration: number;
  transition: number;
}

// Where the narration starts inside a segment: after a short lead-in, and
// for every segment but the first after the incoming transition has ended.
export function narrationOffset(index: number, transition = TRANSITION_SECONDS): number {
  return round3(index === 0 ? NARRATION_LEAD_SECONDS : transition + NARRATION_LEAD_SECONDS / 2);
}

// Segment length = lead-in + narration + tail silence + the outgoing
// transition (which overlaps the next page), never below the minimum. A Sora
// page shows most of its 8 s clip; when the narration is longer the clip's
// last frame is held (see the renderer).
export function segmentDuration(
  input: Pick<SegmentInput, 'narrationSeconds' | 'hasSoraClip'>,
  index = 1,
  transition = TRANSITION_SECONDS
): number {
  const spoken = input.narrationSeconds > 0 ? narrationOffset(index, transition) + input.narrationSeconds + NARRATION_TAIL_SECONDS + transition : 0;
  const floor = input.hasSoraClip ? SORA_CLIP_SECONDS - 1 : MIN_SEGMENT_SECONDS + transition;
  return round3(Math.max(spoken, floor));
}

export function buildTimeline(inputs: SegmentInput[], transition = TRANSITION_SECONDS): Timeline {
  const segments: TimelineSegment[] = [];
  let cursor = 0; // end of the video built so far
  inputs.forEach((input, index) => {
    const duration = segmentDuration(input, index, transition);
    // Each join overlaps the previous segment's tail by `transition` s.
    const start = index === 0 ? 0 : round3(cursor - transition);
    segments.push({
      ...input,
      index,
      motion: input.hasSoraClip ? 'sora' : 'kenburns',
      duration,
      start,
      narrationStart: round3(start + narrationOffset(index, transition)),
      xfadeOffset: index === 0 ? null : start,
      kenBurns: KEN_BURNS_CYCLE[index % KEN_BURNS_CYCLE.length],
    });
    cursor = round3(start + duration);
  });
  return { segments, totalDuration: cursor, transition };
}

// Evenly spaced pages, used when the text model is unavailable or answers
// nonsense. Never page numbers outside 1..pageCount, never duplicates.
export function evenlySpacedPages(pageCount: number, count = SORA_STORY_PAGES): number[] {
  if (pageCount <= 0) return [];
  if (pageCount <= count) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const picked = new Set<number>();
  for (let k = 1; k <= count; k += 1) {
    picked.add(Math.min(pageCount, Math.max(1, Math.round((pageCount * k) / (count + 1)))));
  }
  // Fill any collision with the nearest free page.
  for (let p = 1; picked.size < count && p <= pageCount; p += 1) picked.add(p);
  return [...picked].sort((a, b) => a - b);
}

// Validates what the text model returned ("the 3 most dramatic pages"):
// integers in range, distinct, exactly `count` of them, else the fallback.
export function sanitizeKeyPages(raw: unknown, pageCount: number, count = SORA_STORY_PAGES): number[] {
  const list = Array.isArray(raw) ? raw : [];
  const picked: number[] = [];
  for (const value of list) {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > pageCount || picked.includes(n)) continue;
    picked.push(n);
    if (picked.length === count) break;
  }
  const expected = Math.min(count, pageCount);
  if (picked.length < expected) {
    for (const p of evenlySpacedPages(pageCount, count)) {
      if (picked.length >= expected) break;
      if (!picked.includes(p)) picked.push(p);
    }
  }
  return picked.sort((a, b) => a - b);
}

// Parses the model's JSON answer ({"pages":[..]}), tolerating code fences.
export function parseKeyPagesAnswer(answer: string, pageCount: number, count = SORA_STORY_PAGES): number[] {
  try {
    const cleaned = answer.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return sanitizeKeyPages(Array.isArray(parsed) ? parsed : parsed?.pages, pageCount, count);
  } catch {
    return evenlySpacedPages(pageCount, count);
  }
}

// Seconds of speech for a text when no narration audio exists (silent
// fallback), ~2.4 words/s for a slow read-aloud.
export function estimateReadingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words === 0 ? 0 : round3(words / 2.4);
}

// Wraps a page text into at most `maxLines` lines of ~`width` characters
// for the subtitle bar; overflowing text ends with an ellipsis.
export function wrapSubtitle(text: string, width = 64, maxLines = 3): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= width) line += ' ' + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s.,;:!?-]*$/, '') + '…';
  return kept;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
