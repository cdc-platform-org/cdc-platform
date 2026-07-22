import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { useAuth } from '../../src/context/AuthContext';
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
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-gray-100 text-gray-500 border-gray-200',
};

function UserManagement() {
  const { user: viewer } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminUser['status'] | ''>('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Only ADMIN/SUPER_ADMIN can approve/reject/badge — mirrors the backend's
  // requireAdminRole('SUPER_ADMIN','ADMIN') on those specific routes.
  const canManageContent = viewer?.adminRole === 'SUPER_ADMIN' || viewer?.adminRole === 'ADMIN';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUsers(statusFilter || undefined);
      setUsers(data);
    } catch {
      setError('Unable to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const runAction = async (userId: string, action: () => Promise<AdminUser>) => {
    setActioningId(userId);
    setError(null);
    try {
      const updated = await action();
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Action failed. Please try again.');
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
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Search users, assign CDC Graduate badges, and ban/unban accounts.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AdminUser['status'] | '')}
            className="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-gray-500">No users match your search.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Badges</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((u) => {
                    const isActioning = actioningId === u.id;
                    return (
                      <tr key={u.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{u.name}</div>
                          <div className="text-xs text-gray-400">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.role}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[u.status]}`}
                          >
                            {u.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.isVerifiedGraduate && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-50 to-blue-50 border border-amber-300 text-blue-900">
                                🎓 Graduate
                              </span>
                            )}
                            {u.isBanned && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                                🚫 Banned
                              </span>
                            )}
                            {u.adminRole && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
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
                                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  disabled={isActioning}
                                  onClick={() => runAction(u.id, () => rejectUser(u.id))}
                                  className="text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg disabled:opacity-50"
                                >
                                  Reject
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
                                className="text-xs font-medium text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
                              >
                                {u.isVerifiedGraduate ? 'Remove Badge' : '🎓 Assign Badge'}
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
                                    ? 'text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                                    : 'text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100'
                                }`}
                              >
                                {u.isBanned ? 'Unban' : 'Ban'}
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
