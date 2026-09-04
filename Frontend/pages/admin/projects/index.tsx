import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Sparkles, Trash2, Eye, EyeOff, MapPin, Calendar } from 'lucide-react';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { getAdminProjects, updateProject, deleteProject } from '../../../src/services/adminProjectsService';
import { Project } from '../../../src/types/project';

function AdminProjectsDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await getAdminProjects());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleStatus = async (project: Project) => {
    setBusyId(project.id);
    setError(null);
    try {
      await updateProject(project.id, { status: project.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'სტატუსის შეცვლა ვერ მოხერხდა.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('წავშალოთ ეს პროექტი?')) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteProject(id);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'წაშლა ვერ მოხერხდა.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Projects | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">პროექტები / წარსული ღონისძიებები</h1>
            <p className="text-sm text-gray-500 mt-1">საჯარო /projects გვერდზე გამოსაჩენი კონტენტი.</p>
          </div>
          <Link
            href="/admin/projects/ai-builder"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white no-underline hover:bg-indigo-700"
          >
            <Sparkles className="w-4 h-4" />
            AI-ით შექმნა
          </Link>
        </div>

        {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <p className="text-sm text-gray-400">იტვირთება…</p>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500 mb-4">ჯერ არცერთი პროექტი არ არის შექმნილი.</p>
            <Link
              href="/admin/projects/ai-builder"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white no-underline hover:bg-indigo-700"
            >
              <Sparkles className="w-4 h-4" />
              პირველი პროექტის შექმნა
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.coverImage} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-100" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{p.title}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        p.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {p.status === 'PUBLISHED' ? 'გამოქვეყნებული' : 'მონახაზი'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(p.date).toLocaleDateString()}
                    </span>
                    {p.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {p.location}
                      </span>
                    )}
                    <span>{p.galleryImages.length + 1} ფოტო</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => handleToggleStatus(p)}
                    title={p.status === 'PUBLISHED' ? 'დამალვა' : 'გამოქვეყნება'}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 bg-transparent border-none cursor-pointer disabled:opacity-60"
                  >
                    {p.status === 'PUBLISHED' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 bg-transparent border-none cursor-pointer disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminProjectsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminProjectsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
