/**
 * Educator Hub module 1: AI test generator (from a topic or an uploaded document).
 */
import FileDropzone from '../../shared/FileDropzone';
import { Difficulty, GeneratedTest, QuestionType, QuizSubmissionSummary } from '../../../services/educatorHubService';
import { Copy, FileText, Link2, Loader2, Users } from 'lucide-react';
import RichTextEditor from '../../shared/RichTextEditor';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';
import { TabId, ExportBar, inputClass, labelClass, optionClass } from './educatorHubShared';

interface TestGeneratorTabProps {
  tab: TabId;
  t: TFunction<"educatorHub", undefined>;
  testSubject: string;
  setTestSubject: Dispatch<SetStateAction<string>>;
  hasAccess: boolean;
  testGrade: string;
  setTestGrade: Dispatch<SetStateAction<string>>;
  testTopic: string;
  setTestTopic: Dispatch<SetStateAction<string>>;
  testSourceFile: File | null;
  setTestSourceFile: Dispatch<SetStateAction<File | null>>;
  testSourceText: string;
  setTestSourceText: Dispatch<SetStateAction<string>>;
  testTypes: QuestionType[];
  toggleTestType: (type: QuestionType) => void;
  testDifficulty: Difficulty;
  setTestDifficulty: Dispatch<SetStateAction<Difficulty>>;
  testCount: number;
  setTestCount: Dispatch<SetStateAction<number>>;
  testGenerating: boolean;
  handleGenerateTest: () => Promise<void>;
  testError: string | null;
  testResult: GeneratedTest | null;
  setTestResult: Dispatch<SetStateAction<GeneratedTest | null>>;
  quizShareLink: string | null;
  quizSharing: boolean;
  handleShareQuiz: () => Promise<void>;
  handleLoadSubmissions: () => Promise<void>;
  quizSubmissionsLoading: boolean;
  quizSubmissions: QuizSubmissionSummary[] | null;
  quizShareError: string | null;
}

export default function TestGeneratorTab({
  tab,
  t,
  testSubject,
  setTestSubject,
  hasAccess,
  testGrade,
  setTestGrade,
  testTopic,
  setTestTopic,
  testSourceFile,
  setTestSourceFile,
  testSourceText,
  setTestSourceText,
  testTypes,
  toggleTestType,
  testDifficulty,
  setTestDifficulty,
  testCount,
  setTestCount,
  testGenerating,
  handleGenerateTest,
  testError,
  testResult,
  setTestResult,
  quizShareLink,
  quizSharing,
  handleShareQuiz,
  handleLoadSubmissions,
  quizSubmissionsLoading,
  quizSubmissions,
  quizShareError,
}: TestGeneratorTabProps) {
  return (
    <>
        {/* Module 1: Test generator */}
        {tab === 'test' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <div className="grid sm:grid-cols-2 gap-4 mb-4 no-print">
              <div>
                <label className={labelClass}>{t('testSubjectLabel', 'საგანი')}</label>
                <input className={inputClass} value={testSubject} onChange={(e) => setTestSubject(e.target.value)} placeholder={t('testSubjectPlaceholder')} disabled={!hasAccess} />
              </div>
              <div>
                <label className={labelClass}>{t('testGradeLabel', 'კლასი')}</label>
                <input className={inputClass} value={testGrade} onChange={(e) => setTestGrade(e.target.value)} placeholder={t('testGradePlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('testTopicLabel', 'თემა')}</label>
                <input className={inputClass} value={testTopic} onChange={(e) => setTestTopic(e.target.value)} placeholder={t('testTopicPlaceholder')} disabled={!hasAccess} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('testSourceUploadLabel')}</label>
                <FileDropzone
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  uploading={false}
                  selectedFileName={testSourceFile?.name ?? null}
                  onFile={setTestSourceFile}
                  label={t('testSourceUploadCta')}
                  hint={t('testSourceUploadHint')}
                  uploadingLabel={t('testSourceUploading')}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('testSourceTextLabel')}</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={testSourceText}
                  onChange={(e) => setTestSourceText(e.target.value)}
                  placeholder={t('testSourceTextPlaceholder')}
                  disabled={!hasAccess}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('testQuestionTypesLabel')}</label>
                <div className="flex flex-wrap gap-3">
                  {(['MULTIPLE_CHOICE', 'OPEN', 'MATCHING'] as QuestionType[]).map((type) => (
                    <label key={type} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={testTypes.includes(type)} onChange={() => toggleTestType(type)} disabled={!hasAccess} />
                      {t(`testType${type === 'MULTIPLE_CHOICE' ? 'MultipleChoice' : type === 'OPEN' ? 'Open' : 'Matching'}`)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>{t('testDifficultyLabel')}</label>
                <select className={inputClass} value={testDifficulty} onChange={(e) => setTestDifficulty(e.target.value as Difficulty)} disabled={!hasAccess}>
                  <option className={optionClass} value="EASY">{t('difficultyEasy')}</option>
                  <option className={optionClass} value="MEDIUM">{t('difficultyMedium')}</option>
                  <option className={optionClass} value="HARD">{t('difficultyHard')}</option>
                  <option className={optionClass} value="MIXED">{t('difficultyMixed')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('testQuestionCountLabel')}</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className={inputClass}
                  value={testCount}
                  onChange={(e) => {
                    // A cleared field evaluates Number('') as 0, not NaN —
                    // silently sending questionCount:0 to a schema that
                    // requires >=1, which surfaced as a generic "something
                    // went wrong" instead of a clear reason. Clamped here
                    // instead of relying on the disabled-button guard below,
                    // since nothing else in this form validates testCount.
                    const parsed = Number(e.target.value);
                    setTestCount(Number.isFinite(parsed) ? Math.min(30, Math.max(1, parsed)) : 1);
                  }}
                  disabled={!hasAccess}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!hasAccess || testGenerating}
              onClick={handleGenerateTest}
              className="no-print inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
            >
              {testGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {testGenerating ? t('testGenerating') : t('testGenerateButton')}
            </button>
            {testError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3 no-print">{testError}</p>}

            <div id="print-test" className="mt-6">
              {testResult ? (
                <>
                  <h3 className="text-base font-black mb-2">{t('testOutputSheetHeading')}</h3>
                  <RichTextEditor value={testResult.testSheet} onChange={(v) => setTestResult((prev) => (prev ? { ...prev, testSheet: v } : prev))} rows={14} />
                  <h3 className="text-base font-black mb-2 mt-6">{t('testOutputKeyHeading')}</h3>
                  <RichTextEditor value={testResult.answerKey} onChange={(v) => setTestResult((prev) => (prev ? { ...prev, answerKey: v } : prev))} rows={10} />
                  <div className="no-print">
                    <ExportBar
                      t={t}
                      sections={[
                        { heading: t('testOutputSheetHeading'), body: testResult.testSheet },
                        { heading: t('testOutputKeyHeading'), body: testResult.answerKey },
                      ]}
                      filenameBase="test"
                      printAreaId="print-test"
                    />
                  </div>
                  <div className="no-print mt-6 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    {!quizShareLink ? (
                      <button
                        type="button"
                        disabled={quizSharing}
                        onClick={handleShareQuiz}
                        className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
                      >
                        {quizSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                        {t('quizShareButton')}
                      </button>
                    ) : (
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('quizShareLinkLabel')}</p>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <input
                            readOnly
                            value={quizShareLink}
                            onClick={(e) => e.currentTarget.select()}
                            className="flex-1 min-w-[16rem] rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(quizShareLink)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {t('exportCopy')}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadSubmissions}
                          disabled={quizSubmissionsLoading}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                          <Users className="w-3.5 h-3.5" />
                          {t('quizResultsRefresh')}
                        </button>
                        {quizSubmissions && (
                          <div className="mt-3 space-y-1.5">
                            {quizSubmissions.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 italic">{t('quizResultsEmpty')}</p>
                            ) : (
                              quizSubmissions.map((s) => (
                                <div key={s.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                                  <span className="font-bold">{s.studentName}</span>
                                  <span>{s.score}%</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {quizShareError && <p className="text-xs text-rose-600 dark:text-rose-400 mt-2">{quizShareError}</p>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic no-print">{t('testEmptyState')}</p>
              )}
            </div>
          </div>
        )}
    </>
  );
}
