import { AzureOpenAI } from "openai";

export const azureOpenai = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
  apiKey: process.env.AZURE_OPENAI_API_KEY || "",
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
  maxTokens: 4096, // Ensure token bounds
  response_format: { type: "json_object" }, // Enforce strict JSON response
  timeout: 30000, // Set timeout for requests
});
