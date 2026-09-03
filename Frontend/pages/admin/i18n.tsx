import { useState } from 'react';
import apiClient from '../../src/services/apiClient';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';

// Mirrors Backend's aiTranslationAgent.ts I18nAgentRunResult — duplicated as
// a plain type rather than shared, same posture as this codebase's other
// frontend/backend type mirrors.
interface I18nAgentRunResult {
  configured: boolean;
  patchedGroups: { locale: string; namespace: string; keysPatched: number }[];
  skippedNonStringKeys: { locale: string; namespace: string; key: string }[];
  totalKeysPatched: number;
  validationPassed: boolean | null;
  gitBranch: string | null;
  message: string;
}

function I18nDashboard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<I18nAgentRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await apiClient.post<{ data: I18nAgentRunResult }>('/admin/auto-translate-and-push');
      setResult(data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'The translation agent run failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-xl font-black mb-2">Translation Status</h1>
      <p className="text-sm text-gray-500 mb-6">
        Scans every locale file for missing or empty keys against English, drafts translations via Gemini, and commits
        the patch to a new local git branch — never pushed, never touches main.
      </p>

      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="rounded-lg bg-indigo-600 text-white font-bold text-sm px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? 'Running…' : 'Run auto-translate agent'}
      </button>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      {result && (
        <div className="mt-6 rounded-xl border border-gray-200 p-4 text-sm">
          <p className="font-bold mb-3">{result.message}</p>

          {result.patchedGroups.length > 0 && (
            <ul className="space-y-1 mb-3">
              {result.patchedGroups.map((g) => (
                <li key={`${g.locale}-${g.namespace}`}>
                  {g.locale}/{g.namespace}: {g.keysPatched} key(s) patched
                </li>
              ))}
            </ul>
          )}

          {result.skippedNonStringKeys.length > 0 && (
            <p className="text-amber-600">
              {result.skippedNonStringKeys.length} non-string key(s) skipped (array-shaped values aren't auto-translated).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminI18nPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN']}>
      <AdminLayout>
        <I18nDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
