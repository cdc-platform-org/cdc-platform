import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Send } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getAdminUsers } from '../../src/services/adminService';
import { sendNotification } from '../../src/services/notificationService';
import { AdminUser } from '../../src/types/admin';

type Target = 'ALL' | 'Student' | 'Client' | 'USER';

export default function AdminNotificationsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [target, setTarget] = useState<Target>('ALL');
  const [targetUserId, setTargetUserId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers().then(setUsers).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (target === 'USER' && !targetUserId) {
      setError('აირჩიეთ მიმღები მომხმარებელი.');
      return;
    }
    setSending(true);
    try {
      const { sentCount } = await sendNotification({
        title,
        message,
        ...(target === 'USER' ? { targetUserId } : { targetRole: target }),
      });
      setResult(`გაიგზავნა ${sentCount} მომხმარებელთან.`);
      setTitle('');
      setMessage('');
      setTargetUserId('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'შეტყობინების გაგზავნა ვერ მოხერხდა.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout>
        <Head>
          <title>შეტყობინებების გაგზავნა | CDC Admin</title>
        </Head>
        <div className="max-w-xl">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">შეტყობინების გაგზავნა</h1>
          <p className="text-sm text-gray-500 mb-6">
            ცალმხრივი შეტყობინება — მომხმარებელი ხედავს მას თავის ზარებში (🔔), პასუხის გაცემის საშუალების გარეშე.
          </p>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
            {result && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{result}</div>}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">მიმღები</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as Target)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="ALL">ყველა მომხმარებელი</option>
                <option value="Student">სტუდენტები / ფრილანსერები</option>
                <option value="Client">დამსაქმებლები</option>
                <option value="USER">კონკრეტული მომხმარებელი</option>
              </select>
            </div>

            {target === 'USER' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">მომხმარებელი</label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— აირჩიეთ —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">სათაური</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="მაგ: შეხსენება საბუთების შესახებ"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">შეტყობინება</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="მაგ: ხვალ საბუთები შემოიტანე"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              {sending ? 'იგზავნება…' : 'გაგზავნა'}
            </button>
          </form>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
