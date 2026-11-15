import { prisma } from '../../lib/prisma';
import { createUser, createCourse } from '../../test/factories';
import { hasActiveCollegeAiAccess } from '../learning/collegeAiAccessService';
import { hasDigitalToolAccess } from '../marketplace/digitalToolAccessService';

let studentId: string;
let courseId: string;
afterAll(async () => {
  if (studentId) {
    await prisma.lessonProgress.deleteMany({ where: { userId: studentId } });
    await prisma.examAttempt.deleteMany({ where: { userId: studentId } });
    await prisma.courseEnrollment.deleteMany({ where: { userId: studentId } });
  }
  if (courseId) await prisma.course.delete({ where: { id: courseId } });
  if (studentId) await prisma.user.delete({ where: { id: studentId } });
  await prisma.$disconnect();
});

test('real enrollment grants tool access through the final exam, then revokes it immediately', async () => {
  const student = await createUser({ role: 'Student' }); studentId = student.id;
  const course = await createCourse({}); courseId = course.id;
  const section = await prisma.courseSection.create({ data: { courseId, title: 'Core skills', order: 0 } });
  const lesson = await prisma.lesson.create({ data: { sectionId: section.id, title: 'Foundations', order: 0 } });
  const exam = await prisma.exam.create({ data: { courseId } });
  expect(await hasActiveCollegeAiAccess(studentId)).toBe(false);
  await prisma.courseEnrollment.create({ data: { userId: studentId, courseId } });
  expect(await hasDigitalToolAccess(studentId, student.email, 'media-studio')).toBe(true);
  await prisma.lessonProgress.create({ data: { userId: studentId, lessonId: lesson.id, completed: true, completedAt: new Date() } });
  expect(await hasActiveCollegeAiAccess(studentId)).toBe(true);
  await prisma.examAttempt.create({ data: { userId: studentId, examId: exam.id, score: 100, passed: true, questions: [] } });
  expect(await hasActiveCollegeAiAccess(studentId)).toBe(false);
  expect(await hasDigitalToolAccess(studentId, student.email, 'media-studio')).toBe(false);
  await prisma.lessonProgress.update({ where: { userId_lessonId: { userId: studentId, lessonId: lesson.id } }, data: { completed: false } });
  expect(await hasActiveCollegeAiAccess(studentId)).toBe(false);
});
