import { useState, useEffect, useCallback, FormEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { useAuth } from '../../src/context/AuthContext';
import { AdminRole } from '../../src/types/auth';
import { TeamMember } from '../../src/types/adminPanel';
import { getTeam, addTeamMember, updateTeamMemberRole, removeTeamMember } from '../../src/services/adminPanelService';

const TIER_BADGE: Record<AdminRole, string> = {
  SUPER_ADMIN: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
  MANAGER: 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white',
  MODERATOR: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white',
};

const TIERS: AdminRole[] = ['SUPER_ADMIN', 'MANAGER', 'MODERATOR'];

function TeamManagement() {
  const { user: viewer } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('MODERATOR');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeam();
      setTeam(data);
    } catch {
      setError('Unable to load the admin team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      const member = await addTeamMember(email.trim().toLowerCase(), newRole);
      setTeam((prev) => [...prev, member]);
      setEmail('');
      setNewRole('MODERATOR');
    } catch (err: any) {
      setAddError(err?.response?.data?.message ?? 'Unable to add this team member.');
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (userId: string, adminRole: AdminRole) => {
    setActioningId(userId);
    setError(null);
    try {
      const updated = await updateTeamMemberRole(userId, adminRole);
      setTeam((prev) => prev.map((m) => (m.id === userId ? updated : m)));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to update this role.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!window.confirm('Remove this person from the admin team?')) return;
    setActioningId(userId);
    setError(null);
    try {
      await removeTeamMember(userId);
      setTeam((prev) => prev.filter((m) => m.id !== userId));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to remove this team member.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Team & Permissions | Admin</title>
      </Head>
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Team & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">Restricted to SuperAdmin.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8 max-w-xl">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Add Team Member</h2>
          <p className="text-xs text-gray-500 mb-4">
            The user must already have a platform account — this promotes an existing account to an admin tier.
          </p>
          {addError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {addError}
            </div>
          )}
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@cdc.ge"
              className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminRole)}
              className="rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier.replace('_', ' ')}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : team.length === 0 ? (
          <p className="text-sm text-gray-500">No admin team members yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {team.map((member) => {
                  const isSelf = member.id === viewer?.id;
                  const isActioning = actioningId === member.id;
                  return (
                    <tr key={member.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {member.name} {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                        </div>
                        <div className="text-xs text-gray-400">{member.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${TIER_BADGE[member.adminRole]}`}
                        >
                          {member.adminRole.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={member.adminRole}
                            disabled={isActioning || (isSelf && member.adminRole === 'SUPER_ADMIN')}
                            onChange={(e) => handleRoleChange(member.id, e.target.value as AdminRole)}
                            className="text-xs rounded-lg border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            {TIERS.map((tier) => (
                              <option key={tier} value={tier}>
                                {tier.replace('_', ' ')}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={isActioning || isSelf}
                            onClick={() => handleRemove(member.id)}
                            className="text-xs font-medium text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminTeamPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN']}>
      <AdminLayout>
        <TeamManagement />
      </AdminLayout>
    </AdminGuard>
  );
}
