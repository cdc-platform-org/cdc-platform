/**
 * Educator Hub module 2: assessment rubric builder.
 */
import { ClipboardList, Loader2 } from 'lucide-react';
import RichTextEditor from '../../shared/RichTextEditor';
import { GeneratedRubric } from '../../../services/educatorHubService';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { TabId, ExportBar, inputClass, labelClass, optionClass } from './educatorHubShared';

interface RubricTabProps {
  tab: TabId;
  t: TFunction<"educatorHub", undefined>;
  rubricSubject: string;
  setRubricSubject: Dispatch<SetStateAction<string>>;
  hasAccess: boolean;
  rubricGrade: string;
  setRubricGrade: Dispatch<SetStateAction<string>>;
  rubricAssessmentType: "FORMATIVE" | "SUMMATIVE" | "DIAGNOSTIC" | "PROJECT";
  setRubricAssessmentType: Dispatch<SetStateAction<"FORMATIVE" | "SUMMATIVE" | "DIAGNOSTIC" | "PROJECT">>;
  rubricScale: string;
  setRubricScale: Dispatch<SetStateAction<string>>;
  rubricSkill: string;
  setRubricSkill: Dispatch<SetStateAction<string>>;
  rubricGenerating: boolean;
  handleGenerateRubric: () => Promise<void>;
  rubricError: string | null;
  rubricResult: GeneratedRubric | null;
  setRubricResult: Dispatch<SetStateAction<GeneratedRubric | null>>;
}

export default function RubricTab({
  tab,
  t,
  rubricSubject,
  setRubricSubject,
  hasAccess,
  rubricGrade,
  setRubricGrade,
  rubricAssessmentType,
  setRubricAssessmentType,
  rubricScale,
  setRubricScale,
  rubricSkill,
  setRubricSkill,
  rubricGenerating,
  handleGenerateRubric,
  rubricError,
  rubricResult,
  setRubricResult,
}: RubricTabProps) {
  return (
    <>
        {/* Module 2: Rubric builder */}
        {tab === 'rubric' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('rubricSubjectLabel')}</label>
                <input className={inputClass} value={rubricSubject} onChange={(e) => setRubricSubject(e.target.value)} placeholder={t('rubricSubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('rubricGradeLabel')}</label>
                <input className={inputClass} value={rubricGrade} onChange={(e) => setRubricGrade(e.target.value)} placeholder={t('rubricGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('rubricAssessmentTypeLabel')}</label>
                <select
                  className={inputClass}
                  value={rubricAssessmentType}
                  onChange={(e) => setRubricAssessmentType(e.target.value as 'FORMATIVE' | 'SUMMATIVE' | 'DIAGNOSTIC' | 'PROJECT')}
                  disabled={!hasAccess}
                >
                  <option className={optionClass} value="SUMMATIVE">{t('assessmentSummative')}</option>
                  <option className={optionClass} value="FORMATIVE">{t('assessmentFormative')}</option>
                  <option className={optionClass} value="DIAGNOSTIC">{t('assessmentDiagnostic')}</option>
                  <option className={optionClass} value="PROJECT">{t('assessmentProject')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('rubricScaleLabel')}</label>
                <input className={inputClass} value={rubricScale} onChange={(e) => setRubricScale(e.target.value)} placeholder={t('rubricScalePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('rubricSkillLabel')}</label>
                <input className={inputClass} value={rubricSkill} onChange={(e) => setRubricSkill(e.target.value)} placeholder={t('rubricSkillPlaceholder')} disabled={!hasAccess} />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || rubricGenerating}
              onClick={handleGenerateRubric}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
            >
              {rubricGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              {rubricGenerating ? t('rubricGenerating') : t('rubricGenerateButton')}
            </button>
            {rubricError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{rubricError}</p>}

            <div id="print-rubric" className="mt-6">
              {rubricResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('rubricOutputHeading')}</h3>
                  <RichTextEditor value={rubricResult.rubric} onChange={(v) => setRubricResult({ rubric: v })} rows={16} />
                  <div className="no-print">
                    <ExportBar t={t} sections={[{ heading: t('rubricOutputHeading'), body: rubricResult.rubric }]} filenameBase="rubric" printAreaId="print-rubric" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('rubricEmptyState')}</p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
