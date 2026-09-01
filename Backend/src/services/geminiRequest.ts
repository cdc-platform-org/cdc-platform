const GEMINI_MODEL_NAME = 'gemini-2.5-flash';

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      console.warn(`Attempt ${attempt} failed: ${response.statusText}`);
    } catch (error) {
      console.warn(`Attempt ${attempt} failed: ${error}`);
    }
    if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retrying
  }
  throw new Error('All retry attempts failed.');
}
async function fetchGeminiData(endpoint: string, payload: object): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // Increased timeout to 30 seconds

  try {
    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request aborted due to timeout.');
      return { error: 'Request timed out. Please try again.' }; // Fallback response
    }
    console.error('Error fetching Gemini data:', error);
    return { error: 'An error occurred while processing your request.' }; // Fallback response
  } finally {
    clearTimeout(timeout);
  }
}
