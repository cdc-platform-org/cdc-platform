import { AzureOpenAI } from "openai";
import { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT_NAME } from "./env";

// AUDIT NOTE (fixed): this used AZURE_OPENAI_DEPLOYMENT (no such env var is
// set anywhere — utils/env.ts's canonical name is AZURE_OPENAI_DEPLOYMENT_NAME,
// same as services/azureOpenAiService.ts uses), so this client silently fell
// through to the hardcoded "gpt-4o" default deployment regardless of which
// deployment is actually configured in Azure — now reads the same
// env.ts-validated constants every other Azure OpenAI call site uses.
// Same timeout/maxRetries reasoning as azureOpenAiService.ts's getClient()
// — bounded so a stuck request fails fast under load, and the SDK's own
// retry is disabled since every caller already retries at the application
// layer (up to 3 attempts with backoff).
//
// SECOND AUDIT NOTE (fixed): this used to construct `new AzureOpenAI(...)`
// eagerly at module-load time as a top-level `export const`. The SDK
// throws immediately ("Missing credentials. Please pass one of `apiKey`
// and `azureADTokenProvider`...") if apiKey is empty — confirmed directly
// against the installed SDK — and AZURE_OPENAI_API_KEY defaults to '' when
// unset (env.ts: `(process.env.AZURE_OPENAI_API_KEY || '').trim()`).
// qa-nightly.yml's unit-tests job never sets any AZURE_OPENAI_* env var, so
// merely IMPORTING this module — even transitively, via aiAgentService.ts,
// by a test file that never actually calls an Azure function
// (aiTranslationAgent/aiExamService/examProctoringService/creatorMarketing/
// skillTests all reached it this way) — crashed the whole suite before a
// single test ran. Converted to the same lazy-singleton pattern
// azureOpenAiService.ts's getClient() already uses correctly for its own,
// separate client: construction is deferred to the first real call, by
// which point a caller has typically already checked
// isAzureOpenAiConfigured() — and even when one hasn't, that's a real
// runtime failure on an actual API call, not a crash on merely importing
// the module.
let client: AzureOpenAI | null = null;

export function getAzureOpenaiClient(): AzureOpenAI {
  if (!client) {
    client = new AzureOpenAI({
      endpoint: AZURE_OPENAI_ENDPOINT,
      apiKey: AZURE_OPENAI_API_KEY,
      apiVersion: AZURE_OPENAI_API_VERSION,
      deployment: AZURE_OPENAI_DEPLOYMENT_NAME,
      timeout: 60_000,
      maxRetries: 0,
    });
  }
  return client;
}
