import { prisma } from '../../lib/prisma';
import { hasActiveCollegeAiAccess } from '../learning/collegeAiAccessService';

jest.mock('../../lib/prisma', () => ({ prisma: { courseEnrollment: { findMany: jest.fn() } } }));
const findMany = jest.mocked(prisma.courseEnrollment.findMany);
const lesson = (completed: boolean) => ({ progress: completed ? [{ id: 'progress' }] : [] });
const enrollment = (completed: boolean[], exam: boolean | null = false, certified = false) => ({ course: {
  sections: [{ lessons: completed.map(lesson) }],
  exam: exam === null ? null : { attempts: exam ? [{ id: 'passed-attempt' }] : [] },
  certificates: certified ? [{ id: 'certificate' }] : [],
} });
function rows(value: ReturnType<typeof enrollment>[]) { findMany.mockResolvedValue(value as never); }
beforeEach(() => jest.clearAllMocks());

test('no enrollment and courses without lessons do not grant AI access', async () => {
  rows([]); expect(await hasActiveCollegeAiAccess('student')).toBe(false);
  rows([enrollment([])]); expect(await hasActiveCollegeAiAccess('student')).toBe(false);
});
test('an enrolled learner keeps access while lectures or the final exam remain', async () => {
  rows([enrollment([false, true])]); expect(await hasActiveCollegeAiAccess('student')).toBe(true);
  rows([enrollment([true, true])]); expect(await hasActiveCollegeAiAccess('student')).toBe(true);
});
test('passing the final exam ends the college benefit on the next request', async () => {
  rows([enrollment([true])]); expect(await hasActiveCollegeAiAccess('student')).toBe(true);
  rows([enrollment([true], true)]); expect(await hasActiveCollegeAiAccess('student')).toBe(false);
});
test('unchecking a lesson after a passed exam cannot restore free AI access', async () => {
  rows([enrollment([false], true)]); expect(await hasActiveCollegeAiAccess('student')).toBe(false);
});
test('a course certificate remains terminal and courses without exams follow lesson completion', async () => {
  rows([enrollment([false], null, true)]); expect(await hasActiveCollegeAiAccess('student')).toBe(false);
  rows([enrollment([true], null)]); expect(await hasActiveCollegeAiAccess('student')).toBe(false);
  rows([enrollment([false], null)]); expect(await hasActiveCollegeAiAccess('student')).toBe(true);
});
test('another unfinished enrolled course keeps the college benefit active', async () => {
  rows([enrollment([true], true), enrollment([false])]); expect(await hasActiveCollegeAiAccess('student')).toBe(true);
});
test('the database query scopes both progress and exam results to this learner', async () => {
  rows([]); await hasActiveCollegeAiAccess('student-a');
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { userId: 'student-a', course: { status: 'PUBLISHED' } },
    select: { course: { select: expect.objectContaining({
      exam: { select: { attempts: { where: { userId: 'student-a', passed: true }, select: { id: true }, take: 1 } } },
    }) } },
  }));
});
