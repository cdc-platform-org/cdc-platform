/**
 * Live training form: IAKO assistant profile and access mode for participants.
 */
import Link from 'next/link';
import { IakoAssignmentMode, IakoKnowledgeSource, IakoProfile } from '../../../services/iakoAssistantService';
import type { Dispatch, SetStateAction } from 'react';

import { at } from '../../../i18n/admin';
interface IakoAssistantFieldsProps {
  iakoEnabled: boolean;
  setIakoEnabled: Dispatch<SetStateAction<boolean>>;
  iakoProfileId: string;
  setIakoProfileId: Dispatch<SetStateAction<string>>;
  inputClass: "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  iakoProfiles: IakoProfile[];
  iakoReusedElsewhere: boolean | undefined;
  setIakoMode: Dispatch<SetStateAction<IakoAssignmentMode>>;
  iakoMode: IakoAssignmentMode;
  iakoDetail: (IakoProfile & { sources: IakoKnowledgeSource[]; }) | null;
  iakoInitialLimit: string;
  setIakoInitialLimit: Dispatch<SetStateAction<string>>;
  iakoAutoTopUpEnabled: boolean;
  setIakoAutoTopUpEnabled: Dispatch<SetStateAction<boolean>>;
  iakoAutoTopUpAmount: string;
  setIakoAutoTopUpAmount: Dispatch<SetStateAction<string>>;
  iakoMaxAutoTopUps: string;
  setIakoMaxAutoTopUps: Dispatch<SetStateAction<string>>;
  iakoMaxAutoTotal: string;
  setIakoMaxAutoTotal: Dispatch<SetStateAction<string>>;
  iakoWarning: string | null;
}

export default function IakoAssistantFields({
  iakoEnabled,
  setIakoEnabled,
  iakoProfileId,
  setIakoProfileId,
  inputClass,
  iakoProfiles,
  iakoReusedElsewhere,
  setIakoMode,
  iakoMode,
  iakoDetail,
  iakoInitialLimit,
  setIakoInitialLimit,
  iakoAutoTopUpEnabled,
  setIakoAutoTopUpEnabled,
  iakoAutoTopUpAmount,
  setIakoAutoTopUpAmount,
  iakoMaxAutoTopUps,
  setIakoMaxAutoTopUps,
  iakoMaxAutoTotal,
  setIakoMaxAutoTotal,
  iakoWarning,
}: IakoAssistantFieldsProps) {
  return (
    <>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">IAKO ასისტენტი</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  დააკონფიგურირეთ AI მენტორი ამ ტრენინგისთვის. დატოვეთ Private / Testing რეჟიმში, სანამ არ იქნება მზად ჩარიცხულ მონაწილეებზე გასაშვებად.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={iakoEnabled}
                  onChange={(e) => setIakoEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                IAKO ჩართული
              </label>

              {iakoEnabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">IAKO პროფილი</label>
                      <select value={iakoProfileId} onChange={(e) => setIakoProfileId(e.target.value)} className={inputClass}>
                        <option value="">— აირჩიეთ პროფილი —</option>
                        {iakoProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {iakoReusedElsewhere && (
                        <p className="text-xs text-amber-700 mt-1.5">
                          ეს IAKO პროფილი გამოიყენება სხვა ტრენინგზეც/ტულზეც — მისი პერსონა და ცოდნის ბაზა საერთოა.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">წვდომის რეჟიმი</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIakoMode('TESTING')}
                          className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold ${iakoMode === 'TESTING' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                        >
                          {at("Private / Testing")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIakoMode('LIVE')}
                          className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold ${iakoMode === 'LIVE' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                        >
                          {at("Live")}
                        </button>
                      </div>
                      {iakoMode === 'TESTING' ? (
                        <p className="text-xs text-amber-700 mt-1.5">
                          <span className="font-semibold">{at("Private / Testing")}</span> — მხოლოდ ჩარიცხულმა ადმინისტრატორმა (SUPER_ADMIN/MANAGER) შეუძლია ამ IAKO-ს გამოყენება. ჩარიცხული მონაწილეები მას ვერც ხედავენ და ვერც წვდებიან.
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-700 mt-1.5">
                          <span className="font-semibold">{at("Live")}</span> — ავთენტიფიცირებულ მონაწილეებს აქტიური/დასრულებული ჩარიცხვით შეუძლიათ ამ IAKO-ს გამოყენება, მოქმედი ლიმიტების ფარგლებში.
                        </p>
                      )}
                    </div>
                  </div>

                  {iakoDetail && (
                    <div className="rounded-lg border border-gray-200 bg-white p-3.5 text-xs text-gray-600 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                      <div><span className="text-gray-400">პროფილი:</span> {iakoDetail.name}</div>
                      <div><span className="text-gray-400">სტატუსი:</span> {iakoDetail.active ? 'აქტიური' : 'გამორთული'}</div>
                      <div><span className="text-gray-400">{at("Vision:")}</span> {iakoDetail.visionEnabled ? 'ჩართული' : 'გამორთული'}</div>
                      <div><span className="text-gray-400">სულ მოთხოვნა (პროფილის ნაგულისხმევი):</span> {iakoDetail.defaultRequestLimit ?? '∞'}</div>
                      <div><span className="text-gray-400">დღიური:</span> {iakoDetail.defaultDailyRequestLimit ?? '∞'}</div>
                      <div><span className="text-gray-400">საათური:</span> {iakoDetail.defaultHourlyRequestLimit ?? '∞'}</div>
                      <div><span className="text-gray-400">სქრინშოთი (სულ):</span> {iakoDetail.defaultScreenshotLimit ?? '∞'}</div>
                      <div><span className="text-gray-400">სქრინშოთი/შეტყობინება:</span> {iakoDetail.defaultMaxScreenshotsPerMessage}</div>
                      <div><span className="text-gray-400">ცოდნის ბაზა:</span> {iakoDetail.sources.length} დოკუმენტი / {iakoDetail.sources.reduce((sum, s) => sum + s.totalChunks, 0)} ნაწილი</div>
                    </div>
                  )}

                  <div className="rounded-lg border border-gray-200 bg-white p-3.5 space-y-3">
                    <h4 className="text-sm font-bold text-gray-900">კონტროლირებადი ავტომატური შევსება</h4>
                    <p className="text-xs text-gray-500">
                      მაგ: 200 → ავტომატურად +200 ერთხელ → მაქსიმუმ 400. ამის მეტი ავტომატურად არასდროს ემატება; შემდგომი კრედიტი მხოლოდ ადმინის ხელით.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <label className="text-xs font-medium text-gray-700">საწყისი სულ
                        <input type="number" min={0} value={iakoInitialLimit} placeholder={String(iakoDetail?.defaultRequestLimit ?? 200)}
                          onChange={(e) => setIakoInitialLimit(e.target.value)} className={`${inputClass} mt-1.5`} />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mt-5">
                        <input type="checkbox" checked={iakoAutoTopUpEnabled} onChange={(e) => setIakoAutoTopUpEnabled(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                        ავტო-შევსება ჩართული
                      </label>
                    </div>
                    {iakoAutoTopUpEnabled && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <label className="text-xs font-medium text-gray-700">შევსების ოდენობა
                          <input type="number" min={1} value={iakoAutoTopUpAmount} placeholder="200" onChange={(e) => setIakoAutoTopUpAmount(e.target.value)} className={`${inputClass} mt-1.5`} />
                        </label>
                        <label className="text-xs font-medium text-gray-700">მაქს. ავტო-შევსებები
                          <input type="number" min={1} value={iakoMaxAutoTopUps} onChange={(e) => setIakoMaxAutoTopUps(e.target.value)} className={`${inputClass} mt-1.5`} />
                        </label>
                        <label className="text-xs font-medium text-gray-700">მაქსიმალური ჯამი
                          <input type="number" min={1} value={iakoMaxAutoTotal} placeholder="400" onChange={(e) => setIakoMaxAutoTotal(e.target.value)} className={`${inputClass} mt-1.5`} />
                        </label>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500">
                    სასწავლო მასალები IAKO-სთვის იმართება არჩეული IAKO პროფილის ცოდნის ბაზაში — არა Daily Guides-ის „ცოდნის ბაზა — წყაროებში".
                  </p>

                  <Link
                    href={iakoProfileId ? `/admin/iako/profiles?id=${encodeURIComponent(iakoProfileId)}` : '/admin/iako/profiles'}
                    className="inline-block text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    IAKO პროფილის მართვა →
                  </Link>
                </div>
              )}

              {iakoWarning && (
                <div role="alert" className="rounded-lg bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-xs text-amber-800">
                  {iakoWarning}
                </div>
              )}
            </div>
    </>
  );
}
