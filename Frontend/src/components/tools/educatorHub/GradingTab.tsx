/**
 * Educator Hub module 3: AI homework grading against a rubric.
 */
import FileDropzone from '../../shared/FileDropzone';
import { Loader2, PenSquare } from 'lucide-react';
import RichTextEditor from '../../shared/RichTextEditor';
import { GradedHomework } from '../../../services/educatorHubService';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { TabId, ExportBar, inputClass, labelClass } from './educatorHubShared';

interface GradingTabProps {
  tab: TabId;
  t: TFunction<"educatorHub", undefined>;
  gradingPrompt: string;
  setGradingPrompt: Dispatch<SetStateAction<string>>;
  hasAccess: boolean;
  setWorkSource: Dispatch<SetStateAction<"text" | "image">>;
  workSource: "text" | "image";
  studentWorkText: string;
  setStudentWorkText: Dispatch<SetStateAction<string>>;
  studentWorkImage: File | null;
  setStudentWorkImage: Dispatch<SetStateAction<File | null>>;
  gradingScale: string;
  setGradingScale: Dispatch<SetStateAction<string>>;
  gradingInProgress: boolean;
  handleGradeHomework: () => Promise<void>;
  gradingError: string | null;
  gradingResult: GradedHomework | null;
  setGradingResult: Dispatch<SetStateAction<GradedHomework | null>>;
}

export default function GradingTab({
  tab,
  t,
  gradingPrompt,
  setGradingPrompt,
  hasAccess,
  setWorkSource,
  workSource,
  studentWorkText,
  setStudentWorkText,
  studentWorkImage,
  setStudentWorkImage,
  gradingScale,
  setGradingScale,
  gradingInProgress,
  handleGradeHomework,
  gradingError,
  gradingResult,
  setGradingResult,
}: GradingTabProps) {
  return (
    <>
        {/* Module 3: Homework grading */}
        {tab === 'grading' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('gradingPromptLabel')}</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={gradingPrompt}
                  onChange={(e) => setGradingPrompt(e.target.value)}
                  placeholder={t('gradingPromptPlaceholder')}
                  disabled={!hasAccess}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('gradingWorkSourceLabel')}</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setWorkSource('text')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer ${workSource === 'text' ? 'bg-cyan-600 text-white border-transparent' : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`}
                  >
                    {t('gradingWorkTextTab')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkSource('image')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer ${workSource === 'image' ? 'bg-cyan-600 text-white border-transparent' : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'}`}
                  >
                    {t('gradingWorkImageTab')}
                  </button>
                </div>
                {workSource === 'text' ? (
                  <textarea
                    className={inputClass}
                    rows={6}
                    value={studentWorkText}
                    onChange={(e) => setStudentWorkText(e.target.value)}
                    placeholder={t('gradingWorkTextPlaceholder')}
                    disabled={!hasAccess}
                  />
                ) : (
                  <FileDropzone
                    accept="image/jpeg,image/png,image/webp"
                    uploading={false}
                    selectedFileName={studentWorkImage?.name ?? null}
                    onFile={setStudentWorkImage}
                    label={t('gradingUploadCta')}
                    hint={t('gradingUploadHint')}
                    uploadingLabel={t('gradingUploading')}
                  />
                )}
              </div>
              <div>
                <label className={labelClass}>{t('gradingScaleLabel')}</label>
                <input className={inputClass} value={gradingScale} onChange={(e) => setGradingScale(e.target.value)} placeholder={t('gradingScalePlaceholder')} disabled={!hasAccess} />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || gradingInProgress}
              onClick={handleGradeHomework}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
            >
              {gradingInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenSquare className="w-4 h-4" />}
              {gradingInProgress ? t('gradingInProgress') : t('gradingButton')}
            </button>
            {gradingError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{gradingError}</p>}

            <div id="print-grading" className="mt-6">
              {gradingResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('gradingScoreHeading')}</h3>
                  <RichTextEditor value={gradingResult.score} onChange={(v) => setGradingResult((prev) => (prev ? { ...prev, score: v } : prev))} rows={2} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('gradingErrorsHeading')}</h3>
                  <RichTextEditor value={gradingResult.errorAnalysis} onChange={(v) => setGradingResult((prev) => (prev ? { ...prev, errorAnalysis: v } : prev))} rows={8} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('gradingFeedbackHeading')}</h3>
                  <RichTextEditor value={gradingResult.feedback} onChange={(v) => setGradingResult((prev) => (prev ? { ...prev, feedback: v } : prev))} rows={8} />
                  <div className="no-print">
                    <ExportBar
                      t={t}
                      sections={[
                        { heading: t('gradingScoreHeading'), body: gradingResult.score },
                        { heading: t('gradingErrorsHeading'), body: gradingResult.errorAnalysis },
                        { heading: t('gradingFeedbackHeading'), body: gradingResult.feedback },
                      ]}
                      filenameBase="grading"
                      printAreaId="print-grading"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('gradingEmptyState')}</p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
