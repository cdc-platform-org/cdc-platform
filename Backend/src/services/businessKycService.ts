import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { GEMINI_API_KEY } from '../utils/env';

// ============================================================
// Business KYC document parsing — reads an uploaded Public Registry
// Extract / company registration document (PDF or image) with Gemini's
// multimodal API and extracts the identification code (ს/კ), so a match
// against the business's self-reported taxId can auto-verify the account
// instantly instead of always waiting on manual admin review.
//
// Deliberately conservative: any failure mode (not configured, request
// error, malformed response, low-confidence read) falls through to manual
// review rather than guessing — this only ever *speeds up* verification
// for a clean match, it never itself rejects or blocks an account.
// ============================================================

export function isBusinessKycParsingConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const parseResultSchema = z.object({
  hasOfficialHeaders: z.boolean(),
  identificationCode: z.string().nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
});

export interface BusinessDocumentParseResult {
  hasOfficialHeaders: boolean;
  identificationCode: string | null;
  confidence: 'low' | 'medium' | 'high';
}

export class BusinessKycParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessKycParseError';
  }
}

const SUPPORTED_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function parseBusinessDocument(buffer: Buffer, mimetype: string): Promise<BusinessDocumentParseResult> {
  if (!client) {
    throw new BusinessKycParseError('Gemini is not configured (GEMINI_API_KEY missing).');
  }
  if (!SUPPORTED_MIMETYPES.includes(mimetype)) {
    throw new BusinessKycParseError(`Unsupported document type for parsing: ${mimetype}`);
  }

  const prompt = `You are verifying a Georgian business registration document (a "Public Registry Extract" / ამონაწერი მეწარმეთა და არასამეწარმეო (არაკომერციული) იურიდიული პირების რეესტრიდან, issued by საჯარო რეესტრის ეროვნული სააგენტო).

Examine the attached document and determine:
1. Whether it visibly contains official Georgian Public Registry headers/letterhead (phrases like "საჯარო რეესტრის ეროვნული სააგენტო" or "ამონაწერი მეწარმეთა და არასამეწარმეო").
2. The company's identification code (ს/კ, "საიდენტიფიკაციო კოდი") printed on the document — a numeric code, typically 9 digits.
3. Your confidence in this reading, given scan quality and clarity.

If this does not look like a genuine Georgian Public Registry extract, or the identification code is illegible, set identificationCode to null and confidence to "low".

Respond with strict JSON only, matching this shape:
{"hasOfficialHeaders": boolean, "identificationCode": string | null, "confidence": "low" | "medium" | "high"}`;

  const model = client.getGenerativeModel({
    // Same model as aiExamService.ts — confirmed to have real free-tier
    // headroom on this account; the Pro family returns a hard 0 quota.
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });

  let raw: string;
  try {
    const result = await model.generateContent([
      { inlineData: { data: buffer.toString('base64'), mimeType: mimetype } },
      prompt,
    ]);
    raw = result.response.text();
  } catch (err) {
    throw new BusinessKycParseError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!raw) throw new BusinessKycParseError('Gemini returned an empty response.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BusinessKycParseError('Gemini returned malformed JSON.');
  }

  const result = parseResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new BusinessKycParseError('Gemini returned an unexpected response format.');
  }
  return result.data;
}

// Digits-only, order-insensitive-punctuation comparison — a taxId typed as
// "123456789" should still match a document read as "123-456-789" or with
// stray whitespace.
function normalizeTaxId(value: string): string {
  return value.replace(/\D/g, '');
}

export function taxIdsMatch(a: string, b: string): boolean {
  const na = normalizeTaxId(a);
  const nb = normalizeTaxId(b);
  return na.length > 0 && na === nb;
}
