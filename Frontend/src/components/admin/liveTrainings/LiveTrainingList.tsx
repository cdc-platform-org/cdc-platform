/**
 * Admin list of live trainings with status badges and links to guides,
 * trainers and enrollments.
 */
import Link from 'next/link';
import { Users } from 'lucide-react';
import { LiveTraining } from '../../../types/liveTraining';

interface LiveTrainingListProps {
  trainings: LiveTraining[];
  error: string | null;
  loading: boolean;
  startEdit: (t: LiveTraining) => void;
  handleDelete: (id: string) => Promise<void>;
}

export default function LiveTrainingList({
  trainings,
  error,
  loading,
  startEdit,
  handleDelete,
}: LiveTrainingListProps) {
  return (
    <>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">ტრენინგები ({trainings.length})</h2>
          {error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : trainings.length === 0 ? (
            <p className="text-sm text-gray-500">ტრენინგები ჯერ არ არის დამატებული.</p>
          ) : (
            <div className="space-y-3">
              {trainings.map((t) => (
                <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{t.category}</span>
                        {!t.published && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded">დრაფტი</span>
                        )}
                        {t.isFull && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">სავსეა</span>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            t.minThresholdMet ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'
                          }`}
                        >
                          {t.minThresholdMet
                            ? 'მინ. ჯგუფი შევსებულია'
                            : `მინ. ${t.minCapacity}-კაციან ჯგუფს აკლია ${Math.max(0, t.minCapacity - t.registeredCount)} ადამიანი`}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 truncate mt-1">{t.title}</h3>
                      <p className="text-xs text-gray-500">
                        {new Date(t.scheduledAt).toLocaleString()} · {t.registeredCount} / {t.maxCapacity} რეგისტრირებული
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Link href={`/admin/live-trainings/${t.id}/guides`} className="text-xs font-medium text-cyan-700 px-3 py-1.5 rounded-lg hover:bg-cyan-50">IAKO · გზამკვლევები</Link>
                      <Link href={`/admin/live-trainings/${t.id}/trainers`} className="text-xs font-medium text-cyan-700 px-3 py-1.5 rounded-lg hover:bg-cyan-50">ტრენერები</Link>
                      <Link href={`/admin/live-trainings/${t.id}/enrollments`} className="text-xs font-medium text-cyan-700 px-3 py-1.5 rounded-lg hover:bg-cyan-50">ჩარიცხვები · QR</Link>
                      <Link
                        href={`/admin/live-trainings/${t.id}/leads`}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                      >
                        <Users size={13} /> ლიდები და რეგისტრირებულები ({t.registeredCount})
                      </Link>
                      <button type="button" onClick={() => startEdit(t)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
                        რედაქტირება
                      </button>
                      <button type="button" onClick={() => handleDelete(t.id)} className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50">
                        წაშლა
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </>
  );
}
