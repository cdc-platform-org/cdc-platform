/**
 * Educator Hub module 7: student reports and parent letters.
 */
import { GeneratedParentLetter, ParentLetterPurpose } from '../../../services/educatorHubService';
import { Loader2, Mail } from 'lucide-react';
import RichTextEditor from '../../shared/RichTextEditor';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { TabId, ExportBar, inputClass, labelClass, optionClass } from './educatorHubShared';

interface ParentReportsTabProps {
  tab: TabId;
  t: TFunction<"educatorHub", undefined>;
  letterStudentName: string;
  setLetterStudentName: Dispatch<SetStateAction<string>>;
  hasAccess: boolean;
  letterGrade: string;
  setLetterGrade: Dispatch<SetStateAction<string>>;
  letterPurpose: ParentLetterPurpose;
  setLetterPurpose: Dispatch<SetStateAction<ParentLetterPurpose>>;
  letterTeacherNotes: string;
  setLetterTeacherNotes: Dispatch<SetStateAction<string>>;
  letterGenerating: boolean;
  handleGenerateParentLetter: () => Promise<void>;
  letterError: string | null;
  letterResult: GeneratedParentLetter | null;
  setLetterResult: Dispatch<SetStateAction<GeneratedParentLetter | null>>;
}

export default function ParentReportsTab({
  tab,
  t,
  letterStudentName,
  setLetterStudentName,
  hasAccess,
  letterGrade,
  setLetterGrade,
  letterPurpose,
  setLetterPurpose,
  letterTeacherNotes,
  setLetterTeacherNotes,
  letterGenerating,
  handleGenerateParentLetter,
  letterError,
  letterResult,
  setLetterResult,
}: ParentReportsTabProps) {
  return (
    <>
        {/* Module 7: Student reports & parent letters */}
        {tab === 'parentReports' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('letterStudentNameLabel')}</label>
                <input className={inputClass} value={letterStudentName} onChange={(e) => setLetterStudentName(e.target.value)} placeholder={t('letterStudentNamePlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('letterGradeLabel')}</label>
                <input className={inputClass} value={letterGrade} onChange={(e) => setLetterGrade(e.target.value)} placeholder={t('letterGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('letterPurposeLabel')}</label>
                <select className={inputClass} value={letterPurpose} onChange={(e) => setLetterPurpose(e.target.value as ParentLetterPurpose)} disabled={!hasAccess}>
                  <option className={optionClass} value="PRAISE">{t('letterPurposePraise')}</option>
                  <option className={optionClass} value="ACADEMIC_IMPROVEMENT">{t('letterPurposeAcademicImprovement')}</option>
                  <option className={optionClass} value="BEHAVIORAL_NOTE">{t('letterPurposeBehavioralNote')}</option>
                  <option className={optionClass} value="ATTENDANCE">{t('letterPurposeAttendance')}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('letterTeacherNotesLabel')}</label>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={letterTeacherNotes}
                  onChange={(e) => setLetterTeacherNotes(e.target.value)}
                  placeholder={t('letterTeacherNotesPlaceholder')}
                  disabled={!hasAccess}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || letterGenerating}
              onClick={handleGenerateParentLetter}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
            >
              {letterGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {letterGenerating ? t('letterGenerating') : t('letterGenerateButton')}
            </button>
            {letterError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{letterError}</p>}

            <div id="print-letter" className="mt-6">
              {letterResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('letterOutputHeading')}</h3>
                  <RichTextEditor value={letterResult.letter} onChange={(v) => setLetterResult({ letter: v })} rows={14} />
                  <div className="no-print">
                    <ExportBar t={t} sections={[{ heading: t('letterOutputHeading'), body: letterResult.letter }]} filenameBase="parent-letter" printAreaId="print-letter" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('letterEmptyState')}</p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
