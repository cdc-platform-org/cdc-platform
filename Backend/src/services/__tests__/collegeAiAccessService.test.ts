// Unit tests for the course -> AI tools rule (collegeAiAccessService.ts):
// only tools listed on an unfinished, paid course are free, within 90 days.
import { prisma } from '../../lib/prisma';
import { getCollegeAiAccessStatus, hasCourseToolAccess, COLLEGE_AI_ACCESS_DAYS } from '../learning/collegeAiAccessService';

jest.mock('../../lib/prisma', () => ({ prisma: { courseEnrollment: { findMany: jest.fn() } } }));
const findMany = jest.mocked(prisma.courseEnrollment.findMany);
const DAY = 86_400_000;
const lesson = (completed: boolean) => ({ progress: completed ? [{ id: 'progress' }] : [] });
const enrollment = (completed: boolean[], exam: boolean | null = false, certified = false, opts: { grantedDaysAgo?: number; tools?: string[] } = {}) => ({
  grantedAt: new Date(Date.now() - (opts.grantedDaysAgo ?? 1) * DAY),
  course: {
    aiToolKeys: opts.tools ?? ['media-studio'],
    sections: [{ lessons: completed.map(lesson) }],
    exam: exam === null ? null : { attempts: exam ? [{ id: 'passed-attempt' }] : [] },
    certificates: certified ? [{ id: 'certificate' }] : [],
  },
});
function rows(value: ReturnType<typeof enrollment>[]) { findMany.mockResolvedValue(value as never); }
const has = () => hasCourseToolAccess('student', 'media-studio');
beforeEach(() => jest.clearAllMocks());

test('no enrollment and courses without lessons do not grant AI access', async () => {
  rows([]); expect(await has()).toBe(false);
  rows([enrollment([])]); expect(await has()).toBe(false);
});
test('an enrolled learner keeps access while lectures or the final exam remain', async () => {
  rows([enrollment([false, true])]); expect(await has()).toBe(true);
  rows([enrollment([true, true])]); expect(await has()).toBe(true);
});
test('passing the final exam ends the course benefit on the next request', async () => {
  rows([enrollment([true])]); expect(await has()).toBe(true);
  rows([enrollment([true], true)]); expect(await has()).toBe(false);
});
test('unchecking a lesson after a passed exam cannot restore free AI access', async () => {
  rows([enrollment([false], true)]); expect(await has()).toBe(false);
});
test('a course certificate remains terminal and courses without exams follow lesson completion', async () => {
  rows([enrollment([false], null, true)]); expect(await has()).toBe(false);
  rows([enrollment([true], null)]); expect(await has()).toBe(false);
  rows([enrollment([false], null)]); expect(await has()).toBe(true);
});
test('another unfinished enrolled course keeps the benefit active', async () => {
  rows([enrollment([true], true), enrollment([false])]); expect(await has()).toBe(true);
});
test('access ends when the 90-day window since enrollment has passed', async () => {
  rows([enrollment([false], false, false, { grantedDaysAgo: COLLEGE_AI_ACCESS_DAYS + 1 })]); expect(await has()).toBe(false);
});
test('the query only counts paid published courses that list the requested tool', async () => {
  rows([]); await hasCourseToolAccess('student-a', 'english-tutor');
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { userId: 'student-a', course: { status: 'PUBLISHED', originalPrice: { gt: 0 }, aiToolKeys: { has: 'english-tutor' } } },
    select: expect.objectContaining({ course: { select: expect.objectContaining({
      exam: { select: { attempts: { where: { userId: 'student-a', passed: true }, select: { id: true }, take: 1 } } },
    }) } }),
  }));
});
test('the status lists every tool included by the active courses', async () => {
  rows([enrollment([false], false, false, { tools: ['design-studio', 'media-studio'] }), enrollment([true], true, false, { tools: ['code-studio'] })]);
  const status = await getCollegeAiAccessStatus('student');
  expect(status.active).toBe(true);
  expect(status.includedToolKeys.sort()).toEqual(['design-studio', 'media-studio']);
});
