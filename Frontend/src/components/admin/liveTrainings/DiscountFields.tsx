/**
 * Live training form: optional discount percent, end date and badge text.
 */
import { LiveTrainingPayload } from '../../../services/adminLiveTrainingService';
import type { Dispatch, SetStateAction } from 'react';

interface DiscountFieldsProps {
  form: Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; };
  setForm: Dispatch<SetStateAction<Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; }>>;
  inputClass: "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
}

export default function DiscountFields({ form, setForm, inputClass }: DiscountFieldsProps) {
  return (
    <>
            <div className="rounded-xl border border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isOnSale ?? false}
                  onChange={(e) => setForm({ ...form, isOnSale: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                🏷️ ფასდაკლება / სპეციალური შეთავაზება
              </label>

              {form.isOnSale && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">ფასდაკლება (%)</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        placeholder="მაგ. 20"
                        value={form.discountPercent ?? ''}
                        onChange={(e) => setForm({ ...form, discountPercent: e.target.value ? Number(e.target.value) : null })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        დასრულების თარიღი <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={form.discountEndDateLocal}
                        onChange={(e) => setForm({ ...form, discountEndDateLocal: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        ბეჯის ტექსტი <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
                      </label>
                      <input
                        value={form.discountBadgeText}
                        onChange={(e) => setForm({ ...form, discountBadgeText: e.target.value })}
                        maxLength={40}
                        placeholder={`-${form.discountPercent ?? 0}%`}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {form.price != null && form.discountPercent ? (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm">
                      <span className="text-gray-500 line-through mr-2">{(form.price / 100).toFixed(2)} ₾</span>
                      <span className="font-black text-rose-600">
                        {(Math.round(form.price * (1 - form.discountPercent / 100)) / 100).toFixed(2)} ₾
                      </span>
                      <span className="text-rose-500 font-bold ml-2">{form.discountBadgeText.trim() || `-${form.discountPercent}%`}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">ფასდაკლების ნახვისთვის მიუთითეთ ფასი და პროცენტი.</p>
                  )}
                </div>
              )}
            </div>
    </>
  );
}
