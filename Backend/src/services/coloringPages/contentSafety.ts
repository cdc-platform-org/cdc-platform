/**
 * Azure AI Content Safety client (text + image analysis) used by the
 * coloring-page tool. Exports: isContentSafetyConfigured, analyzeText,
 * analyzeImage, SafetyVerdict.
 *
 * The decision of WHAT to block lives in coloringSafety.ts; this file only
 * calls the API and returns the per-category severities.
 */
import sharp from 'sharp';
import { AZURE_CONTENT_SAFETY_ENDPOINT, AZURE_CONTENT_SAFETY_KEY } from '../../utils/env';

const API_VERSION = '2024-09-01';
const TIMEOUT_MS = 15_000;

export interface SafetyVerdict {
  // Highest severity seen in any category (0, 2, 4 or 6 on the
  // FourSeverityLevels scale) and which category produced it.
  maxSeverity: number;
  category: string | null;
}

export function isContentSafetyConfigured(): boolean {
  return !!AZURE_CONTENT_SAFETY_ENDPOINT && !!AZURE_CONTENT_SAFETY_KEY;
}

async function post(path: string, body: unknown): Promise<SafetyVerdict> {
  if (!isContentSafetyConfigured()) throw new Error('Azure Content Safety is not configured.');
  const res = await fetch(`${AZURE_CONTENT_SAFETY_ENDPOINT}/contentsafety/${path}?api-version=${API_VERSION}`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_CONTENT_SAFETY_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // Never echo the request (it carries the key header); status is enough.
    throw new Error(`Content Safety ${path} failed with HTTP ${res.status}.`);
  }
  const data = (await res.json()) as { categoriesAnalysis?: { category: string; severity?: number }[] };
  let maxSeverity = 0;
  let category: string | null = null;
  for (const c of data.categoriesAnalysis ?? []) {
    if ((c.severity ?? 0) > maxSeverity) {
      maxSeverity = c.severity ?? 0;
      category = c.category;
    }
  }
  return { maxSeverity, category };
}

export function analyzeText(text: string): Promise<SafetyVerdict> {
  return post('text:analyze', { text: text.slice(0, 1000), outputType: 'FourSeverityLevels' });
}

// The image API caps input at 4 MB / 2048px per side; a downscaled JPEG is
// plenty for classification and keeps the request small.
export async function analyzeImage(png: Buffer): Promise<SafetyVerdict> {
  const small = await sharp(png).resize({ width: 1024, height: 1024, fit: 'inside' }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
  return post('image:analyze', { image: { content: small.toString('base64') }, outputType: 'FourSeverityLevels' });
}
