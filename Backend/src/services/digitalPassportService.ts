/**
 * @fileoverview Student Digital Skill Passport & Public QR Verification Service.
 * Aggregates a student's verified courses, 4-pillar readiness records, live cohort
 * attendance, certificates, and skills into a portable digital credential.
 */

import { prisma } from '../lib/prisma';

export function buildPassportCode(userId: string): string {
  return `CDC-PASS-${userId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export function resolveUserIdPrefixFromCode(code: string): string {
  return code.replace(/^CDC-PASS-/i, '').toLowerCase();
}

export async function getStudentDigitalPassport(userId: string) {
  const [user, records, enrollments, certificates] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
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

  const skills = Array.from(
    new Set([
      ...records.flatMap((r) => r.course.skillsTaught ?? []),
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
      liveTrainingsAttended: enrollments.length,
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
  if (prefix.length < 8) return null;

  const users = await prisma.user.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
    take: 1,
  });

  if (users.length === 0) return null;
  return getStudentDigitalPassport(users[0].id);
}