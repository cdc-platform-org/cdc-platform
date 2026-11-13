/**
 * Product agent — the two paid AI calls (gpt-image-2 image, Azure OpenAI
 * text) wrapped with cost accounting.
 * Exports: RunCost, generateArtwork, writeJson.
 *
 * Every call adds its measured cost to a RunCost, which the runner stores on
 * ProductAgentRun.estimatedCostUsd — the admin page's spend numbers and the
 * monthly budget stop both read from that.
 */
import { z } from 'zod';
import { generateImage, GenerateImageParams } from '../ai/azureImageService';
import { callAzureChatCompletionFull } from '../ai/azureChatCompletionService';

// USD per 1M tokens. gpt-image-2's public rate is $30/M image output tokens
// and $5/M text input (2026-11); Azure bills on the same token basis. The
// text rates are for the platform's general chat deployment. Overridable by
// env so a price change needs no deploy.
const IMAGE_OUTPUT_USD_PER_M = Number(process.env.PRODUCT_AGENT_IMAGE_OUT_USD_PER_M) || 30;
const IMAGE_INPUT_USD_PER_M = 5;
const TEXT_INPUT_USD_PER_M = Number(process.env.PRODUCT_AGENT_TEXT_IN_USD_PER_M) || 2.5;
const TEXT_OUTPUT_USD_PER_M = Number(process.env.PRODUCT_AGENT_TEXT_OUT_USD_PER_M) || 10;
// When Azure omits usage, assume a high-quality 2048x3072 image's typical
// token count (measured 2026-11-13: 12,736 output tokens).
const FALLBACK_IMAGE_OUTPUT_TOKENS = 13_000;

export class RunCost {
  usd = 0;
  images = 0;
  addImage(usage?: { inputTokens: number; outputTokens: number }): void {
    this.images += 1;
    const out = usage?.outputTokens ?? FALLBACK_IMAGE_OUTPUT_TOKENS;
    this.usd += (out * IMAGE_OUTPUT_USD_PER_M + (usage?.inputTokens ?? 100) * IMAGE_INPUT_USD_PER_M) / 1_000_000;
  }
  addText(usage?: { promptTokens: number; completionTokens: number }): void {
    if (!usage) {
      this.usd += 0.01;
      return;
    }
    this.usd += (usage.promptTokens * TEXT_INPUT_USD_PER_M + usage.completionTokens * TEXT_OUTPUT_USD_PER_M) / 1_000_000;
  }
}

// Wording added to every artwork prompt: the agent must never imitate a
// named artist, brand or character, and the generated picture must not
// carry text (Georgian letters in particular come out garbled — all text in
// products is typeset by our own PDF renderer instead).
const ART_GUARDRAILS =
  'Original artwork. Do not imitate any specific named artist, brand, logo, trademark or copyrighted character. ' +
  'No text, letters, numbers, signature or watermark anywhere in the image. No frame, no mat, no wall — only the flat artwork filling the whole canvas.';

export async function generateArtwork(
  cost: RunCost,
  params: { prompt: string; size: GenerateImageParams['size']; quality: 'high' | 'medium'; guardrails?: boolean }
): Promise<Buffer> {
  const prompt = params.guardrails === false ? params.prompt : `${params.prompt}\n\n${ART_GUARDRAILS}`;
  // One retry on a transient failure only; a content-filter or schema error
  // would fail the same way again and just cost money.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await generateImage({ prompt, size: params.size, quality: params.quality, outputFormat: 'png' });
    if (result.success) {
      cost.addImage(result.usage);
      return result.buffer;
    }
    const retryable = ['QUOTA_OR_RATE_LIMIT', 'AZURE_SERVICE', 'NETWORK_OR_TIMEOUT'].includes(result.errorClassification);
    if (!retryable || attempt === 2) {
      throw new Error(`Image generation failed (${result.errorClassification}): ${result.safeErrorMessage.slice(0, 300)}`);
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  throw new Error('unreachable');
}

// One JSON-mode chat call validated against a Zod schema; on a schema
// mismatch the model gets one chance to fix its own output.
export async function writeJson<T>(cost: RunCost, system: string, user: string, schema: z.ZodType<T>): Promise<T> {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await callAzureChatCompletionFull({ messages, jsonMode: true, temperature: 0.9, maxOutputTokens: 6000 });
    cost.addText(res.usage);
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.content);
    } catch {
      parsed = undefined;
    }
    const check = schema.safeParse(parsed);
    if (check.success) return check.data;
    if (attempt === 2) throw new Error(`AI returned invalid JSON: ${check.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    messages.push({ role: 'assistant', content: res.content });
    messages.push({
      role: 'user',
      content: `That JSON does not match the required shape: ${check.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}. Return the corrected full JSON only.`,
    });
  }
  throw new Error('unreachable');
}
