jest.mock('../../utils/env', () => ({ AZURE_SPEECH_KEY: 'test-key', AZURE_SPEECH_REGION: 'test-region' }));

import { synthesizeSpeech } from '../ai/azureSpeechService';

const originalFetch = global.fetch;
let bodies: string[];
beforeEach(() => {
  bodies = [];
  global.fetch = jest.fn(async (url, init) => {
    if (String(url).endsWith('/voices/list')) {
      return new Response(JSON.stringify([
        { ShortName: 'ka-GE-EkaNeural', Locale: 'ka-GE', DisplayName: 'Eka', LocalName: 'Eka', Gender: 'Female' },
        { ShortName: 'en-US-JennyNeural', Locale: 'en-US', DisplayName: 'Jenny', LocalName: 'Jenny', Gender: 'Female', StyleList: ['narration-professional'] },
      ]));
    }
    bodies.push(String(init?.body));
    return new Response(new Uint8Array([0x49, 0x44, 0x33]));
  }) as typeof fetch;
});
afterEach(() => { global.fetch = originalFetch; });

it('uses only a narrative style advertised for the selected voice', async () => {
  await synthesizeSpeech({ text: 'A story.', voiceShortName: 'en-US-JennyNeural', voiceLocale: 'en-US', speed: 0.96, narration: true });
  expect(bodies[0]).toContain('<mstts:express-as style="narration-professional">');
  expect(bodies[0]).toContain('<prosody rate="-4%">');
});

it('does not impose an unsupported expressive style on Georgian voices', async () => {
  await synthesizeSpeech({ text: 'გამარჯობა.', voiceShortName: 'ka-GE-EkaNeural', voiceLocale: 'ka-GE', speed: 1, narration: true });
  expect(bodies[0]).not.toContain('express-as');
  expect(bodies[0]).not.toContain('prosody');
});

it('keeps frontend and backend speech preparation identical', () => {
  const fs = require('fs');
  const path = require('path');
  expect(fs.readFileSync(path.resolve(__dirname, '../../../../Frontend/src/utils/speechSsml.ts'), 'utf8'))
    .toBe(fs.readFileSync(path.resolve(__dirname, '../ai/speechSsml.ts'), 'utf8'));
});
