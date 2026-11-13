/**
 * Live training form: category, date & time and training language.
 */
import { CourseLanguage } from '../../../types/lms';
import { LiveTrainingPayload } from '../../../services/adminLiveTrainingService';
import type { Dispatch, SetStateAction } from 'react';

interface ScheduleFieldsProps {
  form: Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; };
  setForm: Dispatch<SetStateAction<Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; }>>;
  inputClass: "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
}

export default function ScheduleFields({ form, setForm, inputClass }: ScheduleFieldsProps) {
  return (
    <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">კატეგორია</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                  placeholder="მარკეტინგი, დიზაინი..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">თარიღი და დრო</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAtLocal}
                  onChange={(e) => setForm({ ...form, scheduledAtLocal: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ტრენინგის ენა</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value as CourseLanguage })}
                  className={inputClass}
                >
                  <option value="GEORGIAN">🇬🇪 ქართული</option>
                  <option value="ENGLISH">🇬🇧 ინგლისური</option>
                  <option value="BOTH">🇬🇪🇬🇧 ორივე</option>
                </select>
              </div>
            </div>
    </>
  );
}
