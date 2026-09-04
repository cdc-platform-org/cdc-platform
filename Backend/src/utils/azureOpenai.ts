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
export const azureOpenai = new AzureOpenAI({
  endpoint: AZURE_OPENAI_ENDPOINT,
  apiKey: AZURE_OPENAI_API_KEY,
  apiVersion: AZURE_OPENAI_API_VERSION,
  deployment: AZURE_OPENAI_DEPLOYMENT_NAME,
  timeout: 60_000,
  maxRetries: 0,
});
