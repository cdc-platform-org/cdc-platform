/**
 * AI course exam (configure, start, submit) and certificates: issue on
 * completion, public verification by code and PDF download.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole } from '../../middleware/auth';
import { examSettingsSchema, examSubmitSchema } from '../../schemas/courseSchemas';
import {
  generateCertificatePdf,
  generateVerificationCode,
  CertificateTemplateMissingError,
} from '../../services/learning/certificateService';
import {
  generateExamQuestions,
  isAiExamConfigured,
  AiExamGenerationError,
  GeneratedQuestion,
} from '../../services/exams/aiExamService';
import { createExamSessionToken, verifyExamSessionToken, ExamSessionError } from '../../services/exams/examSessionService';
import { logAdminAction } from '../../services/account/auditLogService';
import { requireCourseAccess } from './shared';

const router = Router();

// ---- AI Exam & Certification Gate ----
// One Exam per course (admin-configured via PUT below). Questions are
// generated fresh on every /exam/start call (never persisted ahead of
// time) and scored server-side via an encrypted, signed session token —
// see services/examSessionService.ts for why a plain JWT isn't enough on
// its own. Courses with an Exam configured require a passed ExamAttempt to
// download a certificate; courses without one keep the old 100%-lessons gate.

const EXAM_MIN_DURATION_MINUTES = 10;

function examDurationMinutes(questionCount: number): number {
  return Math.max(EXAM_MIN_DURATION_MINUTES, Math.ceil(questionCount * 1.5));
}

function toStudentQuestion(q: GeneratedQuestion) {
  return { id: q.id, topic: q.topic, question: q.question, options: q.options };
}

async function getCourseCompletion(courseId: string, userId: string) {
  const totalLessons = await prisma.lesson.count({ where: { section: { courseId } } });
  const completedLessons = await prisma.lessonProgress.count({
    where: { completed: true, userId, lesson: { section: { courseId } } },
  });
  return totalLessons > 0 && completedLessons >= totalLessons;
}

// Find-or-create — repeated calls (a re-download, or the auto-grant on exam
// pass followed later by an explicit download) always return the same
// verificationCode/issuedAt rather than minting a new "unique" certificate
// every time.
async function getOrCreateCertificate(userId: string, courseId: string) {
  const existing = await prisma.courseCertificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) return existing;
  let certificate;
  try {
    certificate = await prisma.courseCertificate.create({
      data: { userId, courseId, verificationCode: generateVerificationCode(new Date()) },
    });
  } catch (err: any) {
    // The findUnique above found nothing, but the exam-pass auto-issue path
    // and an explicit GET /:id/certificate download can race here — a
    // concurrent call already won and inserted the row first. Return that
    // one instead of throwing, and skip autoVerifySkillsForCourse below:
    // the winning call already ran it for this exact (userId, courseId)
    // pair, and it's not safe to call twice (see its own "fires exactly
    // once" comment).
    if (err.code === 'P2002') {
      return prisma.courseCertificate.findUniqueOrThrow({ where: { userId_courseId: { userId, courseId } } });
    }
    throw err;
  }
  // Fires exactly once, on first-ever certificate issuance for this
  // (userId, courseId) pair — never on a later re-fetch of an already-issued
  // certificate. Covers both certificate paths: the exam-pass auto-issue
  // above and the 100%-lessons-complete GET /:id/certificate path below,
  // since both funnel through this same helper.
  await autoVerifySkillsForCourse(userId, courseId);
  return certificate;
}

// Auto-verifies every skill in Course.skillsTaught for a student who just
// earned that course's certificate — no AI test needed, per spec. Also adds
// those skills to the student's own declared freelancerSkills list (deduped)
// so their profile keeps up with what they've actually earned, even if they
// never explicitly picked that skill at registration. Never downgrades an
// existing VerifiedSkill (e.g. one already earned via the AI test, with its
// own score) — the upsert's `update: {}` is a deliberate no-op, since the
// skill is verified either way and course-completion carries no score to
// overwrite it with.
async function autoVerifySkillsForCourse(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { skillsTaught: true } });
  if (!course?.skillsTaught.length) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { freelancerSkills: true } });
  const mergedSkills = Array.from(new Set([...(user?.freelancerSkills ?? []), ...course.skillsTaught]));

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { freelancerSkills: mergedSkills } }),
    ...course.skillsTaught.map((skillName) =>
      prisma.verifiedSkill.upsert({
        where: { userId_skillName: { userId, skillName } },
        update: {},
        create: { userId, skillName, verifiedVia: 'COURSE_COMPLETION', courseId },
      })
    ),
  ]);
}

// Admin: view a course's exam settings (null if none configured yet).
router.get('/:id/exam', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const exam = await prisma.exam.findUnique({ where: { courseId: req.params.id } });
  res.json({ data: exam });
});

// Admin: create or update a course's exam settings.
router.put('/:id/exam', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = examSettingsSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const course = await prisma.course.findUnique({ where: { id: req.params.id } });
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const exam = await prisma.exam.upsert({
    where: { courseId: req.params.id },
    update: result.data,
    create: { ...result.data, courseId: req.params.id },
  });
  res.json({ data: exam });
});

// Student: whether an exam exists for this course, whether they can (re)take
// it right now, and their best result so far.
router.get('/:id/exam/status', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const exam = await prisma.exam.findUnique({ where: { courseId } });
  if (!exam) return res.json({ data: { configured: false } });

  const courseComplete = await getCourseCompletion(courseId, req.user!.id);
  const [passedAttempt, lastAttempt] = await Promise.all([
    prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id, passed: true }, orderBy: { completedAt: 'desc' } }),
    prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id }, orderBy: { completedAt: 'desc' } }),
  ]);

  // completedAt is non-nullable in the schema (every ExamAttempt is only
  // ever created already-scored), but `?.` here costs nothing and means a
  // row written by some future/manual path that doesn't hold that
  // invariant degrades to "no cooldown" instead of 500ing this endpoint.
  const cooldownEndsAt =
    lastAttempt && !passedAttempt && lastAttempt.completedAt
      ? new Date(lastAttempt.completedAt.getTime() + exam.cooldownHours * 60 * 60 * 1000)
      : null;
  const inCooldown = !!cooldownEndsAt && cooldownEndsAt.getTime() > Date.now();

  res.json({
    data: {
      configured: true,
      passingScore: exam.passingScore,
      cooldownHours: exam.cooldownHours,
      questionCount: exam.questionCount,
      courseComplete,
      passed: !!passedAttempt,
      bestScore: passedAttempt?.score ?? lastAttempt?.score ?? null,
      lastAttemptAt: lastAttempt?.completedAt ?? null,
      weakTopics: !passedAttempt ? lastAttempt?.weakTopics ?? [] : [],
      inCooldown,
      cooldownEndsAt,
      canStart: courseComplete && !passedAttempt && !inCooldown,
    },
  });
});

router.post('/:id/exam/start', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  if (!isAiExamConfigured()) {
    return res.status(501).json({ message: 'AI exam generation is not configured yet (GEMINI_API_KEY).' });
  }

  const [course, exam] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.exam.findUnique({ where: { courseId } }),
  ]);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  if (!exam) return res.status(404).json({ message: 'This course does not have a certification exam configured.' });

  if (!(await getCourseCompletion(courseId, req.user!.id))) {
    return res.status(400).json({ message: 'Complete 100% of the course lessons before taking the exam.' });
  }

  const [passedAttempt, lastAttempt] = await Promise.all([
    prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id, passed: true } }),
    prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id }, orderBy: { completedAt: 'desc' } }),
  ]);
  if (passedAttempt) {
    return res.status(400).json({ message: 'You have already passed this exam.' });
  }
  if (lastAttempt) {
    const cooldownEndsAt = new Date(lastAttempt.completedAt.getTime() + exam.cooldownHours * 60 * 60 * 1000);
    if (cooldownEndsAt.getTime() > Date.now()) {
      return res.status(429).json({ message: 'You are on a retake cooldown.', cooldownEndsAt });
    }
  }

  const lessonTitles = (await prisma.lesson.findMany({ where: { section: { courseId } }, select: { title: true } })).map(
    (l) => l.title
  );

  const requestedLang = req.body?.lang === 'ka' ? 'ka' : req.body?.lang === 'en' ? 'en' : undefined;

  let questions: GeneratedQuestion[];
  try {
    questions = await generateExamQuestions({
      courseTitle: course.title,
      courseDescription: course.description,
      lessonTitles,
      questionCount: exam.questionCount,
      aiPromptContext: exam.aiPromptContext,
      focusTopics: lastAttempt?.weakTopics.length ? lastAttempt.weakTopics : undefined,
      lang: requestedLang,
    });
  } catch (err) {
    if (err instanceof AiExamGenerationError) {
      return res.status(502).json({ message: err.message });
    }
    throw err;
  }

  const durationMinutes = examDurationMinutes(exam.questionCount);
  const sessionToken = createExamSessionToken({ userId: req.user!.id, courseId, examId: exam.id, questions, durationMinutes });

  res.json({
    data: { sessionToken, durationMinutes, passingScore: exam.passingScore, questions: questions.map(toStudentQuestion) },
  });
});

router.post('/:id/exam/submit', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const result = examSubmitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  let session;
  try {
    session = verifyExamSessionToken(result.data.sessionToken);
  } catch (err) {
    return res.status(400).json({ message: err instanceof ExamSessionError ? err.message : 'Invalid exam session.' });
  }
  if (session.userId !== req.user!.id || session.courseId !== courseId) {
    return res.status(400).json({ message: 'This exam session does not belong to you.' });
  }

  const exam = await prisma.exam.findUnique({ where: { id: session.examId } });
  if (!exam || exam.courseId !== courseId) {
    return res.status(404).json({ message: 'Exam not found.' });
  }

  const total = session.questions.length;
  let correctCount = 0;
  const wrongTopics: string[] = [];
  const review = session.questions.map((q) => {
    const selected = result.data.answers[q.id];
    const correct = selected === q.correctAnswer;
    if (correct) correctCount += 1;
    else wrongTopics.push(q.topic);
    return {
      id: q.id,
      topic: q.topic,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      selected: selected ?? null,
      correct,
      explanation: q.explanation,
    };
  });

  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  const passed = score >= exam.passingScore;
  const weakTopics = Array.from(new Set(wrongTopics));

  await prisma.examAttempt.create({
    data: { userId: req.user!.id, examId: exam.id, score, passed, questions: review, weakTopics },
  });

  const cooldownEndsAt = passed ? null : new Date(Date.now() + exam.cooldownHours * 60 * 60 * 1000);

  // Passing a certification exam is the automatic CDC Alumni gate — instantly
  // grants isVerifiedGraduate (unlimited forum posts/applications, the
  // glowing badge, the mentorship button) and mints the certificate record
  // right away, rather than waiting for the student to click "Download".
  let verificationCode: string | null = null;
  if (passed) {
    const certificate = await getOrCreateCertificate(req.user!.id, courseId);
    verificationCode = certificate.verificationCode;

    const student = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isVerifiedGraduate: true } });
    if (!student?.isVerifiedGraduate) {
      await prisma.user.update({ where: { id: req.user!.id }, data: { isVerifiedGraduate: true } });
      await logAdminAction({
        action: 'user.auto_verify_graduate',
        targetType: 'User',
        targetId: req.user!.id,
        performedById: req.user!.id,
        metadata: { trigger: 'exam_pass', courseId, examId: exam.id, score },
      });
    }
  }

  res.json({
    data: {
      score,
      passed,
      correctCount,
      total,
      passingScore: exam.passingScore,
      weakTopics,
      cooldownEndsAt,
      review,
      certificateIssued: passed,
      verificationCode,
    },
  });
});

// ---- Certificate ----

router.get('/:id/certificate', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const courseId = req.params.id;
  const isSuperAdmin = req.user!.role === 'SuperAdmin';
  const exam = await prisma.exam.findUnique({ where: { courseId } });

  // SuperAdmins skip the exam-passed / 100%-complete gates entirely — they
  // need to generate certificates for any course on demand for testing and
  // support, not just ones they've actually completed as a student would.
  if (!isSuperAdmin) {
    if (exam) {
      const passedAttempt = await prisma.examAttempt.findFirst({ where: { userId: req.user!.id, examId: exam.id, passed: true } });
      if (!passedAttempt) {
        return res.status(400).json({ message: 'You must pass the certification exam to generate a certificate.' });
      }
    } else if (!(await getCourseCompletion(courseId, req.user!.id))) {
      return res.status(400).json({ message: 'Course must be 100% complete to generate a certificate.' });
    }
  }

  const [course, student] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true, legalFirstNameKa: true, legalLastNameKa: true, legalFirstNameEn: true, legalLastNameEn: true },
    }),
  ]);
  if (!course || !student) return res.status(404).json({ message: 'Course not found.' });

  // Legal name (if the student has filled it in under /dashboard/settings)
  // takes precedence over the display `name` — certificates need to match
  // the person's real identity. The English transliteration line is only
  // shown when explicitly set; we never guess a transliteration.
  const legalNameKa =
    student.legalFirstNameKa && student.legalLastNameKa ? `${student.legalFirstNameKa} ${student.legalLastNameKa}` : null;
  const legalNameEn =
    student.legalFirstNameEn && student.legalLastNameEn ? `${student.legalFirstNameEn} ${student.legalLastNameEn}` : null;

  const certificate = await getOrCreateCertificate(req.user!.id, courseId);

  // One download per student per course via this authenticated button —
  // further attempts are turned away with a support-contact message instead
  // of silently regenerating the PDF (fraud-prevention: stops a certificate
  // being freely re-downloaded/re-issued with edited legal-name fields).
  // SuperAdmins bypass this entirely — they need to be able to re-generate
  // certificates on demand for testing/support, and the fraud concern this
  // limit exists for doesn't apply to platform staff.
  if (certificate.downloadCount >= 1 && !isSuperAdmin) {
    return res.status(403).json({
      error: 'DOWNLOAD_LIMIT_REACHED',
      message:
        'სერტიფიკატის განმეორებით ჩამოტვირთვისთვის ან მონაცემების შესაცვლელად, გთხოვთ დაუკავშირდეთ მხარდაჭერის გუნდს ელფოსტაზე: contact@cdc.org.ge',
    });
  }

  try {
    const pdfBuffer = await generateCertificatePdf({
      studentName: legalNameKa || student.name,
      studentNameSecondary: legalNameEn,
      courseTitle: course.title,
      courseTitleEn: course.titleEn,
      instructorName: course.mentorName || 'CDC Faculty',
      issueDate: certificate.issuedAt,
      verificationCode: certificate.verificationCode,
    });
    await prisma.courseCertificate.update({
      where: { id: certificate.id },
      data: { downloadCount: { increment: 1 }, firstDownloadedAt: certificate.firstDownloadedAt ?? new Date() },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${course.title.replace(/[^a-z0-9]+/gi, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err instanceof CertificateTemplateMissingError) {
      return res.status(503).json({ message: 'Certificate template is not configured yet.' });
    }
    throw err;
  }
});

// ---- Public certificate verification (no auth) — the target of the QR code
// printed on every certificate PDF, see certificateService.ts. Deliberately
// returns only what's needed to confirm authenticity, not the student's
// account details beyond their name. ----

router.get('/verify/:code', async (req: Request, res: Response) => {
  const certificate = await prisma.courseCertificate.findUnique({
    where: { verificationCode: req.params.code },
    include: {
      user: { select: { name: true, legalFirstNameEn: true, legalLastNameEn: true } },
      course: { select: { title: true, titleEn: true, mentorName: true, mentorTitle: true } },
    },
  });
  if (!certificate) {
    // Not a real CourseCertificate — fall back to a manually-issued one
    // (retroactive certs for graduates/courses with no User/Course row).
    const manual = await prisma.manualCertificate.findUnique({ where: { verificationCode: req.params.code } });
    if (!manual) {
      return res.status(404).json({ message: 'No certificate found for this verification code.' });
    }
    return res.json({
      data: {
        verificationCode: manual.verificationCode,
        // ka/en returned separately (not pre-concatenated) so the bilingual
        // verification card can render whichever language the visitor has
        // selected instead of always showing both at once.
        studentName: manual.studentNameKa,
        studentNameEn: manual.studentNameEn,
        courseTitle: manual.courseTitleKa,
        courseTitleEn: manual.courseTitleEn,
        instructorName: manual.instructorName,
        instructorTitle: null,
        issuedAt: manual.issueDate,
      },
    });
  }
  const studentNameEn =
    certificate.user.legalFirstNameEn && certificate.user.legalLastNameEn
      ? `${certificate.user.legalFirstNameEn} ${certificate.user.legalLastNameEn}`
      : null;
  res.json({
    data: {
      verificationCode: certificate.verificationCode,
      studentName: certificate.user.name,
      studentNameEn,
      courseTitle: certificate.course.title,
      courseTitleEn: certificate.course.titleEn,
      // No English variant exists for a course's mentorName/mentorTitle in
      // the schema (unlike title/titleEn) — the card falls back to the same
      // value in both languages rather than fabricating a translation.
      instructorName: certificate.course.mentorName,
      instructorTitle: certificate.course.mentorTitle,
      issuedAt: certificate.issuedAt,
    },
  });
});

// ---- Public certificate PDF download by verification code (no auth) — the
// link in the "your certificate is ready" email and the /verify/:code page's
// download button both point here. Regenerates the PDF on demand (nothing is
// persisted) using the exact same renderer as the authenticated
// GET /:id/certificate route, so anyone holding the code/link can fetch it
// without ever needing to log in. ----

router.get('/certificates/download/:code', async (req: Request, res: Response) => {
  const code = req.params.code;

  const certificate = await prisma.courseCertificate.findUnique({
    where: { verificationCode: code },
    include: {
      user: { select: { name: true, legalFirstNameKa: true, legalLastNameKa: true, legalFirstNameEn: true, legalLastNameEn: true } },
      course: { select: { title: true, titleEn: true, mentorName: true, mentorTitle: true } },
    },
  });

  let pdfPromise: Promise<Buffer>;
  if (certificate) {
    const legalNameKa =
      certificate.user.legalFirstNameKa && certificate.user.legalLastNameKa
        ? `${certificate.user.legalFirstNameKa} ${certificate.user.legalLastNameKa}`
        : null;
    const legalNameEn =
      certificate.user.legalFirstNameEn && certificate.user.legalLastNameEn
        ? `${certificate.user.legalFirstNameEn} ${certificate.user.legalLastNameEn}`
        : null;
    pdfPromise = generateCertificatePdf({
      studentName: legalNameKa || certificate.user.name,
      studentNameSecondary: legalNameEn,
      courseTitle: certificate.course.title,
      courseTitleEn: certificate.course.titleEn,
      instructorName: certificate.course.mentorName || 'CDC Faculty',
      issueDate: certificate.issuedAt,
      verificationCode: certificate.verificationCode,
    });
  } else {
    const manual = await prisma.manualCertificate.findUnique({ where: { verificationCode: code } });
    if (!manual) {
      return res.status(404).json({ message: 'No certificate found for this verification code.' });
    }
    pdfPromise = generateCertificatePdf({
      studentName: manual.studentNameKa,
      studentNameSecondary: manual.studentNameEn,
      courseTitle: manual.courseTitleKa,
      courseTitleEn: manual.courseTitleEn,
      instructorName: manual.instructorName,
      issueDate: manual.issueDate,
      verificationCode: manual.verificationCode,
    });
  }

  try {
    const pdfBuffer = await pdfPromise;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CDC-Certificate-${code}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (err instanceof CertificateTemplateMissingError) {
      return res.status(503).json({ message: 'Certificate template is not configured yet.' });
    }
    throw err;
  }
});

export default router;
