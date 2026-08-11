import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { Users as UsersIcon, Clock, GraduationCap, Ban } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { useAuth } from '../../src/context/AuthContext';
import { useAdminLang } from '../../src/context/AdminLangContext';
import { adminDict } from '../../src/data/adminDict';
import { AdminUser } from '../../src/types/admin';
import {
  getAdminUsers,
  approveUser,
  rejectUser,
  verifyGraduate,
  unverifyGraduate,
  banUser,
  unbanUser,
} from '../../src/services/adminService';

const STATUS_BADGE: Record<AdminUser['status'], string> = {
  PENDING_APPROVAL: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 shadow-amber-400/30 dark:shadow-amber-500/20',
  APPROVED: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 shadow-emerald-400/30 dark:shadow-emerald-500/20',
  REJECTED: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 shadow-transparent',
};

function StatCard({ label, value, icon: Icon, tint }: { label: string; value: number; icon: any; tint: string }) {
  return (
    <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none rounded-xl p-5 flex items-center gap-4 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tint}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-black text-gray-900 dark:text-white">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

const PAGE_DICT = {
  ka: {
    title: 'მომხმარებლების მართვა',
    subtitle: 'მოძებნეთ მომხმარებლები, მიანიჭეთ CDC კურსდამთავრებულის სტატუსი და დაბლოკეთ/გახსენით ანგარიშები.',
    totalUsers: 'სულ მომხმარებელი',
    bannedAccounts: 'დაბლოკილი ანგარიშები',
    tabAll: 'ყველა',
    tabStudents: 'სტუდენტები',
    tabClients: 'კლიენტები',
    tabAdmins: 'ადმინები',
    searchPlaceholder: 'ძებნა სახელით ან ელ. ფოსტით…',
    allStatuses: 'ყველა სტატუსი',
    statusPending: 'დასამტკიცებელი',
    statusApproved: 'დამტკიცებული',
    statusRejected: 'უარყოფილი',
    badges: 'ნიშნები',
    graduate: 'კურსდამთავრებული',
    banned: 'დაბლოკილი',
    removeBadge: 'ნიშნის მოხსნა',
    assignBadge: '🎓 ნიშნის მინიჭება',
    unban: 'განბლოკვა',
    ban: 'დაბლოკვა',
    noUsers: 'მომხმარებელი ვერ მოიძებნა.',
    loadError: 'მომხმარებლების ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.',
    actionError: 'მოქმედება ვერ შესრულდა. სცადეთ ხელახლა.',
  },
  en: {
    title: 'User Management',
    subtitle: 'Search users, assign CDC Graduate badges, and ban/unban accounts.',
    totalUsers: 'Total Users',
    bannedAccounts: 'Banned Accounts',
    tabAll: 'All',
    tabStudents: 'Students',
    tabClients: 'Clients',
    tabAdmins: 'Admins',
    searchPlaceholder: 'Search by name or email…',
    allStatuses: 'All statuses',
    statusPending: 'Pending Approval',
    statusApproved: 'Approved',
    statusRejected: 'Rejected',
    badges: 'Badges',
    graduate: 'Graduate',
    banned: 'Banned',
    removeBadge: 'Remove Badge',
    assignBadge: '🎓 Assign Badge',
    unban: 'Unban',
    ban: 'Ban',
    noUsers: 'No users match your search.',
    loadError: 'Unable to load users. Please try again.',
    actionError: 'Action failed. Please try again.',
  },
} as const;

function UserManagement() {
  const { user: viewer } = useAuth();
  const { lang } = useAdminLang();
  const t = adminDict[lang];
  const p = PAGE_DICT[lang];
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminUser['status'] | ''>('');
  const [roleTab, setRoleTab] = useState<'all' | 'Student' | 'Client' | 'Admin'>('all');
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Only ADMIN/SUPER_ADMIN can approve/reject/badge — mirrors the backend's
  // requireAdminRole('SUPER_ADMIN','MANAGER') on those specific routes.
  const canManageContent = viewer?.adminRole === 'SUPER_ADMIN' || viewer?.adminRole === 'MANAGER';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUsers(statusFilter || undefined);
      setUsers(data);
    } catch {
      setError(p.loadError);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, p.loadError]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const overviewStats = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((u) => u.status === 'PENDING_APPROVAL').length,
      graduates: users.filter((u) => u.isVerifiedGraduate).length,
      banned: users.filter((u) => u.isBanned).length,
    }),
    [users]
  );

  const tabCounts = useMemo(
    () => ({
      all: users.length,
      Student: users.filter((u) => u.role === 'Student').length,
      Client: users.filter((u) => u.role === 'Client').length,
      Admin: users.filter((u) => !!u.adminRole).length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    let result = users;
    if (roleTab === 'Student') result = result.filter((u) => u.role === 'Student');
    else if (roleTab === 'Client') result = result.filter((u) => u.role === 'Client');
    else if (roleTab === 'Admin') result = result.filter((u) => !!u.adminRole);

    const q = search.trim().toLowerCase();
    if (!q) return result;
    return result.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search, roleTab]);

  const runAction = async (userId: string, action: () => Promise<AdminUser>) => {
    setActioningId(userId);
    setError(null);
    try {
      const updated = await action();
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? p.actionError);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <>
      <Head>
        <title>User Management | Admin</title>
      </Head>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{p.title}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{p.subtitle}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label={p.totalUsers} value={overviewStats.total} icon={UsersIcon} tint="bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" />
          <StatCard label={p.statusPending} value={overviewStats.pending} icon={Clock} tint="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" />
          <StatCard label={p.graduate} value={overviewStats.graduates} icon={GraduationCap} tint="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" />
          <StatCard label={p.bannedAccounts} value={overviewStats.banned} icon={Ban} tint="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400" />
        </div>

        <div className="flex gap-1.5 mb-5 border-b border-gray-200 dark:border-slate-800">
          {([
            ['all', p.tabAll],
            ['Student', p.tabStudents],
            ['Client', p.tabClients],
            ['Admin', p.tabAdmins],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setRoleTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                roleTab === tab
                  ? 'border-cyan-500 text-cyan-700 dark:text-cyan-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {label} <span className="text-xs text-gray-400 dark:text-slate-500">({tabCounts[tab]})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={p.searchPlaceholder}
            className="flex-1 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white dark:placeholder-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AdminUser['status'] | '')}
            className="rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">{p.allStatuses}</option>
            <option value="PENDING_APPROVAL">{p.statusPending}</option>
            <option value="APPROVED">{p.statusApproved}</option>
            <option value="REJECTED">{p.statusRejected}</option>
          </select>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">{t.common.loading}</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">{p.noUsers}</p>
        ) : (
          <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-md shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60">
                    <th className="px-4 py-3 font-medium">{t.common.user}</th>
                    <th className="px-4 py-3 font-medium">{t.common.role}</th>
                    <th className="px-4 py-3 font-medium">{t.common.status}</th>
                    <th className="px-4 py-3 font-medium">{p.badges}</th>
                    <th className="px-4 py-3 font-medium text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                  {filteredUsers.map((u) => {
                    const isActioning = actioningId === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                          <div className="text-xs text-gray-400 dark:text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{u.role}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border shadow-[0_0_10px_-3px] ${STATUS_BADGE[u.status]}`}
                          >
                            {u.status === 'PENDING_APPROVAL' ? p.statusPending : u.status === 'APPROVED' ? p.statusApproved : p.statusRejected}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.isVerifiedGraduate && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-50 to-blue-50 dark:from-amber-500/10 dark:to-blue-500/10 border border-amber-300 dark:border-amber-500/30 text-blue-900 dark:text-amber-300">
                                🎓 {p.graduate}
                              </span>
                            )}
                            {u.isBanned && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400">
                                🚫 {p.banned}
                              </span>
                            )}
                            {u.adminRole && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                                {u.adminRole.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 justify-end">
                            {canManageContent && u.status === 'PENDING_APPROVAL' && (
                              <>
                                <button
                                  disabled={isActioning}
                                  onClick={() => runAction(u.id, () => approveUser(u.id))}
                                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg disabled:opacity-50"
                                >
                                  {t.common.approve}
                                </button>
                                <button
                                  disabled={isActioning}
                                  onClick={() => runAction(u.id, () => rejectUser(u.id))}
                                  className="text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 px-2.5 py-1 rounded-lg disabled:opacity-50"
                                >
                                  {t.common.reject}
                                </button>
                              </>
                            )}
                            {canManageContent && u.role === 'Student' && (
                              <button
                                disabled={isActioning}
                                onClick={() =>
                                  runAction(u.id, () =>
                                    u.isVerifiedGraduate ? unverifyGraduate(u.id) : verifyGraduate(u.id)
                                  )
                                }
                                className="text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg disabled:opacity-50"
                              >
                                {u.isVerifiedGraduate ? p.removeBadge : p.assignBadge}
                              </button>
                            )}
                            {u.id !== viewer?.id && (
                              <button
                                disabled={isActioning}
                                onClick={() =>
                                  runAction(u.id, () => (u.isBanned ? unbanUser(u.id) : banUser(u.id)))
                                }
                                className={`text-xs font-medium px-2.5 py-1 rounded-lg disabled:opacity-50 ${
                                  u.isBanned
                                    ? 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                                    : 'text-rose-700 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20'
                                }`}
                              >
                                {u.isBanned ? p.unban : p.ban}
                              </button>
                            )}
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
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <UserManagement />
      </AdminLayout>
    </AdminGuard>
  );
}
