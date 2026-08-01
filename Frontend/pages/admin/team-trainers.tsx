import { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import Head from 'next/head';
import { ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { TeamMember, TeamMemberType } from '../../src/types/teamMember';
import { onImageErrorFallback } from '../../src/utils/imageFallback';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../src/utils/imageUpload';
import {
  adminGetTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  uploadTeamMemberPhoto,
  TeamMemberPayload,
} from '../../src/services/teamMemberService';

const emptyForm: TeamMemberPayload = {
  name: '',
  role: '',
  bio: '',
  imageUrl: '',
  type: 'MANAGEMENT',
  active: true,
};

const TYPE_LABEL: Record<TeamMemberType, string> = {
  MANAGEMENT: 'გუნდის წევრი',
  TRAINER: 'ტრენერი',
};

function AdminTeamTrainersDashboard() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TeamMemberPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await adminGetTeamMembers());
    } catch {
      setError('გუნდის წევრების ჩატვირთვა ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setForm({
      name: member.name,
      role: member.role,
      bio: member.bio ?? '',
      imageUrl: member.imageUrl ?? '',
      type: member.type,
      active: member.active,
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImageTooLarge(file)) {
      setFormError(IMAGE_SIZE_ERROR.ka);
      return;
    }
    setUploading(true);
    setFormError(null);
    try {
      const url = await uploadTeamMemberPhoto(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'ფოტოს ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.name.trim().length < 2) return setFormError('სახელი ძალიან მოკლეა.');
    if (form.role.trim().length < 2) return setFormError('პოზიცია სავალდებულოა.');

    setSubmitting(true);
    try {
      const payload: TeamMemberPayload = {
        name: form.name.trim(),
        role: form.role.trim(),
        bio: form.bio?.trim() || null,
        imageUrl: form.imageUrl?.trim() || null,
        type: form.type,
        active: form.active,
      };
      if (editingId) {
        const updated = await updateTeamMember(editingId, payload);
        setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await createTeamMember({ ...payload, order: members.length });
        setMembers((prev) => [...prev, created]);
      }
      resetForm();
    } catch {
      setFormError('შენახვა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    try {
      const updated = await updateTeamMember(member.id, { active: !member.active });
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch {
      setError('სტატუსის შეცვლა ვერ მოხერხდა.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('ნამდვილად გსურთ წევრის წაშლა?')) return;
    try {
      await deleteTeamMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setError('წაშლა ვერ მოხერხდა.');
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= members.length) return;
    const current = members[index];
    const target = members[targetIndex];
    const reordered = [...members];
    reordered[index] = target;
    reordered[targetIndex] = current;
    setMembers(reordered);
    try {
      const [updatedCurrent, updatedTarget] = await Promise.all([
        updateTeamMember(current.id, { order: targetIndex }),
        updateTeamMember(target.id, { order: index }),
      ]);
      setMembers((prev) => prev.map((m) => (m.id === updatedCurrent.id ? updatedCurrent : m.id === updatedTarget.id ? updatedTarget : m)));
    } catch {
      setError('თანმიმდევრობის შეცვლა ვერ მოხერხდა.');
      loadMembers();
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <>
      <Head>
        <title>გუნდი და ტრენერები | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">გუნდი და ტრენერები</h1>
          <p className="text-sm text-gray-500 mt-1">მართეთ გუნდის წევრები და ტრენერები, რომლებიც ჩანან მთავარ გვერდსა და /trainers გვერდზე.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 mb-10">
          <h2 className="text-base font-semibold text-gray-900 mb-6">
            {editingId ? 'წევრის რედაქტირება' : 'ახალი წევრი'}
          </h2>

          {formError && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ფოტო</label>
              <div className="flex items-center gap-4">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="გადახედვა" onError={onImageErrorFallback} className="w-16 h-16 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200" />
                )}
                <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                  {uploading ? 'იტვირთება…' : '📁 ატვირთვა'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">სახელი გვარი</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  placeholder="ია თავდიშვილი"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">პოზიცია</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={inputClass}
                  placeholder="დირექტორი"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ტიპი</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TeamMemberType })}
                className={inputClass}
              >
                <option value="MANAGEMENT">{TYPE_LABEL.MANAGEMENT}</option>
                <option value="TRAINER">{TYPE_LABEL.TRAINER}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">აღწერა / ბიოგრაფია</label>
              <textarea
                rows={4}
                value={form.bio ?? ''}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className={inputClass}
                placeholder="მოკლე აღწერა როლისა და გამოცდილების შესახებ..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              გამოჩნდეს საიტზე
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? 'ინახება…' : editingId ? 'განახლება' : 'დამატება'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  გაუქმება
                </button>
              )}
            </div>
          </form>
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">წევრები ({members.length})</h2>
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500">წევრები ჯერ არ არის დამატებული.</p>
          ) : (
            <div className="space-y-3">
              {members.map((member, index) => (
                <div key={member.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  {member.imageUrl ? (
                    <img src={member.imageUrl} alt="" onError={onImageErrorFallback} className="w-14 h-14 rounded-full object-cover shrink-0 border border-gray-200" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">{member.name}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {TYPE_LABEL[member.type]}
                      </span>
                      {!member.active && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          დამალული
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{member.role}</p>
                    {member.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{member.bio}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      title="ზემოთ"
                      aria-label="ზემოთ გადატანა"
                      className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === members.length - 1}
                      title="ქვემოთ"
                      aria-label="ქვემოთ გადატანა"
                      className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(member)}
                      title={member.active ? 'დამალვა' : 'გამოჩენა'}
                      aria-label={member.active ? 'დამალვა' : 'გამოჩენა'}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >
                      {member.active ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(member)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                    >
                      რედაქტირება
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(member.id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
                    >
                      წაშლა
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminTeamTrainersPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminTeamTrainersDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
