/**
 * /dashboard/tools/educator-hub — AI tools for teachers (VIP / trial access).
 * This file owns access state, every module's form state and the API calls;
 * each module's UI is a tab component in src/components/tools/educatorHub/
 * (TestGeneratorTab, RubricTab, GradingTab, SenTab, LessonPlanTab,
 * BureaucracyTab, ParentReportsTab) and shared helpers are in
 * educatorHubShared.tsx.
 */
import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import SEOHead from '../../../src/components/seo/SEOHead';
import CertificateBuilder from '../../../src/components/certificates/CertificateBuilder';
import { resolveLocale, contentLocale } from '../../../src/utils/locale';
import {
  getEducatorHubState,
  startEducatorVipTrial,
  generateTest,
  generateRubric,
  gradeHomework,
  createQuiz,
  getQuizSubmissions,
  EducatorHubState,
  QuestionType,
  Difficulty,
  GeneratedTest,
  GeneratedRubric,
  GradedHomework,
  QuizSubmissionSummary,
  generateDifferentiatedTask,
  GeneratedDifferentiatedTask,
  generateLessonPlan,
  GeneratedLessonPlan,
  LessonType,
  generateBureaucracyDoc,
  GeneratedBureaucracyDoc,
  BureaucracyDocumentType,
  generateParentLetter,
  GeneratedParentLetter,
  ParentLetterPurpose,
} from '../../../src/services/educatorHubService';
import ToolShell, { ToolTabs } from '../../../src/components/tools/ToolShell';
import EducatorHubHeader from '../../../src/components/tools/educatorHub/EducatorHubHeader';
import TestGeneratorTab from '../../../src/components/tools/educatorHub/TestGeneratorTab';
import RubricTab from '../../../src/components/tools/educatorHub/RubricTab';
import GradingTab from '../../../src/components/tools/educatorHub/GradingTab';
import SenTab from '../../../src/components/tools/educatorHub/SenTab';
import LessonPlanTab from '../../../src/components/tools/educatorHub/LessonPlanTab';
import BureaucracyTab from '../../../src/components/tools/educatorHub/BureaucracyTab';
import ParentReportsTab from '../../../src/components/tools/educatorHub/ParentReportsTab';
import { TabId, REAL_TABS, TAB_LABEL_KEY, extractErrorMessage } from '../../../src/components/tools/educatorHub/educatorHubShared';

function EducatorHubContent() {
  const router = useRouter();
  const lang = contentLocale(resolveLocale(router.locale));
  const { t } = useTranslation('educatorHub');

  const [hubState, setHubState] = useState<EducatorHubState | null>(null);
  const [stateLoading, setStateLoading] = useState(true);
  // Distinct from "no VIP access" — a fetch failure (network/backend down)
  // previously fell through to the exact same "VIP Required" upsell banner
  // with no indication anything had actually gone wrong, silently hiding
  // real access from a paying VIP if their very first load happened to hit
  // a transient network error. Now surfaced with its own retry affordance.
  const [stateError, setStateError] = useState(false);
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('test');

  const refreshState = () =>
    getEducatorHubState()
      .then((s) => {
        setHubState(s);
        setStateError(false);
      })
      .catch(() => setStateError(true));

  useEffect(() => {
    refreshState().finally(() => setStateLoading(false));
  }, []);

  const handleStartTrial = async () => {
    setTrialStarting(true);
    setTrialError(null);
    try {
      await startEducatorVipTrial();
      await refreshState();
    } catch (err) {
      setTrialError(extractErrorMessage(err, t('trialStartError')).message);
    } finally {
      setTrialStarting(false);
    }
  };

  // Shared by all 3 real modules — VIP_REQUIRED/QUOTA_EXCEEDED refresh the
  // usage/access banner instead of just showing a toast, since both change
  // what the header CTA should say.
  const handleModuleError = (err: any, fallback: string, setError: (msg: string) => void) => {
    const { message, code } = extractErrorMessage(err, fallback);
    if (code === 'VIP_REQUIRED' || code === 'QUOTA_EXCEEDED') {
      refreshState();
    }
    setError(message);
  };

  // ---- Module 1: Test generator ----
  const [testSubject, setTestSubject] = useState('');
  const [testGrade, setTestGrade] = useState('');
  const [testTopic, setTestTopic] = useState('');
  const [testTypes, setTestTypes] = useState<QuestionType[]>(['MULTIPLE_CHOICE']);
  const [testDifficulty, setTestDifficulty] = useState<Difficulty>('MIXED');
  const [testCount, setTestCount] = useState(10);
  const [testSourceText, setTestSourceText] = useState('');
  const [testSourceFile, setTestSourceFile] = useState<File | null>(null);
  const [testGenerating, setTestGenerating] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<GeneratedTest | null>(null);

  // Quiz-sharing — a generated test's structured `questions` (see
  // GeneratedTest) turned into a no-login student link. Reset whenever a
  // fresh test is generated, since a previously shared link refers to the
  // old question set, not whatever testResult currently holds.
  const [quizSharing, setQuizSharing] = useState(false);
  const [quizShareError, setQuizShareError] = useState<string | null>(null);
  const [quizShareLink, setQuizShareLink] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmissionSummary[] | null>(null);
  const [quizSubmissionsLoading, setQuizSubmissionsLoading] = useState(false);

  const toggleTestType = (type: QuestionType) => {
    setTestTypes((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]));
  };

  const handleGenerateTest = async () => {
    if (!testSubject.trim() || !testGrade.trim() || !testTopic.trim() || testTypes.length === 0) return;
    setTestGenerating(true);
    setTestError(null);
    try {
      const result = await generateTest({
        subject: testSubject,
        grade: testGrade,
        topic: testTopic,
        questionTypes: testTypes,
        difficulty: testDifficulty,
        questionCount: testCount,
        language: lang,
        sourceText: testSourceText.trim() || undefined,
        sourceFile: testSourceFile ?? undefined,
      });
      setTestResult(result);
      setQuizShareLink(null);
      setQuizId(null);
      setQuizSubmissions(null);
      setQuizShareError(null);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setTestError);
    } finally {
      setTestGenerating(false);
    }
  };

  const handleShareQuiz = async () => {
    if (!testResult) return;
    setQuizSharing(true);
    setQuizShareError(null);
    try {
      const { id, shareToken } = await createQuiz({
        title: `${testSubject} — ${testTopic}`,
        language: lang,
        questions: testResult.questions,
      });
      setQuizId(id);
      setQuizShareLink(`${window.location.origin}/quiz/${shareToken}`);
    } catch (err) {
      handleModuleError(err, t('genericError'), setQuizShareError);
    } finally {
      setQuizSharing(false);
    }
  };

  const handleLoadSubmissions = async () => {
    if (!quizId) return;
    setQuizSubmissionsLoading(true);
    try {
      setQuizSubmissions(await getQuizSubmissions(quizId));
    } catch {
      setQuizSubmissions([]);
    } finally {
      setQuizSubmissionsLoading(false);
    }
  };

  // ---- Module 2: Rubric builder ----
  const [rubricSubject, setRubricSubject] = useState('');
  const [rubricGrade, setRubricGrade] = useState('');
  const [rubricAssessmentType, setRubricAssessmentType] = useState<'FORMATIVE' | 'SUMMATIVE' | 'DIAGNOSTIC' | 'PROJECT'>('SUMMATIVE');
  const [rubricSkill, setRubricSkill] = useState('');
  const [rubricScale, setRubricScale] = useState('0–10');
  const [rubricGenerating, setRubricGenerating] = useState(false);
  const [rubricError, setRubricError] = useState<string | null>(null);
  const [rubricResult, setRubricResult] = useState<GeneratedRubric | null>(null);

  const handleGenerateRubric = async () => {
    if (!rubricSubject.trim() || !rubricGrade.trim() || !rubricSkill.trim() || !rubricScale.trim()) return;
    setRubricGenerating(true);
    setRubricError(null);
    try {
      const result = await generateRubric({
        subject: rubricSubject,
        grade: rubricGrade,
        assessmentType: rubricAssessmentType,
        skillOrTopic: rubricSkill,
        scoringScale: rubricScale,
        language: lang,
      });
      setRubricResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setRubricError);
    } finally {
      setRubricGenerating(false);
    }
  };

  // ---- Module 3: Homework grading ----
  const [gradingPrompt, setGradingPrompt] = useState('');
  const [workSource, setWorkSource] = useState<'text' | 'image'>('text');
  const [studentWorkText, setStudentWorkText] = useState('');
  const [studentWorkImage, setStudentWorkImage] = useState<File | null>(null);
  const [gradingScale, setGradingScale] = useState('0–100');
  const [gradingInProgress, setGradingInProgress] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingResult, setGradingResult] = useState<GradedHomework | null>(null);

  const handleGradeHomework = async () => {
    if (!gradingPrompt.trim() || !gradingScale.trim()) return;
    if (workSource === 'text' && !studentWorkText.trim()) return;
    if (workSource === 'image' && !studentWorkImage) return;
    setGradingInProgress(true);
    setGradingError(null);
    try {
      const result = await gradeHomework({
        assignmentPrompt: gradingPrompt,
        studentWorkText: workSource === 'text' ? studentWorkText : undefined,
        studentWorkImage: workSource === 'image' ? studentWorkImage ?? undefined : undefined,
        gradingScale,
        language: lang,
      });
      setGradingResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setGradingError);
    } finally {
      setGradingInProgress(false);
    }
  };

  // ---- Module 4: Differentiated assignments & SEN adaptations ----
  const [senSubject, setSenSubject] = useState('');
  const [senGrade, setSenGrade] = useState('');
  const [senTopic, setSenTopic] = useState('');
  const [senAdaptations, setSenAdaptations] = useState(false);
  const [senGenerating, setSenGenerating] = useState(false);
  const [senError, setSenError] = useState<string | null>(null);
  const [senResult, setSenResult] = useState<GeneratedDifferentiatedTask | null>(null);

  const handleGenerateSen = async () => {
    if (!senSubject.trim() || !senGrade.trim() || !senTopic.trim()) return;
    setSenGenerating(true);
    setSenError(null);
    try {
      const result = await generateDifferentiatedTask({
        subject: senSubject,
        grade: senGrade,
        topic: senTopic,
        senAdaptations,
        language: lang,
      });
      setSenResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setSenError);
    } finally {
      setSenGenerating(false);
    }
  };

  // ---- Module 5: ESG lesson planner ----
  const [lessonSubject, setLessonSubject] = useState('');
  const [lessonGrade, setLessonGrade] = useState('');
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonDuration, setLessonDuration] = useState(45);
  const [lessonType, setLessonType] = useState<LessonType>('STANDARD');
  const [lessonGenerating, setLessonGenerating] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [lessonResult, setLessonResult] = useState<GeneratedLessonPlan | null>(null);

  const handleGenerateLessonPlan = async () => {
    if (!lessonSubject.trim() || !lessonGrade.trim() || !lessonTopic.trim()) return;
    setLessonGenerating(true);
    setLessonError(null);
    try {
      const result = await generateLessonPlan({
        subject: lessonSubject,
        grade: lessonGrade,
        topic: lessonTopic,
        durationMinutes: lessonDuration,
        lessonType,
        language: lang,
      });
      setLessonResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setLessonError);
    } finally {
      setLessonGenerating(false);
    }
  };

  // ---- Module 6: School bureaucracy & documentation ----
  const [bureaucracyDocType, setBureaucracyDocType] = useState<BureaucracyDocumentType>('ACTIVITY_REPORT');
  const [bureaucracySubject, setBureaucracySubject] = useState('');
  const [bureaucracyGrade, setBureaucracyGrade] = useState('');
  const [bureaucracyKeyPoints, setBureaucracyKeyPoints] = useState('');
  const [bureaucracyGenerating, setBureaucracyGenerating] = useState(false);
  const [bureaucracyError, setBureaucracyError] = useState<string | null>(null);
  const [bureaucracyResult, setBureaucracyResult] = useState<GeneratedBureaucracyDoc | null>(null);

  const handleGenerateBureaucracyDoc = async () => {
    if (!bureaucracySubject.trim() || !bureaucracyGrade.trim() || !bureaucracyKeyPoints.trim()) return;
    setBureaucracyGenerating(true);
    setBureaucracyError(null);
    try {
      const result = await generateBureaucracyDoc({
        documentType: bureaucracyDocType,
        subject: bureaucracySubject,
        grade: bureaucracyGrade,
        keyPoints: bureaucracyKeyPoints,
        language: lang,
      });
      setBureaucracyResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setBureaucracyError);
    } finally {
      setBureaucracyGenerating(false);
    }
  };

  // ---- Module 7: Student reports & parent letters ----
  const [letterStudentName, setLetterStudentName] = useState('');
  const [letterGrade, setLetterGrade] = useState('');
  const [letterPurpose, setLetterPurpose] = useState<ParentLetterPurpose>('PRAISE');
  const [letterTeacherNotes, setLetterTeacherNotes] = useState('');
  const [letterGenerating, setLetterGenerating] = useState(false);
  const [letterError, setLetterError] = useState<string | null>(null);
  const [letterResult, setLetterResult] = useState<GeneratedParentLetter | null>(null);

  const handleGenerateParentLetter = async () => {
    if (!letterStudentName.trim() || !letterGrade.trim() || !letterTeacherNotes.trim()) return;
    setLetterGenerating(true);
    setLetterError(null);
    try {
      const result = await generateParentLetter({
        studentName: letterStudentName,
        grade: letterGrade,
        letterPurpose,
        teacherNotes: letterTeacherNotes,
        language: lang,
      });
      setLetterResult(result);
      refreshState();
    } catch (err) {
      handleModuleError(err, t('genericError'), setLetterError);
    } finally {
      setLetterGenerating(false);
    }
  };

  const hasAccess = hubState?.hasAccess ?? false;
  const usage = hubState?.usage;

  return (
    <ToolShell>
        <EducatorHubHeader
          t={t}
          hubState={hubState}
          stateLoading={stateLoading}
          stateError={stateError}
          hasAccess={hasAccess}
          trialStarting={trialStarting}
          handleStartTrial={handleStartTrial}
          lang={lang}
          refreshState={refreshState}
          trialError={trialError}
          usage={usage}
        />

        <ToolTabs
          ariaLabel={t('pageTitle')}
          tabs={REAL_TABS.map(({ id, icon }) => ({ key: id, icon, label: t(TAB_LABEL_KEY[id].key, TAB_LABEL_KEY[id].fallback) }))}
          active={tab}
          onChange={setTab}
        />

        {/* Module 8: Student Certificate & Diploma Builder (used to render
            above the page title; now sits with the other modules). */}
        {tab === 'certificates' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold mb-4">{t('certificatesTitle')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('certificatesDescription')}</p>
            <CertificateBuilder />
          </div>
        )}


        <TestGeneratorTab
          tab={tab}
          t={t}
          testSubject={testSubject}
          setTestSubject={setTestSubject}
          hasAccess={hasAccess}
          testGrade={testGrade}
          setTestGrade={setTestGrade}
          testTopic={testTopic}
          setTestTopic={setTestTopic}
          testSourceFile={testSourceFile}
          setTestSourceFile={setTestSourceFile}
          testSourceText={testSourceText}
          setTestSourceText={setTestSourceText}
          testTypes={testTypes}
          toggleTestType={toggleTestType}
          testDifficulty={testDifficulty}
          setTestDifficulty={setTestDifficulty}
          testCount={testCount}
          setTestCount={setTestCount}
          testGenerating={testGenerating}
          handleGenerateTest={handleGenerateTest}
          testError={testError}
          testResult={testResult}
          setTestResult={setTestResult}
          quizShareLink={quizShareLink}
          quizSharing={quizSharing}
          handleShareQuiz={handleShareQuiz}
          handleLoadSubmissions={handleLoadSubmissions}
          quizSubmissionsLoading={quizSubmissionsLoading}
          quizSubmissions={quizSubmissions}
          quizShareError={quizShareError}
        />

        <RubricTab
          tab={tab}
          t={t}
          rubricSubject={rubricSubject}
          setRubricSubject={setRubricSubject}
          hasAccess={hasAccess}
          rubricGrade={rubricGrade}
          setRubricGrade={setRubricGrade}
          rubricAssessmentType={rubricAssessmentType}
          setRubricAssessmentType={setRubricAssessmentType}
          rubricScale={rubricScale}
          setRubricScale={setRubricScale}
          rubricSkill={rubricSkill}
          setRubricSkill={setRubricSkill}
          rubricGenerating={rubricGenerating}
          handleGenerateRubric={handleGenerateRubric}
          rubricError={rubricError}
          rubricResult={rubricResult}
          setRubricResult={setRubricResult}
        />

        <GradingTab
          tab={tab}
          t={t}
          gradingPrompt={gradingPrompt}
          setGradingPrompt={setGradingPrompt}
          hasAccess={hasAccess}
          setWorkSource={setWorkSource}
          workSource={workSource}
          studentWorkText={studentWorkText}
          setStudentWorkText={setStudentWorkText}
          studentWorkImage={studentWorkImage}
          setStudentWorkImage={setStudentWorkImage}
          gradingScale={gradingScale}
          setGradingScale={setGradingScale}
          gradingInProgress={gradingInProgress}
          handleGradeHomework={handleGradeHomework}
          gradingError={gradingError}
          gradingResult={gradingResult}
          setGradingResult={setGradingResult}
        />

        <SenTab
          tab={tab}
          t={t}
          senSubject={senSubject}
          setSenSubject={setSenSubject}
          hasAccess={hasAccess}
          senGrade={senGrade}
          setSenGrade={setSenGrade}
          senTopic={senTopic}
          setSenTopic={setSenTopic}
          senAdaptations={senAdaptations}
          setSenAdaptations={setSenAdaptations}
          senGenerating={senGenerating}
          handleGenerateSen={handleGenerateSen}
          senError={senError}
          senResult={senResult}
          setSenResult={setSenResult}
        />
        <LessonPlanTab
          tab={tab}
          t={t}
          lessonSubject={lessonSubject}
          setLessonSubject={setLessonSubject}
          hasAccess={hasAccess}
          lessonGrade={lessonGrade}
          setLessonGrade={setLessonGrade}
          lessonTopic={lessonTopic}
          setLessonTopic={setLessonTopic}
          lessonDuration={lessonDuration}
          setLessonDuration={setLessonDuration}
          lessonType={lessonType}
          setLessonType={setLessonType}
          lessonGenerating={lessonGenerating}
          handleGenerateLessonPlan={handleGenerateLessonPlan}
          lessonError={lessonError}
          lessonResult={lessonResult}
          setLessonResult={setLessonResult}
        />
        <BureaucracyTab
          tab={tab}
          t={t}
          bureaucracyDocType={bureaucracyDocType}
          setBureaucracyDocType={setBureaucracyDocType}
          hasAccess={hasAccess}
          bureaucracySubject={bureaucracySubject}
          setBureaucracySubject={setBureaucracySubject}
          bureaucracyGrade={bureaucracyGrade}
          setBureaucracyGrade={setBureaucracyGrade}
          bureaucracyKeyPoints={bureaucracyKeyPoints}
          setBureaucracyKeyPoints={setBureaucracyKeyPoints}
          bureaucracyGenerating={bureaucracyGenerating}
          handleGenerateBureaucracyDoc={handleGenerateBureaucracyDoc}
          bureaucracyError={bureaucracyError}
          bureaucracyResult={bureaucracyResult}
          setBureaucracyResult={setBureaucracyResult}
        />
        <ParentReportsTab
          tab={tab}
          t={t}
          letterStudentName={letterStudentName}
          setLetterStudentName={setLetterStudentName}
          hasAccess={hasAccess}
          letterGrade={letterGrade}
          setLetterGrade={setLetterGrade}
          letterPurpose={letterPurpose}
          setLetterPurpose={setLetterPurpose}
          letterTeacherNotes={letterTeacherNotes}
          setLetterTeacherNotes={setLetterTeacherNotes}
          letterGenerating={letterGenerating}
          handleGenerateParentLetter={handleGenerateParentLetter}
          letterError={letterError}
          letterResult={letterResult}
          setLetterResult={setLetterResult}
        />

      {/* Print mode: only the active module's #print-<tab> subtree stays
          visible — everything else (nav, forms, other tabs, buttons) is
          marked no-print or lives outside #print-<tab> entirely. The target
          id is written to document.body's data attribute by ExportBar's
          handlePrint right before window.print() fires. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          body[data-print-target='print-test'] #print-test,
          body[data-print-target='print-test'] #print-test *,
          body[data-print-target='print-rubric'] #print-rubric,
          body[data-print-target='print-rubric'] #print-rubric *,
          body[data-print-target='print-grading'] #print-grading,
          body[data-print-target='print-grading'] #print-grading *,
          body[data-print-target='print-sen'] #print-sen,
          body[data-print-target='print-sen'] #print-sen *,
          body[data-print-target='print-lesson'] #print-lesson,
          body[data-print-target='print-lesson'] #print-lesson *,
          body[data-print-target='print-bureaucracy'] #print-bureaucracy,
          body[data-print-target='print-bureaucracy'] #print-bureaucracy *,
          body[data-print-target='print-letter'] #print-letter,
          body[data-print-target='print-letter'] #print-letter * {
            visibility: visible;
          }
          #print-test,
          #print-rubric,
          #print-grading,
          #print-sen,
          #print-lesson,
          #print-bureaucracy,
          #print-letter {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </ToolShell>
  );
}

export default function EducatorHubPage() {
  const { t } = useTranslation('educatorHub');
  return (
    <>
      {/* Rendered above ProtectedRoute — see english-tutor/index.tsx's
          identical comment for why: an unauthenticated crawler never
          renders EducatorHubContent at all. */}
      <SEOHead title={t('pageTitle', 'AI მასწავლებლის VIP ასისტენტი')} description={t('pageSubtitle', 'AI ხელსაწყოები თქვენი ყოველკვირეული დავალებებისთვის')} noIndex />
      <ProtectedRoute>
        <ToolErrorBoundary>
          <EducatorHubContent />
        </ToolErrorBoundary>
      </ProtectedRoute>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'educatorHub'])) },
});
