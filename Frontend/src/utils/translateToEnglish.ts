import apiClient from '../services/apiClient';

// Georgian -> English for admin forms. Reuses the existing admin-only
// POST /ai/translate-title-description endpoint (two strings per call,
// both required), so no backend change is needed: texts are sent in pairs
// in parallel and an odd one out is sent as its own pair.
async function translatePair(a: string, b: string): Promise<[string, string]> {
  const res = await apiClient.post<{ data: { titleEn: string; descriptionEn: string } }>('/ai/translate-title-description', {
    title: a,
    description: b,
  });
  return [res.data.data.titleEn, res.data.data.descriptionEn];
}

export async function translateKaToEn(texts: string[]): Promise<string[]> {
  const out: string[] = new Array(texts.length).fill('');
  const idx = texts.map((t, i) => (t && t.trim() ? i : -1)).filter((i) => i >= 0);
  const jobs: Promise<void>[] = [];
  for (let k = 0; k < idx.length; k += 2) {
    const i = idx[k];
    const j = idx[k + 1];
    jobs.push(
      translatePair(texts[i], j !== undefined ? texts[j] : texts[i]).then(([ai, bj]) => {
        out[i] = ai;
        if (j !== undefined) out[j] = bj;
      })
    );
  }
  await Promise.all(jobs);
  return out;
}
