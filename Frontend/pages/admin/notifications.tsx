import { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import { Send, Search, X } from 'lucide-react';
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
  const [userQuery, setUserQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userDropdownOpen]);

  const selectedUser = users.find((u) => u.id === targetUserId) ?? null;

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 50);
  }, [users, userQuery]);

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
      setUserQuery('');
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
                onChange={(e) => {
                  setTarget(e.target.value as Target);
                  setTargetUserId('');
                  setUserQuery('');
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="ALL">ყველა მომხმარებელი</option>
                <option value="Student">სტუდენტები / ფრილანსერები</option>
                <option value="Client">დამსაქმებლები</option>
                <option value="USER">კონკრეტული მომხმარებელი</option>
              </select>
            </div>

            {target === 'USER' && (
              <div ref={userPickerRef} className="relative">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">მომხმარებელი</label>
                {selectedUser ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50">
                    <span className="truncate">
                      {selectedUser.name} <span className="text-gray-400">({selectedUser.email})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetUserId('');
                        setUserQuery('');
                        setUserDropdownOpen(true);
                      }}
                      aria-label="შეცვლა"
                      className="shrink-0 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={userQuery}
                      onChange={(e) => {
                        setUserQuery(e.target.value);
                        setUserDropdownOpen(true);
                      }}
                      onFocus={() => setUserDropdownOpen(true)}
                      placeholder="ძებნა სახელით ან ელ-ფოსტით…"
                      className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                )}

                {userDropdownOpen && !selectedUser && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filteredUsers.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">მომხმარებელი ვერ მოიძებნა.</p>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setTargetUserId(u.id);
                            setUserQuery('');
                            setUserDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm bg-transparent border-none cursor-pointer hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{u.name}</span>{' '}
                          <span className="text-gray-400">({u.email})</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
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
