/**
 * @fileoverview Student Digital Skill Passport & Public QR Verification Service.
 * Aggregates a student's verified courses, 4-pillar readiness records, live cohort
 * attendance, certificates, and skills into a portable digital credential.
 */

import { prisma } from '../lib/prisma';
import { getOrSyncCourseReadiness } from './readinessScoringService';

export function buildPassportCode(userId: string): string {
  return `CDC-PASS-${userId.replace(/-/g, '').toUpperCase()}`;
}

export function resolveUserIdPrefixFromCode(code: string): string {
  return code.replace(/^CDC-PASS-/i, '').toLowerCase();
}

export async function getStudentDigitalPassport(userId: string) {
  const [user, storedRecords, enrollments, certificates] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        isVerifiedGraduate: true,
        createdAt: true,
      },
    }),
    prisma.courseReadinessRecord.findMany({
      where: { userId },
      include: {
        course: {
          select: { id: true, title: true, titleEn: true, category: true, skillsTaught: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.liveTrainingEnrollment.findMany({
      where: { userId },
      include: {
        liveTraining: {
          select: { id: true, title: true, titleEn: true, category: true, scheduledAt: true },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    }),
    prisma.courseCertificate.findMany({
      where: { userId },
      include: { course: { select: { title: true, titleEn: true, skillsTaught: true } } },
      orderBy: { issuedAt: 'desc' },
    }),
  ]);

  if (!user) return null;
  const records = await Promise.all(storedRecords.map(async (record) => ({
    ...record, ...(await getOrSyncCourseReadiness(userId, record.courseId))?.record,
  })));

  const skills = Array.from(
    new Set([
      ...certificates.flatMap((c) => c.course.skillsTaught ?? []),
    ])
  );

  return {
    passportCode: buildPassportCode(user.id),
    student: {
      name: user.name,
      role: user.role,
      isVerifiedGraduate: user.isVerifiedGraduate,
      memberSince: user.createdAt,
    },
    stats: {
      coursesEvaluated: records.length,
      liveTrainingsAttended: enrollments.filter((e) => e.status === 'COMPLETED').length,
      certificatesIssued: certificates.length,
      averageReadiness:
        records.length > 0
          ? Math.round(records.reduce((acc, r) => acc + r.totalScore, 0) / records.length)
          : 0,
    },
    skills,
    courseHistory: records.map((r) => ({
      id: r.id,
      courseTitle: r.course.title,
      courseTitleEn: r.course.titleEn,
      category: r.course.category,
      mentorOrLecturer: r.lecturerName || 'CDC AI & Faculty Board',
      evaluatedAt: r.evaluatedAt,
      totalScore: r.totalScore,
      breakdown: {
        aiMentor: r.aiMentorScore,
        attendance: r.attendanceScore,
        assignments: r.assignmentsScore,
        lecturer: r.lecturerScore,
      },
      passedThreshold: r.totalScore >= 90,
    })),
    liveTrainingHistory: enrollments.map((e) => ({
      id: e.id,
      title: e.liveTraining.title,
      titleEn: e.liveTraining.titleEn,
      category: e.liveTraining.category,
      status: e.status,
      date: e.completedAt || e.enrolledAt,
    })),
    certificates: certificates.map((c) => ({
      id: c.id,
      code: c.verificationCode,
      courseTitle: c.course.title,
      issuedAt: c.issuedAt,
    })),
  };
}

export async function getPublicDigitalPassportByCode(code: string) {
  const prefix = resolveUserIdPrefixFromCode(code);
  // Support legacy ten-hex links, but never guess between matching users.
  if (!/^CDC-PASS-(?:[0-9a-f]{10}|[0-9a-f]{32})$/i.test(code)) return null;
  const uuidPrefix = prefix.length === 32
    ? `${prefix.slice(0, 8)}-${prefix.slice(8, 12)}-${prefix.slice(12, 16)}-${prefix.slice(16, 20)}-${prefix.slice(20)}`
    : `${prefix.slice(0, 8)}-${prefix.slice(8)}`;

  const users = await prisma.user.findMany({
    where: { id: { startsWith: uuidPrefix }, isBanned: false, deletionRequestedAt: null },
    select: { id: true },
    take: 2,
  });

  if (users.length !== 1) return null;
  return getStudentDigitalPassport(users[0].id);
}
