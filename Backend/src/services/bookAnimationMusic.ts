// ============================================================
// Children's Book animation — background music. Instead of bundling third-
// party audio files (and tracking their licences), the quiet bed under the
// narration is synthesised here: a soft music-box arpeggio over a warm pad,
// three variations (key/tempo/chord progression). Everything is generated
// by this code, so the music is original CDC work with no third-party
// licence attached (documented in docs/book-animation.md). The renderer
// mixes it far below the narration (see bookAnimationRenderer.ts).
// ============================================================

export interface MusicTheme {
  id: string;
  bpm: number;
  // Root frequency of the key (Hz).
  root: number;
  // Chord progression as semitone offsets of each chord's root from the key.
  progression: number[];
  // Arpeggio pattern as scale degrees within the chord (0 = root, 1 = third, 2 = fifth, 3 = octave).
  pattern: number[];
}

export const MUSIC_THEMES: MusicTheme[] = [
  // "Lullaby" — C major, I–vi–IV–V.
  { id: 'lullaby', bpm: 72, root: 261.63, progression: [0, 9, 5, 7], pattern: [0, 1, 2, 3, 2, 1] },
  // "Meadow" — F major, I–IV–vi–V, a little brighter.
  { id: 'meadow', bpm: 84, root: 174.61 * 2, progression: [0, 5, 9, 7], pattern: [0, 2, 1, 3, 1, 2] },
  // "Starlight" — G major, I–iii–IV–I, slow and dreamy.
  { id: 'starlight', bpm: 64, root: 196.0 * 2, progression: [0, 4, 5, 0], pattern: [3, 2, 1, 0, 1, 2] },
];

const SAMPLE_RATE = 22050;

// Minor chords for the vi and iii degrees of a major key, major otherwise.
function chordIntervals(offset: number): [number, number, number, number] {
  const minor = offset === 9 || offset === 4 || offset === 2;
  return [0, minor ? 3 : 4, 7, 12];
}

function semis(freq: number, n: number): number {
  return freq * Math.pow(2, n / 12);
}

export function pickMusicTheme(seed: string): MusicTheme {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MUSIC_THEMES[h % MUSIC_THEMES.length];
}

// Mono 16-bit PCM WAV of `seconds` length.
export function synthesizeMusicWav(theme: MusicTheme, seconds: number): Buffer {
  const total = Math.max(1, Math.ceil(seconds * SAMPLE_RATE));
  const out = new Float32Array(total);
  const beat = 60 / theme.bpm;
  const noteLen = beat / 2; // eighth notes
  const notesPerChord = theme.pattern.length * 2; // two passes of the pattern per chord
  const chordLen = noteLen * notesPerChord;

  // Music-box notes: a sine with a quiet 2nd/3rd harmonic and a fast
  // exponential decay.
  const noteCount = Math.ceil(seconds / noteLen);
  for (let i = 0; i < noteCount; i += 1) {
    const chordIndex = Math.floor(i / notesPerChord) % theme.progression.length;
    const offset = theme.progression[chordIndex];
    const degree = theme.pattern[i % theme.pattern.length];
    const freq = semis(theme.root, offset + chordIntervals(offset)[degree]);
    const startSample = Math.floor(i * noteLen * SAMPLE_RATE);
    const length = Math.min(total - startSample, Math.floor(1.6 * SAMPLE_RATE));
    const accent = i % theme.pattern.length === 0 ? 1 : 0.75;
    for (let s = 0; s < length; s += 1) {
      const t = s / SAMPLE_RATE;
      const env = Math.exp(-t * 3.2) * Math.min(1, t * 400);
      const w = 2 * Math.PI * freq * t;
      out[startSample + s] += accent * env * (0.55 * Math.sin(w) + 0.12 * Math.sin(2 * w) + 0.05 * Math.sin(3 * w));
    }
  }

  // Soft pad: the chord's root and fifth an octave down, slow fade per chord.
  const chordCount = Math.ceil(seconds / chordLen);
  for (let c = 0; c < chordCount; c += 1) {
    const offset = theme.progression[c % theme.progression.length];
    const intervals = chordIntervals(offset);
    const startSample = Math.floor(c * chordLen * SAMPLE_RATE);
    const length = Math.min(total - startSample, Math.floor(chordLen * SAMPLE_RATE));
    const f1 = semis(theme.root / 2, offset);
    const f2 = semis(theme.root / 2, offset + intervals[2]);
    for (let s = 0; s < length; s += 1) {
      const t = s / SAMPLE_RATE;
      const pos = s / length;
      const env = Math.sin(Math.PI * pos) ** 0.6;
      out[startSample + s] += 0.12 * env * (Math.sin(2 * Math.PI * f1 * t) + 0.7 * Math.sin(2 * Math.PI * f2 * t));
    }
  }

  // Normalise to a modest peak; the mixer sets the final level.
  let peak = 0;
  for (let i = 0; i < total; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0 ? 0.7 / peak : 0;

  const dataSize = total * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < total; i += 1) {
    buffer.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(out[i] * gain * 32767))), 44 + i * 2);
  }
  return buffer;
}
