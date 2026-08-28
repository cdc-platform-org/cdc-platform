import { z } from 'zod';
import { callTextModel, AiAgentError } from './aiAgentService';

// Powers POST /api/ai/digital-store-marketing — a quick-assist marketing
// copy generator for the digital-products dashboard tab. Deliberately
// separate from marketingAgentService.ts's LaunchKit (a heavier, unmetered
// creator tool for full campaign kits — social posts per platform, audience
// profile, sales email): this is a lighter single-call generator meant to
// live inside the product create/edit form itself, and is metered (see
// routes/ai.ts's daily-quota check) because it's a convenience aid, not the
// creator's primary marketing tool.
export class ProductMarketingError extends Error {
  status: number;
  constructor(message: string, status: number = 502) {
    super(message);
    this.name = 'ProductMarketingError';
    this.status = status;
  }
}

const marketingCopySchema = z.object({
  title: z.string(),
  description: z.string(),
  socialCopy: z.string(),
  tags: z.array(z.string()).max(8),
});

export type ProductMarketingCopy = z.infer<typeof marketingCopySchema>;

export interface GenerateProductMarketingCopyParams {
  title: string;
  description: string;
  // Optional — a mid-draft listing may not have a category selected yet.
  // Falls back to a generic "digital product" framing rather than
  // rejecting the request; the caller (routes/ai.ts) already made this
  // field optional for exactly that reason.
  category?: string;
  lang: 'ka' | 'en';
}

const FALLBACK_CATEGORY_LABEL: Record<'ka' | 'en', string> = {
  ka: 'ციფრული პროდუქტი (კატეგორია არჩეული არ არის)',
  en: 'Digital product (no category selected yet)',
};

export async function generateProductMarketingCopy(
  params: GenerateProductMarketingCopyParams
): Promise<ProductMarketingCopy> {
  const languageName = params.lang === 'ka' ? 'Georgian' : 'English';
  const category = params.category?.trim() || FALLBACK_CATEGORY_LABEL[params.lang];
  const prompt = `You are a marketing copywriter for CDC, an online SaaS/education platform's digital-products marketplace. A creator is listing a digital product for sale and wants AI-generated marketing copy to speed up their listing. Given the product's current title/description/category below, generate improved, compelling marketing copy in natural, fluent ${languageName}.

Respond with strict JSON matching this shape:
{"title": string, "description": string, "socialCopy": string, "tags": string[]}

- "title": a punchy, clear product title (under 70 characters), improving on the input title if it's weak — but stay truthful to what the product actually is, never invent features.
- "description": a compelling 2-4 sentence sales description highlighting the value/benefit to a buyer. Do not fabricate features not implied by the input.
- "socialCopy": a short, scroll-stopping social-media promo post (under 280 characters) a creator could paste directly to Instagram/Facebook/LinkedIn, including 1-2 relevant hashtags.
- "tags": 3-8 short lowercase keyword tags a buyer might search for, relevant to the product's category and content.

Product category: ${category}
Current title: ${params.title}
Current description: ${params.description}`;

  let raw: string;
  try {
    raw = await callTextModel(prompt, 0.6);
  } catch (err) {
    if (err instanceof AiAgentError) throw new ProductMarketingError(err.message, err.status);
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProductMarketingError('Gemini returned malformed JSON.');
  }

  const result = marketingCopySchema.safeParse(parsed);
  if (!result.success) {
    throw new ProductMarketingError('Gemini returned an unexpected marketing-copy format.');
  }
  return result.data;
}
