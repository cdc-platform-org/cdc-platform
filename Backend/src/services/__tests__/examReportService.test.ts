import { PDFDocument } from 'pdf-lib';
import { generateExamReportPdf } from '../examReportService';

// 2026-11-10: the old report stopped after one page (~11 questions). Every
// question must now be included, in Georgian or English labels.
function makeData(questionCount: number) {
  const questions = Array.from({ length: questionCount }, (_, i) => ({
    id: `q${i}`,
    examSessionId: 's',
    order: i,
    type: i === questionCount - 1 ? 'CODE' : 'MCQ',
    question: `კითხვა ${i + 1}: რომელი თეგი გამოიყენება ცხრილში სათაურის უჯრის შესაქმნელად? <th> თუ <td>?`,
    options: i === questionCount - 1 ? null : { A: '<td>', B: '<th>', C: '<tr>', D: 'დაუნომრავი სია' },
    correctAnswer: i === questionCount - 1 ? 'rubric' : 'B',
    explanation: '<th> ქმნის სათაურის უჯრას.',
  }));
  const answers: Record<string, string> = {};
  questions.forEach((q, i) => (answers[q.id] = q.type === 'MCQ' ? (i % 2 ? 'B' : 'A') : '<ul>\n  <li>ერთი</li>\n</ul>'));
  const submission = {
    id: 'sub',
    candidateName: 'ქეთი ართმელაძე',
    candidateEmail: 'student@example.com',
    status: 'COMPLETED',
    startedAt: new Date('2026-11-10T06:26:00Z'),
    completedAt: new Date('2026-11-10T06:37:00Z'),
    totalScore: 50,
    mcqScore: 50,
    practicalScore: 40,
    integrityScore: 90,
    tabSwitches: 1,
    copyPasteCount: 0,
    cameraAudioViolations: 3,
    aiTextScore: null,
    answers,
    answerGrades: [{ questionId: `q${questionCount - 1}`, questionType: 'CODE', question: '', candidateAnswer: '', aiScore: 40, aiFeedback: 'კარგია, მაგრამ აკლია ბმული.', aiTextScore: null }],
  };
  const session = { title: 'HTML თეგები', topic: 'ვებ დეველოპმენტი' };
  return { questions, submission, session };
}

describe('generateExamReportPdf', () => {
  it.each(['ka', 'en'] as const)('renders every question across pages (%s)', async (lang) => {
    const { questions, submission, session } = makeData(30);
    const pdf = await generateExamReportPdf({ session: session as any, submission: submission as any, questions: questions as any, lang });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
