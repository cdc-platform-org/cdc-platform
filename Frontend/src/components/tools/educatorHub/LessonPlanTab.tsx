/**
 * Educator Hub module 5: ESG lesson planner.
 */
import { GeneratedLessonPlan, LessonType } from '../../../services/educatorHubService';
import { BookOpen, Loader2 } from 'lucide-react';
import RichTextEditor from '../../shared/RichTextEditor';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { TabId, ExportBar, inputClass, labelClass, optionClass } from './educatorHubShared';

interface LessonPlanTabProps {
  tab: TabId;
  t: TFunction<"educatorHub", undefined>;
  lessonSubject: string;
  setLessonSubject: Dispatch<SetStateAction<string>>;
  hasAccess: boolean;
  lessonGrade: string;
  setLessonGrade: Dispatch<SetStateAction<string>>;
  lessonTopic: string;
  setLessonTopic: Dispatch<SetStateAction<string>>;
  lessonDuration: number;
  setLessonDuration: Dispatch<SetStateAction<number>>;
  lessonType: LessonType;
  setLessonType: Dispatch<SetStateAction<LessonType>>;
  lessonGenerating: boolean;
  handleGenerateLessonPlan: () => Promise<void>;
  lessonError: string | null;
  lessonResult: GeneratedLessonPlan | null;
  setLessonResult: Dispatch<SetStateAction<GeneratedLessonPlan | null>>;
}

export default function LessonPlanTab({
  tab,
  t,
  lessonSubject,
  setLessonSubject,
  hasAccess,
  lessonGrade,
  setLessonGrade,
  lessonTopic,
  setLessonTopic,
  lessonDuration,
  setLessonDuration,
  lessonType,
  setLessonType,
  lessonGenerating,
  handleGenerateLessonPlan,
  lessonError,
  lessonResult,
  setLessonResult,
}: LessonPlanTabProps) {
  return (
    <>
        {/* Module 5: ESG lesson planner */}
        {tab === 'lessonPlan' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('lessonSubjectLabel')}</label>
                <input className={inputClass} value={lessonSubject} onChange={(e) => setLessonSubject(e.target.value)} placeholder={t('lessonSubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('lessonGradeLabel')}</label>
                <input className={inputClass} value={lessonGrade} onChange={(e) => setLessonGrade(e.target.value)} placeholder={t('lessonGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('lessonTopicLabel')}</label>
                <input className={inputClass} value={lessonTopic} onChange={(e) => setLessonTopic(e.target.value)} placeholder={t('lessonTopicPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('lessonDurationLabel')}</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  className={inputClass}
                  value={lessonDuration}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    setLessonDuration(Number.isFinite(parsed) ? Math.min(180, Math.max(5, parsed)) : 45);
                  }}
                  disabled={!hasAccess}
                />
              </div>
              <div>
                <label className={labelClass}>{t('lessonTypeLabel')}</label>
                <select className={inputClass} value={lessonType} onChange={(e) => setLessonType(e.target.value as LessonType)} disabled={!hasAccess}>
                  <option className={optionClass} value="STANDARD">{t('lessonTypeStandard')}</option>
                  <option className={optionClass} value="STEM">{t('lessonTypeStem')}</option>
                  <option className={optionClass} value="PROJECT_BASED">{t('lessonTypeProjectBased')}</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || lessonGenerating}
              onClick={handleGenerateLessonPlan}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
            >
              {lessonGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
              {lessonGenerating ? t('lessonGenerating') : t('lessonGenerateButton')}
            </button>
            {lessonError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{lessonError}</p>}

            <div id="print-lesson" className="mt-6">
              {lessonResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('lessonOutputHeading')}</h3>
                  <RichTextEditor value={lessonResult.lessonPlan} onChange={(v) => setLessonResult({ lessonPlan: v })} rows={20} />
                  <div className="no-print">
                    <ExportBar t={t} sections={[{ heading: t('lessonOutputHeading'), body: lessonResult.lessonPlan }]} filenameBase="lesson-plan" printAreaId="print-lesson" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('lessonEmptyState')}</p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
