import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Sparkles, Trash2, Eye } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import LaunchKitDrawer from '../../src/components/admin/LaunchKitDrawer';
import { getAllLaunchKits, deleteLaunchKit } from '../../src/services/marketingService';
import { LaunchKit } from '../../src/types/marketing';

function AdminMarketingDashboard() {
  const [kits, setKits] = useState<LaunchKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTarget, setOpenTarget] = useState<{ target: { productId: string } | { courseId: string }; title: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAllLaunchKits()
      .then(setKits)
      .catch(() => setError('Launch Kit-ების ჩატვირთვა ვერ მოხერხდა.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('წავშალო ეს Launch Kit?')) return;
    await deleteLaunchKit(id);
    load();
  };

  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <Head><title>AI მარკეტინგის მენეჯერი — CDC Admin</title></Head>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className="w-6 h-6 text-purple-500" /> AI გაყიდვების & მარკეტინგის მენეჯერი</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            ყველა გენერირებული Launch Kit — სოც. მედია პოსტები, B2B აუთრიჩი და აუდიტორიის პროფილი. ახალი კომპლექტის შესაქმნელად გამოიყენეთ „Generate Sales Launch Kit" ღილაკი პროდუქტის ან კურსის გვერდზე.
          </p>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">იტვირთება…</div>
          ) : kits.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">ჯერ არცერთი Launch Kit არ არის გენერირებული.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-left text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">სამიზნე</th>
                  <th className="px-4 py-3 font-semibold">ტიპი</th>
                  <th className="px-4 py-3 font-semibold">ენა</th>
                  <th className="px-4 py-3 font-semibold">გენერირებულია</th>
                  <th className="px-4 py-3 font-semibold">ავტორი</th>
                  <th className="px-4 py-3 font-semibold text-right">მოქმედებები</th>
                </tr>
              </thead>
              <tbody>
                {kits.map((k) => {
                  const targetTitle = k.product?.title ?? k.course?.title ?? '—';
                  const target = k.productId ? { productId: k.productId } : { courseId: k.courseId! };
                  return (
                    <tr key={k.id} className="border-t border-gray-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{targetTitle}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{k.targetType === 'DIGITAL_PRODUCT' ? 'ციფრული პროდუქტი' : 'კურსი'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 uppercase">{k.lang}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{new Date(k.createdAt).toLocaleString('ka-GE')}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{k.generatedByUser?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setOpenTarget({ target, title: targetTitle })}
                            className="text-cyan-600 hover:text-cyan-800 bg-transparent border-none cursor-pointer"
                            title="ნახვა"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(k.id)} className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer" title="წაშლა">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {openTarget && (
          <LaunchKitDrawer
            target={openTarget.target}
            title={openTarget.title}
            onClose={() => {
              setOpenTarget(null);
              load();
            }}
          />
        )}
      </AdminLayout>
    </AdminGuard>
  );
}

export default AdminMarketingDashboard;
