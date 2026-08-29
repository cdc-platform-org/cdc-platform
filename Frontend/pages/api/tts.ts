import type { NextApiRequest, NextApiResponse } from 'next';

// Server-side proxy for VIPAudioNarrator's Georgian narration fallback
// (src/components/ui/VIPAudioNarrator.tsx), backed by Azure Cognitive
// Services Speech's real, documented TTS REST API — replaces an earlier
// attempt at proxying Google Translate's undocumented translate_tts
// endpoint, which was abandoned after direct testing showed it rejects
// `tl=ka` outright (400, regardless of text) — Google Translate simply has
// no Georgian voice, on any request shape. Azure Speech does: ka-GE-EkaNeural
// (female) and ka-GE-GiorgiNeural (male), both real neural voices.
//
// Requires AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in the environment (same
// "reads from env, never hardcoded, absence degrades cleanly" pattern as
// GEMINI_API_KEY/STRIPE_SECRET_KEY elsewhere in this codebase) — returns 501
// until those are set, which the frontend surfaces as a "needs an API key"
// message rather than a generic error.
const MAX_TEXT_LENGTH = 3000; // well within Azure's documented per-request SSML limit
const ALLOWED_VOICES = new Set(['ka-GE-EkaNeural', 'ka-GE-GiorgiNeural']);
const DEFAULT_VOICE = 'ka-GE-EkaNeural';

// `text` narrated here can originate from user-generated content (forum
// posts, AI chat replies) that this route embeds into an SSML request body
// — escaped so it can't break out of the <voice> element or inject its own
// SSML/XML (e.g. a forum post containing literal `</voice><voice name=...>`).
function escapeSsmlText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice } = req.query;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Missing text.' });
  }

  // Allowlisted rather than escaped — this value also fills the SSML
  // `name`/`xml:lang` attributes (not just element text), so only two known-
  // safe literals are accepted rather than trying to sanitize an attribute.
  const effectiveVoice = typeof voice === 'string' && ALLOWED_VOICES.has(voice) ? voice : DEFAULT_VOICE;
  const lang = effectiveVoice.split('-').slice(0, 2).join('-'); // 'ka-GE-EkaNeural' -> 'ka-GE'
  const truncatedText = text.slice(0, MAX_TEXT_LENGTH);

  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION;
  if (!azureKey || !azureRegion) {
    return res.status(501).json({ error: 'Azure Speech is not configured (AZURE_SPEECH_KEY/AZURE_SPEECH_REGION).' });
  }

  const ssml = `<speak version="1.0" xml:lang="${lang}"><voice xml:lang="${lang}" name="${effectiveVoice}">${escapeSsmlText(truncatedText)}</voice></speak>`;

  try {
    const upstream = await fetch(`https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'cdc-platform-tts-proxy',
      },
      body: ssml,
    });

    if (!upstream.ok) {
      // 401/403 (bad/missing key, wrong region) surfaced as-is so the
      // frontend can show a distinct "needs an API key" message rather than
      // its generic transient-failure one; everything else upstream is
      // reported as a 502 (this proxy's own fault, not the caller's).
      console.error(`[api/tts] Azure Speech returned ${upstream.status}`);
      const status = upstream.status === 401 || upstream.status === 403 ? upstream.status : 502;
      return res.status(status).json({ error: 'Azure Speech request failed.' });
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(audioBuffer);
  } catch (error) {
    console.error('[api/tts] Azure Speech fetch failed:', error instanceof Error ? error.message : error);
    return res.status(502).json({ error: 'Azure Speech request failed.' });
  }
}
