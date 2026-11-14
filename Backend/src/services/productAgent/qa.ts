/**
 * Product agent — visual quality check of a generated picture before it
 * goes into a product, using the platform's Azure OpenAI vision model.
 * Exports: ArtworkKind, inspectArtwork.
 *
 * Catches the usual image-model defects (stray letters/fake signatures,
 * mangled hands/faces, an unwanted frame or wall, grey fill on a coloring
 * page, a busy wall where the mockup frames go). ai.ts regenerates once
 * when this fails. The check costs about a cent (small 512 px JPEG).
 */
import sharp from 'sharp';
import { z } from 'zod';
import { callAzureChatCompletionFull } from '../ai/azureChatCompletionService';
import type { RunCost } from './ai';

export type ArtworkKind = 'art' | 'lineart' | 'background' | 'room';

const CHECKS: Record<ArtworkKind, string> = {
  art: 'a wall-art print. Fail if: any text, letters, numbers, signature or watermark; a picture frame, mat, wall or room is shown around the art; deformed faces/hands/anatomy; obvious AI glitches; muddy or low-detail result unfit for printing.',
  lineart: 'a children’s coloring page. Fail if: any text or letters; grey/coloured fills or heavy shading (must be black outlines on white); broken, very thin or messy lines; scary or unsuitable content for small kids; deformed anatomy.',
  background: 'a decorative background for an invitation or flyer. Fail if: any text, letters or numbers; for an invitation, the centre is not a calm empty area for text; obvious AI glitches.',
  room: 'an interior photo used as a mockup background. Fail if: something hangs on the upper wall (pictures, frames, shelves, mirrors, TV); text anywhere; warped furniture or obvious AI glitches.',
};

const resultSchema = z.object({ ok: z.boolean(), problems: z.array(z.string()).max(6).default([]) });

export async function inspectArtwork(cost: RunCost, image: Buffer, kind: ArtworkKind): Promise<{ ok: boolean; problems: string[] }> {
  try {
    const small = await sharp(image).resize(512, 512, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
    const res = await callAzureChatCompletionFull({
      jsonMode: true,
      temperature: 0,
      maxOutputTokens: 300,
      messages: [
        { role: 'system', content: 'You are a strict quality inspector for a print shop. Answer only with JSON {"ok": boolean, "problems": [short strings]}.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Inspect this image. It is ${CHECKS[kind]} Minor stylistic imperfections are fine.` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${small.toString('base64')}`, detail: 'low' } },
          ],
        },
      ],
    });
    cost.addText(res.usage);
    const parsed = resultSchema.safeParse(JSON.parse(res.content));
    return parsed.success ? parsed.data : { ok: true, problems: [] };
  } catch (err) {
    // The inspector must never block production on its own failure.
    console.error('[product-agent] artwork inspection failed, accepting image:', err instanceof Error ? err.message : err);
    return { ok: true, problems: [] };
  }
}
