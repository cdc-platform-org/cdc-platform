/**
 * Live training form: minimum group size and maximum seats.
 */
import { LiveTrainingPayload } from '../../../services/adminLiveTrainingService';
import type { Dispatch, SetStateAction } from 'react';

interface CapacityFieldsProps {
  form: Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; };
  setForm: Dispatch<SetStateAction<Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; }>>;
  inputClass: "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
}

export default function CapacityFields({ form, setForm, inputClass }: CapacityFieldsProps) {
  return (
    <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">მინ. ჯგუფი</label>
                <input
                  type="number"
                  min={0}
                  value={form.minCapacity ?? 0}
                  onChange={(e) => setForm({ ...form, minCapacity: Number(e.target.value) || 0 })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">მაქს. ადგილები</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxCapacity}
                  onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) || 1 })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ჩატარების გრაფიკი <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
                </label>
                <input
                  type="text"
                  value={form.scheduleDays ?? ''}
                  onChange={(e) => setForm({ ...form, scheduleDays: e.target.value })}
                  placeholder="მაგ. ორშ - ოთხ | 19:00"
                  className={inputClass}
                />
              </div>
            </div>
    </>
  );
}
