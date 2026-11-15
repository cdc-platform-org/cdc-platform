import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

function buildPassportCode(userId: string): string {
  return `CDC-PASS-${userId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function resolveUserIdFromCode(code: string): string {
  return code.replace(/^CDC-PASS-/i, '').toLowerCase();
}

// 1. 4-Pillar Pre-Exam Readiness Dossier (25% AI + 25% Attendance + 25% Assignments + 25% Lecturer = 100%)
router.get('/readiness/:courseId', authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { courseId } = req.params;

  const [course, lessons, progressRows, submissions, existing] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, titleEn: true, category: true, skillsTaught: true } }),
    prisma.courseLesson.findMany({ where: { section: { courseId } }, select: { id: true, assignmentPrompt: true } }),
    prisma.lessonProgress.findMany({ where: { userId, lesson: { section: { courseId } }, completed: true } }),
    prisma.assignmentSubmission.findMany({ where: { userId, lesson: { section: { courseId } } } }),
    prisma.courseReadinessRecord.findUnique({ where: { userId_courseId: { userId, courseId } } }),
  ]);

  if (!course) return res.status(404).json({ message: 'Course not found' });

  const totalLessons = Math.max(1, lessons.length);
  const attendanceScore = Math.min(100, Math.round((progressRows.length / totalLessons) * 100));

  const assignmentLessons = lessons.filter((l) => !!l.assignmentPrompt);
  const validSubs = submissions.filter((s) => s.status !== 'NEEDS_REVISION');
  const assignmentsScore =
    assignmentLessons.length === 0
      ? 100
      : Math.min(100, Math.round((validSubs.length / assignmentLessons.length) * 100));

  const aiMentorScore = existing?.aiMentorScore ?? Math.min(100, Math.round((attendanceScore * 0.4 + assignmentsScore * 0.6)));
  const lecturerScore = existing?.lecturerScore ?? aiMentorScore;

  const totalScore = Math.round((aiMentorScore + attendanceScore + assignmentsScore + lecturerScore) / 4);
  const eligibleForExam = totalScore >= 90;

  const record = await prisma.courseReadinessRecord.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { attendanceScore, assignmentsScore, aiMentorScore, lecturerScore, totalScore },
    create: {
      userId,
      courseId,
      aiMentorScore,
      attendanceScore,
      assignmentsScore,
      lecturerScore,
      totalScore,
      aiCritique:
        totalScore >= 90
          ? 'სტუდენტმა წარმატებით დაასრულა პრაქტიკული დავალებები და აკმაყოფილებს გამოცდაზე დაშვების 90%-იან სტანდარტს.'
          : 'საჭიროა დარჩენილი პრაქტიკული დავალებების სრულყოფა და მასალის გამეორება 90%-იანი ზღვრის გადასალახად.',
      lecturerName: 'CDC AI & Faculty Board',
    },
  });

  return res.json({
    record,
    eligibleForExam,
    threshold: 90,
    courseTitle: course.title,
  });
});

// 2. Lecturer / Trainer updates their 25% evaluation score & note
router.post('/readiness/:courseId/lecturer-grade', authenticate, async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const { studentId, lecturerScore, lecturerNote, lecturerName } = req.body as {
    studentId: string;
    lecturerScore: number;
    lecturerNote?: string;
    lecturerName?: string;
  };

  if (!studentId || typeof lecturerScore !== 'number') {
    return res.status(400).json({ message: 'studentId and lecturerScore are required' });
  }

  const clamped = Math.max(0, Math.min(100, Math.round(lecturerScore)));
  const existing = await prisma.courseReadinessRecord.findUnique({
    where: { userId_courseId: { userId: studentId, courseId } },
  });

  const aiMentorScore = existing?.aiMentorScore ?? 90;
  const attendanceScore = existing?.attendanceScore ?? 90;
  const assignmentsScore = existing?.assignmentsScore ?? 90;
  const totalScore = Math.round((aiMentorScore + attendanceScore + assignmentsScore + clamped) / 4);

  const updated = await prisma.courseReadinessRecord.upsert({
    where: { userId_courseId: { userId: studentId, courseId } },
    update: {
      lecturerScore: clamped,
      lecturerNote: lecturerNote ?? existing?.lecturerNote,
      lecturerName: lecturerName ?? req.user?.email ?? 'CDC Lecturer',
      totalScore,
    },
    create: {
      userId: studentId,
      courseId,
      aiMentorScore,
      attendanceScore,
      assignmentsScore,
      lecturerScore: clamped,
      lecturerNote,
      lecturerName: lecturerName ?? req.user?.email ?? 'CDC Lecturer',
      totalScore,
    },
  });

  return res.json({ record: updated, eligibleForExam: totalScore >= 90 });
});

async function assemblePassportPayload(userId: string) {
  const [user, records, enrollments, certificates] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isVerifiedGraduate: true, createdAt: true },
    }),
    prisma.courseReadinessRecord.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, titleEn: true, category: true, skillsTaught: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.liveTrainingEnrollment.findMany({
      where: { userId },
      include: { liveTraining: { select: { id: true, title: true, titleEn: true, category: true, scheduledAt: true } } },
      orderBy: { enrolledAt: 'desc' },
    }),
    prisma.certificate.findMany({
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
        records.length > 0 ? Math.round(records.reduce((acc, r) => acc + r.totalScore, 0) / records.length) : 0,
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
      code: c.certificateNumber,
      courseTitle: c.course.title,
      issuedAt: c.issuedAt,
    })),
  };
}

// 3. Authenticated student's own Digital Passport
router.get('/passport/me', authenticate, async (req: Request, res: Response) => {
  const payload = await assemblePassportPayload(req.user!.id);
  if (!payload) return res.status(404).json({ message: 'Student not found' });
  return res.json(payload);
});

// 4. Public verification endpoint when scanning the student's QR code
router.get('/passport/public/:code', async (req: Request, res: Response) => {
  const prefix = resolveUserIdFromCode(req.params.code);
  if (prefix.length < 8) return res.status(400).json({ message: 'Invalid passport code' });

  const users = await prisma.user.findMany({
    where: { id: { startsWith: prefix } },
    select: { id: true },
    take: 1,
  });

  if (users.length === 0) return res.status(404).json({ message: 'Digital Passport not found' });
  const payload = await assemblePassportPayload(users[0].id);
  return res.json(payload);
});

export default router;