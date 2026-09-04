import { azureOpenai } from '../utils/azureOpenai';
import { z } from 'zod';
import { GEMINI_API_KEY, AZURE_OPENAI_DEPLOYMENT_NAME } from '../utils/env';
import { isAzureOpenAiConfigured } from './azureOpenAiService';

// ============================================================
// Business KYC document parsing — reads an uploaded business registration
// document (Georgian Public Registry Extract, or a foreign Certificate of
// Incorporation / equivalent) with Gemini's multimodal API and extracts a
// structured profile — company name, tax/identification code, registration
// date, registry authority, active/liquidation status, and directors — plus
// a 0-100 confidence score, so a high-confidence clean match can auto-verify
// the account instantly instead of always waiting on manual admin review.
//
// Deliberately conservative: any failure mode (not configured, request
// error, malformed response, low score, non-ACTIVE status, a taxId
// mismatch) falls through to manual review rather than guessing — this only
// ever *speeds up* verification for a clean match, it never itself rejects
// or blocks an account (only an admin's explicit reject does that).
// ============================================================

// AUDIT NOTE (fixed): previously checked GEMINI_API_KEY alone, but the
// actual call below always goes through Azure OpenAI — a server with only
// AZURE_OPENAI_* configured used to incorrectly report this feature as
// unavailable.
export function isBusinessKycParsingConfigured(): boolean {
  return !!GEMINI_API_KEY || isAzureOpenAiConfigured();
}

const directorSchema = z.object({
  name: z.string(),
  // Personal ID / national ID — frequently redacted or absent on foreign
  // certificates, so nullable rather than required.
  personalId: z.string().nullable(),
});

const parseResultSchema = z.object({
  hasOfficialHeaders: z.boolean(),
  companyName: z.string().nullable(),
  identificationCode: z.string().nullable(),
  // Free text, not a Date — source documents format this inconsistently
  // (Georgian extracts vs. foreign certificates), and this is only ever
  // displayed to an admin, never parsed/compared programmatically.
  registrationDate: z.string().nullable(),
  registryAuthority: z.string().nullable(),
  activeStatus: z.enum(['ACTIVE', 'LIQUIDATION', 'INSOLVENCY', 'RESTRAINED', 'UNKNOWN']),
  directors: z.array(directorSchema).default([]),
  confidenceScore: z.number().min(0).max(100),
  // Gemini's own explanation of what it saw and why — shown verbatim in the
  // admin inspection drawer (e.g. "document shows inactive status", "scan
  // quality too low to confirm the ID code", "no visible official
  // letterhead"). Never shown to the business itself; the user-facing
  // rejection message is written by the admin, or falls back to a generic
  // string (see routes/adminCompanies.ts).
  reasoning: z.string(),
});

export interface BusinessDocumentParseResult {
  hasOfficialHeaders: boolean;
  companyName: string | null;
  identificationCode: string | null;
  registrationDate: string | null;
  registryAuthority: string | null;
  activeStatus: 'ACTIVE' | 'LIQUIDATION' | 'INSOLVENCY' | 'RESTRAINED' | 'UNKNOWN';
  directors: { name: string; personalId: string | null }[];
  confidenceScore: number;
  reasoning: string;
}

export class BusinessKycParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessKycParseError';
  }
}

const SUPPORTED_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const AZURE_VISION_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function parseBusinessDocument(buffer: Buffer, mimetype: string): Promise<BusinessDocumentParseResult> {
  if (!isBusinessKycParsingConfigured()) {
    throw new BusinessKycParseError('KYC document parsing is not configured (GEMINI_API_KEY/AZURE_OPENAI_* missing).');
  }
  if (!SUPPORTED_MIMETYPES.includes(mimetype)) {
    throw new BusinessKycParseError(`Unsupported document type for parsing: ${mimetype}`);
  }
  // The Azure OpenAI chat.completions vision input only accepts image
  // bytes (image_url data URIs) — a PDF would need converting to page
  // images first (no such conversion exists in this codebase yet), so it
  // falls straight to manual admin review rather than silently analyzing
  // nothing, same conservative posture as every other failure mode here.
  if (!AZURE_VISION_MIMETYPES.includes(mimetype)) {
    throw new BusinessKycParseError(`Automatic PDF analysis is not supported yet — this document needs manual review.`);
  }

  const prompt = `You are verifying a business registration document for a KYC (Know Your Customer) check. This may be:
- A Georgian "Public Registry Extract" (ამონაწერი მეწარმეთა და არასამეწარმეო (არაკომერციული) იურიდიული პირების რეესტრიდან), issued by საჯარო რეესტრის ეროვნული სააგენტო (the National Agency of Public Registry), OR
- A foreign business registration document — a Certificate of Incorporation, Companies House extract, trade register excerpt, or equivalent official filing from any other country's business registry.

Examine the attached document carefully and extract:
1. hasOfficialHeaders: whether it visibly contains official registry letterhead/seals/header text (for Georgian documents, phrases like "საჯარო რეესტრის ეროვნული სააგენტო"; for foreign documents, the issuing registry's own official header).
2. companyName: the registered business name exactly as printed.
3. identificationCode: the company's tax/identification number (Georgian ს/კ "საიდენტიფიკაციო კოდი", typically 9 digits — or the equivalent company/tax registration number for a foreign document).
4. registrationDate: the date this business was registered, as printed (any format).
5. registryAuthority: the name of the issuing registry/authority.
6. activeStatus: one of "ACTIVE" (in good standing, no restrictions), "LIQUIDATION" (undergoing or completed liquidation), "INSOLVENCY" (bankruptcy/insolvency proceedings), "RESTRAINED" (an active ban, seizure, or legal restraint on the company), or "UNKNOWN" (the document does not state a status, or it's illegible).
7. directors: every legal representative / director / authorized person named, with their personal ID if printed (null if not printed or not applicable).
8. confidenceScore: your confidence (0-100) that this is a genuine, unaltered, legible business registration document and that the fields above were read correctly. Score low (below 50) if the document doesn't look like an official registry document at all, appears digitally altered, is too blurry/cropped to read key fields, or is missing an identification code entirely.
9. reasoning: 1-3 sentences explaining your reading — what you saw, and specifically call out anything suspicious, illegible, or that lowered your confidence (e.g. "no identification code visible", "status appears to be liquidation, not active", "document quality is too low to confirm authenticity").

Respond with strict JSON only, matching this shape:
{"hasOfficialHeaders": boolean, "companyName": string | null, "identificationCode": string | null, "registrationDate": string | null, "registryAuthority": string | null, "activeStatus": "ACTIVE" | "LIQUIDATION" | "INSOLVENCY" | "RESTRAINED" | "UNKNOWN", "directors": [{"name": string, "personalId": string | null}], "confidenceScore": number, "reasoning": string}`;

  // AUDIT NOTE (fixed): this used to send the literal string "Analyze KYC
  // data" as the entire message content — the real `prompt` above and the
  // document `buffer` itself were both built/received but never actually
  // sent to the model, so KYC analysis was silently a no-op returning
  // whatever the model hallucinated from three words of context. Now sends
  // the real prompt plus the document image, with JSON mode enforced and up
  // to 3 attempts on a retryable/malformed-JSON response.
  const imageDataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
  let raw = '';
  let lastErr: unknown;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await azureOpenai.chat.completions.create({
        model: AZURE_OPENAI_DEPLOYMENT_NAME,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ] as any,
          },
        ],
        response_format: { type: 'json_object' },
      });
      const content = response.choices[0]?.message?.content || '';
      if (!content) throw new BusinessKycParseError('AI provider returned an empty response.');
      raw = content.replace(/```json|```/g, '').trim();
      JSON.parse(raw); // throws SyntaxError on invalid JSON — caught below, retried
      break;
    } catch (err) {
      lastErr = err;
      raw = '';
      console.error(`[businessKycService] attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err instanceof Error ? err.message : err);
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  if (!raw) {
    throw lastErr instanceof BusinessKycParseError
      ? lastErr
      : new BusinessKycParseError(lastErr instanceof Error ? `AI request failed: ${lastErr.message}` : 'AI request failed.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BusinessKycParseError('AI provider returned malformed JSON.');
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

// Single source of truth for the auto-approve decision, used by routes/auth.ts's
// upload handler — kept here (not inlined in the route) so the threshold and
// its exact conditions live next to the parser that produces the values it
// reads, rather than drifting out of sync in a second file.
export const AUTO_APPROVE_SCORE_THRESHOLD = 85;

export function shouldAutoApprove(parsed: BusinessDocumentParseResult, selfReportedTaxId: string): boolean {
  return (
    parsed.hasOfficialHeaders &&
    parsed.confidenceScore >= AUTO_APPROVE_SCORE_THRESHOLD &&
    parsed.activeStatus === 'ACTIVE' &&
    !!parsed.identificationCode &&
    taxIdsMatch(parsed.identificationCode, selfReportedTaxId)
  );
}
