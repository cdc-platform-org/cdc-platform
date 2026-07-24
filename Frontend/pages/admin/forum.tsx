import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import {
  getForumQueue,
  moderateForumThread,
  adminDeleteForumThread,
  getAdminForumCategories,
  createForumCategory,
  deleteForumCategory,
  PendingForumThread,
  AdminForumCategory,
} from '../../src/services/adminForumService';

function ModerationQueue() {
  const [queue, setQueue] = useState<PendingForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await getForumQueue());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleModerate = async (threadId: string, status: 'APPROVED' | 'REJECTED') => {
    const reason = status === 'REJECTED' ? window.prompt('Reason for rejection (optional):') ?? undefined : undefined;
    setBusyId(threadId);
    try {
      await moderateForumThread(threadId, status, reason);
      setQueue((prev) => prev.filter((t) => t.id !== threadId));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (threadId: string) => {
    if (!window.confirm('Permanently delete this thread?')) return;
    setBusyId(threadId);
    try {
      await adminDeleteForumThread(threadId);
      setQueue((prev) => prev.filter((t) => t.id !== threadId));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;
  if (queue.length === 0) return <p className="text-sm text-gray-500">No posts pending approval.</p>;

  return (
    <div className="space-y-4">
      {queue.map((thread) => (
        <div key={thread.id} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {thread.category.name}
            </span>
            <span className="text-xs text-gray-400">{new Date(thread.createdAt).toLocaleString()}</span>
          </div>
          <h3 className="font-semibold text-sm text-gray-900 mb-1">{thread.title}</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap mb-2">{thread.content}</p>
          <p className="text-xs text-gray-400 mb-4">by {thread.author.name} ({thread.author.role})</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busyId === thread.id}
              onClick={() => handleModerate(thread.id, 'APPROVED')}
              className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
            >
              ✓ Approve
            </button>
            <button
              type="button"
              disabled={busyId === thread.id}
              onClick={() => handleModerate(thread.id, 'REJECTED')}
              className="text-xs font-medium text-white bg-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-60"
            >
              ✕ Reject
            </button>
            <button
              type="button"
              disabled={busyId === thread.id}
              onClick={() => handleDelete(thread.id)}
              className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryManager() {
  const [categories, setCategories] = useState<AdminForumCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ slug: '', name: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await getAdminForumCategories());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createForumCategory(form);
      setForm({ slug: '', name: '', description: '' });
      load();
    } catch {
      setError('Unable to create category — check the slug is unique.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this category and all its threads?')) return;
    await deleteForumCategory(id);
    load();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-sm text-gray-900 mb-4">Categories</h3>
      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-2 mb-4">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
              <div>
                <span className="font-medium text-gray-800">{c.name}</span>
                <span className="text-gray-400 ml-2 text-xs">/{c.slug}</span>
              </div>
              <button type="button" onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          placeholder="slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="md:col-span-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          + Add category
        </button>
      </form>
    </div>
  );
}

function AdminForumDashboard() {
  return (
    <>
      <Head>
        <title>Forum Moderation | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Forum Moderation</h1>
          <p className="text-sm text-gray-500 mt-1">Approve or reject pending posts, and manage categories.</p>
        </div>
        <div className="mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Pending Approval</h2>
          <ModerationQueue />
        </div>
        <CategoryManager />
      </div>
    </>
  );
}

export default function AdminForumPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <AdminForumDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
