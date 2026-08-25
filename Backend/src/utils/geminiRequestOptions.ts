// Shared request-level timeout for every GoogleGenerativeAI call site in the
// backend. Without an explicit `requestOptions.timeout` (or `.signal`), the
// SDK never starts an AbortController/timer at all — it just awaits Node's
// native fetch with no bound — so if Google's endpoint accepts the TCP
// connection but never responds (a real observed failure mode, distinct
// from a 429/503 the existing retry loops already handle), the request
// hangs forever and ties up the Express connection indefinitely.
//
// 60s comfortably covers the largest JSON payloads generated here (a full
// multi-question exam) while still bounding a genuine hang. Pass this as
// the second argument to every `client.getGenerativeModel(modelParams, ...)`
// call — see the GoogleGenerativeAI SDK's GenerativeModel constructor,
// which stores it as the default RequestOptions for every call made on that
// model instance.
export const GEMINI_REQUEST_TIMEOUT_MS = 60_000;
export const GEMINI_REQUEST_OPTIONS = { timeout: GEMINI_REQUEST_TIMEOUT_MS };
