/**
 * Educator Hub module 6: school documentation and paperwork drafts.
 */
import { BureaucracyDocumentType, GeneratedBureaucracyDoc } from '../../../services/educatorHubService';
import { FolderKanban, Loader2 } from 'lucide-react';
import RichTextEditor from '../../shared/RichTextEditor';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { TabId, ExportBar, inputClass, labelClass, optionClass } from './educatorHubShared';

interface BureaucracyTabProps {
  tab: TabId;
  t: TFunction<"educatorHub", undefined>;
  bureaucracyDocType: BureaucracyDocumentType;
  setBureaucracyDocType: Dispatch<SetStateAction<BureaucracyDocumentType>>;
  hasAccess: boolean;
  bureaucracySubject: string;
  setBureaucracySubject: Dispatch<SetStateAction<string>>;
  bureaucracyGrade: string;
  setBureaucracyGrade: Dispatch<SetStateAction<string>>;
  bureaucracyKeyPoints: string;
  setBureaucracyKeyPoints: Dispatch<SetStateAction<string>>;
  bureaucracyGenerating: boolean;
  handleGenerateBureaucracyDoc: () => Promise<void>;
  bureaucracyError: string | null;
  bureaucracyResult: GeneratedBureaucracyDoc | null;
  setBureaucracyResult: Dispatch<SetStateAction<GeneratedBureaucracyDoc | null>>;
}

export default function BureaucracyTab({
  tab,
  t,
  bureaucracyDocType,
  setBureaucracyDocType,
  hasAccess,
  bureaucracySubject,
  setBureaucracySubject,
  bureaucracyGrade,
  setBureaucracyGrade,
  bureaucracyKeyPoints,
  setBureaucracyKeyPoints,
  bureaucracyGenerating,
  handleGenerateBureaucracyDoc,
  bureaucracyError,
  bureaucracyResult,
  setBureaucracyResult,
}: BureaucracyTabProps) {
  return (
    <>
        {/* Module 6: School bureaucracy & documentation */}
        {tab === 'bureaucracy' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('bureaucracyDocTypeLabel')}</label>
                <select className={inputClass} value={bureaucracyDocType} onChange={(e) => setBureaucracyDocType(e.target.value as BureaucracyDocumentType)} disabled={!hasAccess}>
                  <option className={optionClass} value="ACTIVITY_REPORT">{t('bureaucracyDocActivityReport')}</option>
                  <option className={optionClass} value="SELF_ASSESSMENT">{t('bureaucracyDocSelfAssessment')}</option>
                  <option className={optionClass} value="CLUB_PLAN">{t('bureaucracyDocClubPlan')}</option>
                  <option className={optionClass} value="PROJECT_APPLICATION">{t('bureaucracyDocProjectApplication')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('bureaucracySubjectLabel')}</label>
                <input className={inputClass} value={bureaucracySubject} onChange={(e) => setBureaucracySubject(e.target.value)} placeholder={t('bureaucracySubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('bureaucracyGradeLabel')}</label>
                <input className={inputClass} value={bureaucracyGrade} onChange={(e) => setBureaucracyGrade(e.target.value)} placeholder={t('bureaucracyGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('bureaucracyKeyPointsLabel')}</label>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={bureaucracyKeyPoints}
                  onChange={(e) => setBureaucracyKeyPoints(e.target.value)}
                  placeholder={t('bureaucracyKeyPointsPlaceholder')}
                  disabled={!hasAccess}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || bureaucracyGenerating}
              onClick={handleGenerateBureaucracyDoc}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
            >
              {bureaucracyGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderKanban className="w-4 h-4" />}
              {bureaucracyGenerating ? t('bureaucracyGenerating') : t('bureaucracyGenerateButton')}
            </button>
            {bureaucracyError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{bureaucracyError}</p>}

            <div id="print-bureaucracy" className="mt-6">
              {bureaucracyResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('bureaucracyOutputHeading')}</h3>
                  <RichTextEditor value={bureaucracyResult.document} onChange={(v) => setBureaucracyResult({ document: v })} rows={20} />
                  <div className="no-print">
                    <ExportBar t={t} sections={[{ heading: t('bureaucracyOutputHeading'), body: bureaucracyResult.document }]} filenameBase="school-document" printAreaId="print-bureaucracy" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('bureaucracyEmptyState')}</p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
