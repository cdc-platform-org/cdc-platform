import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getAnalyticsOverview, AnalyticsOverview } from '../../src/services/adminAnalyticsService';

function formatGel(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ₾`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none rounded-xl p-5 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10">
      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function MonthlySalesChart({ data }: { data: AnalyticsOverview['monthlySales'] }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none rounded-xl p-5">
      <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4">Monthly Revenue (last 12 months)</h3>
      <div className="flex items-end gap-2 h-40">
        {data.map((d) => (
          <div key={d.month} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${formatGel(d.revenue)} (${d.count} sales)`}>
            <div
              className="w-full bg-gradient-to-t from-cyan-500 to-purple-500 rounded-t"
              style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}
            />
            <span className="text-[9px] text-gray-400 dark:text-slate-500 rotate-0">{d.month.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalyticsOverview()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head>
        <title>Analytics | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Sales & Business Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Course revenue and enrollment overview.</p>
        </div>

        {loading || !data ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <StatCard label="Total Revenue" value={formatGel(data.totalRevenue)} />
              <StatCard label="Total Sales" value={String(data.totalSalesCount)} />
              <StatCard label="Active Enrolled Students" value={String(data.activeEnrolledStudents)} />
            </div>

            <MonthlySalesChart data={data.monthlySales} />

            <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none rounded-xl overflow-x-auto">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white px-5 pt-5">Top Performing Courses</h3>
              <table className="w-full text-sm mt-3">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-800">
                    <th className="px-5 py-3">Course</th>
                    <th className="px-5 py-3">Sales</th>
                    <th className="px-5 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCourses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-6 text-center text-gray-400 dark:text-slate-500">No sales yet.</td>
                    </tr>
                  ) : (
                    data.topCourses.map((c) => (
                      <tr key={c.courseId} className="border-b border-gray-100 dark:border-slate-800 last:border-0 text-gray-900 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3">{c.courseTitle}</td>
                        <td className="px-5 py-3">{c.salesCount}</td>
                        <td className="px-5 py-3 font-semibold">{formatGel(c.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminAnalyticsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
