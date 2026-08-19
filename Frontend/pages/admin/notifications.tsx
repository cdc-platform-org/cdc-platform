import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Head from 'next/head';
import { Send, Search, X, Trash2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getAdminUsers } from '../../src/services/adminService';
import {
  sendNotification,
  getNotificationBatches,
  deleteNotificationBatch,
  resendNotificationBatch,
  NotificationBatchRow,
} from '../../src/services/notificationService';
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

  const [batches, setBatches] = useState<NotificationBatchRow[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      setBatches(await getNotificationBatches());
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    getAdminUsers().then(setUsers).catch(() => {});
    loadBatches();
  }, [loadBatches]);

  const handleDeleteBatch = async (id: string) => {
    if (!window.confirm('ნამდვილად გსურთ ამ შეტყობინების წაშლა? ის ყველა მიმღების ზარებიდანაც წაიშლება.')) return;
    setBusyId(id);
    try {
      await deleteNotificationBatch(id);
      setBatches((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setError('შეტყობინების წაშლა ვერ მოხერხდა.');
    } finally {
      setBusyId(null);
    }
  };

  const handleResendBatch = async (id: string) => {
    setBusyId(id);
    try {
      const { sentCount } = await resendNotificationBatch(id);
      setResult(`ხელახლა გაიგზავნა ${sentCount} მომხმარებელთან.`);
      loadBatches();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'ხელახლა გაგზავნა ვერ მოხერხდა.');
    } finally {
      setBusyId(null);
    }
  };

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
      loadBatches();
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
        <div className="max-w-4xl">
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

          {/* Sent Notifications history — only batches sent from the form
              above (POST /admin/notifications) ever appear here; automated
              notifications (product moderation, KYC, etc.) have no batch. */}
          <div className="mt-10">
            <h2 className="text-base font-semibold text-gray-900 mb-1">გაგზავნილი შეტყობინებები</h2>
            <p className="text-sm text-gray-500 mb-4">ბოლო 100 გაგზავნილი შეტყობინება.</p>

            {batchesLoading ? (
              <p className="text-sm text-gray-400">იტვირთება…</p>
            ) : batches.length === 0 ? (
              <p className="text-sm text-gray-500">ჯერ არაფერი გაგზავნილა.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-3 font-medium">მიმღები</th>
                        <th className="px-4 py-3 font-medium">სათაური</th>
                        <th className="px-4 py-3 font-medium">გაგზავნის დრო</th>
                        <th className="px-4 py-3 font-medium">წაკითხვა</th>
                        <th className="px-4 py-3 font-medium text-right">მოქმედება</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {batches.map((b) => {
                        const isExpanded = expandedId === b.id;
                        const isBusy = busyId === b.id;
                        return (
                            <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-700">{b.targetLabel}</td>
                              <td className="px-4 py-3 min-w-[220px]">
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                                  className="flex items-center gap-1 text-left bg-transparent border-none cursor-pointer p-0"
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                                  <span>
                                    <span className="font-medium text-gray-900 block">{b.title}</span>
                                    {!isExpanded && <span className="text-xs text-gray-400 line-clamp-1">{b.message}</span>}
                                  </span>
                                </button>
                                {isExpanded && <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-line">{b.message}</p>}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(b.createdAt).toLocaleString()}</td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                {b.recipientCount === 1 ? (
                                  b.singleRecipientRead ? (
                                    <span className="text-emerald-600 font-medium">
                                      წაკითხულია{b.singleRecipientReadAt ? ` — ${new Date(b.singleRecipientReadAt).toLocaleString()}` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">წაუკითხავია</span>
                                  )
                                ) : (
                                  <span className={b.readCount === b.recipientCount ? 'text-emerald-600 font-medium' : 'text-gray-600'}>
                                    {b.readCount} / {b.recipientCount} გახსნილია
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleResendBatch(b.id)}
                                    title="ხელახლა გაგზავნა"
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 bg-transparent border-none cursor-pointer disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleDeleteBatch(b.id)}
                                    title="წაშლა"
                                    className="p-1.5 text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer disabled:opacity-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
