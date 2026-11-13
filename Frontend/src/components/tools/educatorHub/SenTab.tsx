/**
 * Educator Hub module 4: differentiated assignments and SEN adaptations.
 */
import { Loader2, Puzzle } from 'lucide-react';
import RichTextEditor from '../../shared/RichTextEditor';
import { GeneratedDifferentiatedTask } from '../../../services/educatorHubService';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { TabId, ExportBar, inputClass, labelClass } from './educatorHubShared';

interface SenTabProps {
  tab: TabId;
  t: TFunction<"educatorHub", undefined>;
  senSubject: string;
  setSenSubject: Dispatch<SetStateAction<string>>;
  hasAccess: boolean;
  senGrade: string;
  setSenGrade: Dispatch<SetStateAction<string>>;
  senTopic: string;
  setSenTopic: Dispatch<SetStateAction<string>>;
  senAdaptations: boolean;
  setSenAdaptations: Dispatch<SetStateAction<boolean>>;
  senGenerating: boolean;
  handleGenerateSen: () => Promise<void>;
  senError: string | null;
  senResult: GeneratedDifferentiatedTask | null;
  setSenResult: Dispatch<SetStateAction<GeneratedDifferentiatedTask | null>>;
}

export default function SenTab({
  tab,
  t,
  senSubject,
  setSenSubject,
  hasAccess,
  senGrade,
  setSenGrade,
  senTopic,
  setSenTopic,
  senAdaptations,
  setSenAdaptations,
  senGenerating,
  handleGenerateSen,
  senError,
  senResult,
  setSenResult,
}: SenTabProps) {
  return (
    <>
        {/* Module 4: Differentiated assignments & SEN adaptations */}
        {tab === 'sen' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('senSubjectLabel')}</label>
                <input className={inputClass} value={senSubject} onChange={(e) => setSenSubject(e.target.value)} placeholder={t('senSubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('senGradeLabel')}</label>
                <input className={inputClass} value={senGrade} onChange={(e) => setSenGrade(e.target.value)} placeholder={t('senGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('senTopicLabel')}</label>
                <input className={inputClass} value={senTopic} onChange={(e) => setSenTopic(e.target.value)} placeholder={t('senTopicPlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={senAdaptations} onChange={(e) => setSenAdaptations(e.target.checked)} disabled={!hasAccess} />
                  {t('senAdaptationsToggle')}
                </label>
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || senGenerating}
              onClick={handleGenerateSen}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
            >
              {senGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Puzzle className="w-4 h-4" />}
              {senGenerating ? t('senGenerating') : t('senGenerateButton')}
            </button>
            {senError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{senError}</p>}

            <div id="print-sen" className="mt-6">
              {senResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('senBasicHeading')}</h3>
                  <RichTextEditor value={senResult.basicLevel} onChange={(v) => setSenResult((prev) => (prev ? { ...prev, basicLevel: v } : prev))} rows={8} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('senStandardHeading')}</h3>
                  <RichTextEditor value={senResult.standardLevel} onChange={(v) => setSenResult((prev) => (prev ? { ...prev, standardLevel: v } : prev))} rows={8} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('senAdvancedHeading')}</h3>
                  <RichTextEditor value={senResult.advancedLevel} onChange={(v) => setSenResult((prev) => (prev ? { ...prev, advancedLevel: v } : prev))} rows={8} />
                  {senResult.senAdaptations && (
                    <>
                      <h3 className="text-base font-black mb-2 mt-6">{t('senAdaptationsHeading')}</h3>
                      <RichTextEditor value={senResult.senAdaptations} onChange={(v) => setSenResult((prev) => (prev ? { ...prev, senAdaptations: v } : prev))} rows={8} />
                    </>
                  )}
                  <div className="no-print">
                    <ExportBar
                      t={t}
                      sections={[
                        { heading: t('senBasicHeading'), body: senResult.basicLevel },
                        { heading: t('senStandardHeading'), body: senResult.standardLevel },
                        { heading: t('senAdvancedHeading'), body: senResult.advancedLevel },
                        ...(senResult.senAdaptations ? [{ heading: t('senAdaptationsHeading'), body: senResult.senAdaptations }] : []),
                      ]}
                      filenameBase="differentiated-task"
                      printAreaId="print-sen"
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('senEmptyState')}</p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
