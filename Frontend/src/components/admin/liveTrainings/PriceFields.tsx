/**
 * Live training form: price (empty = free) and price type (monthly / total).
 */
import { LiveTrainingPayload } from '../../../services/adminLiveTrainingService';
import type { Dispatch, SetStateAction } from 'react';

interface PriceFieldsProps {
  form: Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; };
  setForm: Dispatch<SetStateAction<Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; }>>;
  inputClass: "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
}

export default function PriceFields({ form, setForm, inputClass }: PriceFieldsProps) {
  return (
    <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ფასი (ლარი ₾) <span className="text-gray-400 font-normal">(ცარიელი = უფასო)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price != null ? form.price / 100 : ''}
                  onChange={(e) => setForm({ ...form, price: e.target.value ? Math.round(Number(e.target.value) * 100) : null })}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1">შეიყვანეთ თანხა ლარებში (მაგ. 300 ₾)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ფასის ტიპი</label>
                <select
                  value={form.priceType ?? 'MONTHLY'}
                  onChange={(e) => setForm({ ...form, priceType: e.target.value as 'MONTHLY' | 'TOTAL' })}
                  className={inputClass}
                >
                  <option value="MONTHLY">თვეში (განმეორებადი)</option>
                  <option value="TOTAL">ჯამში (მთლიანი კურსი)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ხანგრძლივობა (თვე) <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.durationMonths ?? ''}
                  onChange={(e) => setForm({ ...form, durationMonths: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                  placeholder="მაგ. 2"
                />
              </div>
            </div>
    </>
  );
}
