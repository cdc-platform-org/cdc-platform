import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getCyberSentinelWaitlist, CyberSentinelWaitlistEntry } from '../../src/services/cyberSentinelService';

const OS_LABEL: Record<string, string> = { WINDOWS: 'Windows', MAC: 'macOS', LINUX: 'Linux' };

function CyberSentinelWaitlistDashboard() {
  const [entries, setEntries] = useState<CyberSentinelWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getCyberSentinelWaitlist());
    } catch {
      setError('Failed to load the waitlist.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Head>
        <title>Cyber Sentinel Waitlist | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Cyber Sentinel AI — Early Access Waitlist</h1>
          <p className="text-sm text-gray-500 mt-1">
            Leads from the &quot;Get Early Access&quot; modal on /tools — {entries.length} signup{entries.length === 1 ? '' : 's'} so far.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">No signups yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">OS</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 border-gray-100">
                    <td className="px-4 py-2.5 text-gray-900">{e.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{e.email}</td>
                    <td className="px-4 py-2.5 text-gray-600">{OS_LABEL[e.os] ?? e.os}</td>
                    <td className="px-4 py-2.5 text-gray-500">{new Date(e.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminCyberSentinelPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <CyberSentinelWaitlistDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
