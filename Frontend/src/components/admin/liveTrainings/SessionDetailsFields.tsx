/**
 * Live training form: end time, Google Classroom / meeting and recording links
 * and the AI-generated synopsis.
 */
import RichTextEditor from '../../shared/RichTextEditor';
import { LiveTrainingPayload } from '../../../services/adminLiveTrainingService';
import { LiveTraining } from '../../../types/liveTraining';
import type { Dispatch, SetStateAction } from 'react';

interface SessionDetailsFieldsProps {
  form: Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; };
  setForm: Dispatch<SetStateAction<Omit<LiveTrainingPayload, "discountBadgeText"> & { scheduledAtLocal: string; startDateLocal: string; endDateLocal: string; discountEndDateLocal: string; discountBadgeText: string; }>>;
  inputClass: "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  handleGenerateWorkspace: () => Promise<void>;
  generatingWorkspace: boolean;
  workspaceStatus: { kind: "success" | "partial" | "error"; message: string; } | null;
  editingId: string | null;
  editingTraining: LiveTraining | null;
  handleRegenerateSynopsis: () => Promise<void>;
  regeneratingSynopsis: boolean;
  setSynopsisLang: Dispatch<SetStateAction<"Ka" | "En" | "Ru">>;
  synopsisLang: "Ka" | "En" | "Ru";
  SYNOPSIS_VALUE: Record<"Ka" | "En" | "Ru", string>;
  SYNOPSIS_SETTER: Record<"Ka" | "En" | "Ru", (v: string) => void>;
  handleSaveSynopsis: () => Promise<void>;
  savingSynopsis: boolean;
}

export default function SessionDetailsFields({
  form,
  setForm,
  inputClass,
  handleGenerateWorkspace,
  generatingWorkspace,
  workspaceStatus,
  editingId,
  editingTraining,
  handleRegenerateSynopsis,
  regeneratingSynopsis,
  setSynopsisLang,
  synopsisLang,
  SYNOPSIS_VALUE,
  SYNOPSIS_SETTER,
  handleSaveSynopsis,
  savingSynopsis,
}: SessionDetailsFieldsProps) {
  return (
    <>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">სესიის მართვა — მიერთება, ჩანაწერი და კონფირმირებული თარიღი</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">დაწყების დრო (კონფირმირებული)</label>
                  <input
                    type="datetime-local"
                    value={form.startDateLocal}
                    onChange={(e) => setForm({ ...form, startDateLocal: e.target.value })}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 mt-1">ცალკეა საჯარო „თარიღი და დრო“-სგან — მიერთების ბმული სტუდენტების დაშბორდზე ამ დროის მიხედვით ჩნდება.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">დასრულების დრო</label>
                  <input
                    type="datetime-local"
                    value={form.endDateLocal}
                    onChange={(e) => setForm({ ...form, endDateLocal: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleGenerateWorkspace}
                  disabled={generatingWorkspace}
                  className="inline-flex items-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-cyan-600 px-4 py-2.5 rounded-lg border-none cursor-pointer disabled:opacity-60"
                >
                  {generatingWorkspace ? 'გენერირდება…' : '✨ ავტომატური გენერაცია (AI Workspace)'}
                </button>
                {workspaceStatus && (
                  <p
                    className={`text-xs font-semibold ${
                      workspaceStatus.kind === 'success'
                        ? 'text-emerald-600'
                        : workspaceStatus.kind === 'partial'
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }`}
                  >
                    {workspaceStatus.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">მიერთების ბმული (Zoom / Google Meet)</label>
                  <input
                    type="text"
                    value={form.meetingUrl ?? ''}
                    onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Google Classroom ბმული</label>
                  <input
                    type="text"
                    value={form.classroomUrl ?? ''}
                    onChange={(e) => setForm({ ...form, classroomUrl: e.target.value })}
                    placeholder="https://classroom.google.com/..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ჩანაწერის ბმული</label>
                  <input
                    type="text"
                    value={form.recordingUrl ?? ''}
                    onChange={(e) => setForm({ ...form, recordingUrl: e.target.value })}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
              </div>

              {editingId && editingTraining && (
                <div className="border-t border-cyan-200 pt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      AI სინოფსისი (კონსპექტი) {editingTraining.synopsisStatus === 'FAILED' && editingTraining.synopsisError && (
                        <span className="text-red-500 font-normal">— {editingTraining.synopsisError}</span>
                      )}
                      {editingTraining.synopsisStatus === 'PROCESSING' && <span className="text-amber-600 font-normal"> — გენერირდება…</span>}
                    </label>
                    {form.recordingUrl && (
                      <button
                        type="button"
                        onClick={handleRegenerateSynopsis}
                        disabled={regeneratingSynopsis || editingTraining.synopsisStatus === 'PROCESSING'}
                        className="shrink-0 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
                      >
                        {regeneratingSynopsis ? 'იწყება…' : '✨ სინოფსისის თავიდან გენერირება'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 mb-1.5">
                    {(['Ka', 'En', 'Ru'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setSynopsisLang(l)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded ${
                          synopsisLang === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <RichTextEditor
                    rows={5}
                    value={SYNOPSIS_VALUE[synopsisLang]}
                    onChange={SYNOPSIS_SETTER[synopsisLang]}
                    placeholder="ავტომატურად გენერირდება ჩანაწერის ატვირთვისას — ან დაწერეთ/დაარედაქტირეთ ხელით."
                    className="text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSaveSynopsis}
                    disabled={savingSynopsis}
                    className="mt-1.5 text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingSynopsis ? 'ინახება…' : 'სინოფსისის შენახვა'}
                  </button>
                </div>
              )}
            </div>
    </>
  );
}
