import { AZURE_TTS_OUTPUT_FORMAT, buildSsml, normalizeTextForSpeech, speedToProsodyRate } from '../speechSsml';

describe('normalizeTextForSpeech', () => {
  it('strips markdown, links and emoji instead of reading them aloud', () => {
    const out = normalizeTextForSpeech('## სათაური\n\n**მნიშვნელოვანი** ტექსტი 🎉 [ბმული](https://example.com) `კოდი`', 'ka-GE');
    expect(out).toBe('სათაური.\n\nმნიშვნელოვანი ტექსტი ბმული კოდი.');
  });

  it('expands unambiguous Georgian abbreviations for ka voices only', () => {
    expect(normalizeTextForSpeech('ვაშლი, მსხალი და ა.შ.', 'ka-GE')).toBe('ვაშლი, მსხალი და ასე შემდეგ.');
    expect(normalizeTextForSpeech('მაგ. ასე, ე.ი. სწორია, ე.წ. მეთოდი.', 'ka-GE')).toBe('მაგალითად ასე, ესე იგი სწორია, ეგრეთ წოდებული მეთოდი.');
    expect(normalizeTextForSpeech('მაგ. ასე', 'en-US')).toBe('მაგ. ასე.');
  });

  it('keeps paragraph boundaries, ends list items with punctuation, tidies typography', () => {
    const out = normalizeTextForSpeech('- პირველი\n- მეორე\n\nრა — როგორ?? “ციტატა”…', 'ka-GE');
    expect(out).toBe('პირველი. მეორე.\n\nრა, როგორ? "ციტატა"...');
  });

  it('returns empty string when nothing readable remains', () => {
    expect(normalizeTextForSpeech('🎉 ✨ **', 'ka-GE')).toBe('');
  });
});

describe('speedToProsodyRate', () => {
  it('omits prosody at normal speed and clamps the range', () => {
    expect(speedToProsodyRate(1)).toBeNull();
    expect(speedToProsodyRate(0.9)).toBe('-10%');
    expect(speedToProsodyRate(1.25)).toBe('+25%');
    expect(speedToProsodyRate(5)).toBe('+100%');
    expect(speedToProsodyRate(NaN)).toBeNull();
  });
});

describe('buildSsml', () => {
  it('builds a namespaced document with trimmed silence and paragraph breaks', () => {
    const ssml = buildSsml({ text: 'პირველი.\n\nმეორე.', voiceShortName: 'ka-GE-EkaNeural', locale: 'ka-GE', speed: 1 });
    expect(ssml).toContain('xmlns:mstts="https://www.w3.org/2001/mstts"');
    expect(ssml).toContain('<voice name="ka-GE-EkaNeural">');
    expect(ssml).toContain('<mstts:silence type="Leading-exact" value="80ms"/>');
    expect(ssml).toContain('პირველი. <break time="550ms"/> მეორე.');
    expect(ssml).not.toContain('<prosody');
  });

  it('wraps in prosody only when speed differs and escapes user text', () => {
    const ssml = buildSsml({ text: 'a </voice><voice name="x"> b', voiceShortName: 'en-US-AnaNeural', locale: 'en-US', speed: 0.9 });
    expect(ssml).toContain('<prosody rate="-10%">');
    expect(ssml).not.toContain('</voice><voice name="x">');
  });

  it('uses the native 24 kHz neural output format', () => {
    expect(AZURE_TTS_OUTPUT_FORMAT).toBe('audio-24khz-96kbitrate-mono-mp3');
  });
});
