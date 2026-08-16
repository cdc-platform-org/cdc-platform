export type CourseLanguage = 'GEORGIAN' | 'ENGLISH' | 'BOTH';

export interface Course {
  id: string;
  title: string;
  // Optional English translation — when set, printed as "title / titleEn" on
  // the certificate PDF's auto-scaling title block. Never auto-translated.
  titleEn: string | null;
  description: string;
  // Optional English translation of `description` — same never-auto-
  // translated posture as titleEn. The course detail page shows this when
  // the site language is EN, falling back to `description` when unset.
  descriptionEn: string | null;
  category: string;
  language: CourseLanguage;
  // originalPrice is the sticker price; currentPrice/saleActive are computed
  // server-side (see Backend's services/coursePricing.ts) — always use
  // currentPrice for anything charge-related, originalPrice only for the
  // strikethrough display.
  originalPrice: number;
  discountPercent: number | null;
  discountEndDate: string | null;
  isOnSale: boolean;
  currentPrice: number;
  saleActive: boolean;
  published: boolean;
  mentorName: string | null;
  mentorTitle: string | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  mentorAvatarUrl: string | null;
  // Freelancer skills this course teaches (see
  // src/data/freelancerSkills.ts) — auto-verifies each on a student's
  // profile once they earn this course's certificate, no AI test needed.
  skillsTaught: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CoursePayload {
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  category: string;
  // Legacy flat lessons blob — kept required by the backend's create schema,
  // but the LMS player reads the relational sections/lessons below instead.
  lessons: { title: string; content: string; durationMinutes: number; resources?: string[] }[];
  originalPrice: number;
  isOnSale?: boolean;
  discountPercent?: number | null;
  // ISO datetime string, or null to clear — see Backend's toPrismaDiscountEndDate().
  discountEndDate?: string | null;
  published?: boolean;
  mentorName?: string;
  mentorTitle?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  mentorAvatarUrl?: string;
  language?: CourseLanguage;
  skillsTaught?: string[];
}

// --- Student-facing curriculum (learn page) ---

export interface LmsLesson {
  id: string;
  title: string;
  durationSeconds: number;
  order: number;
  resources: string[];
  assignmentPrompt: string | null;
  completed: boolean;
  embedUrl: string | null;
  thumbnailUrl: string | null;
}

export interface LmsSection {
  id: string;
  title: string;
  order: number;
  lessons: LmsLesson[];
}

// Public curriculum outline for the course details page — no auth/enrollment
// required, no video embed URLs (see courseService.getSyllabus()).
export interface SyllabusLesson {
  id: string;
  title: string;
  durationSeconds: number;
  isFreePreview: boolean;
  // Only populated (non-null) when isFreePreview is true — see Backend's
  // GET /:id/syllabus.
  embedUrl: string | null;
}

export interface SyllabusSection {
  id: string;
  title: string;
  lessons: SyllabusLesson[];
}

export interface CourseProgressSummary {
  totalLessons: number;
  completedLessons: number;
  percent: number;
}

// Student dashboard: enrolled courses with per-course progress + certificate
// availability (see Backend's GET /courses/mine).
export interface MyCourseWithProgress {
  course: Course;
  progress: CourseProgressSummary;
  hasCertificate: boolean;
  grantedAt: string;
  verificationCode: string | null;
  certificateIssuedAt: string | null;
  certificateDownloadCount: number;
}

export interface CertificateVerification {
  verificationCode: string;
  studentName: string;
  courseTitle: string;
  instructorName: string | null;
  instructorTitle: string | null;
  issuedAt: string;
}

// --- Admin-facing curriculum (course editor) ---

export interface AdminLesson {
  id: string;
  sectionId: string;
  title: string;
  titleEn: string | null;
  durationSeconds: number;
  order: number;
  resources: string[];
  bunnyVideoId: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  isFreePreview: boolean;
  assignmentPrompt: string | null;
  assignmentPromptEn: string | null;
  subtitlesStatus: SubtitlesStatus | null;
  subtitlesError: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SubtitlesStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type AssignmentStatus = 'PENDING' | 'APPROVED' | 'NEEDS_REVISION';

export interface AssignmentSubmission {
  id: string;
  lessonId: string;
  userId: string;
  fileUrl: string | null;
  linkUrl: string | null;
  comment: string | null;
  status: AssignmentStatus;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAssignmentSubmission extends AssignmentSubmission {
  user: { id: string; name: string; email: string };
  lesson: { id: string; title: string; section: { title: string; course: { id: string; title: string } } };
}

export interface AdminSection {
  id: string;
  courseId: string;
  title: string;
  titleEn: string | null;
  order: number;
  lessons: AdminLesson[];
  createdAt: string;
  updatedAt: string;
}

export interface SectionPayload {
  title: string;
  titleEn?: string | null;
  order: number;
}

export interface LessonPayload {
  title: string;
  titleEn?: string | null;
  durationSeconds?: number;
  resources?: string[];
  order: number;
  // Manual fallback for when direct upload-to-Bunny fails — a raw Bunny
  // Stream video GUID or a full embed URL (parsed server-side).
  bunnyVideoId?: string | null;
  isFreePreview?: boolean;
  assignmentPrompt?: string | null;
  assignmentPromptEn?: string | null;
}

// --- AI Exam & Certification Gate ---

export interface Exam {
  id: string;
  courseId: string;
  passingScore: number;
  cooldownHours: number;
  questionCount: number;
  aiPromptContext: string | null;
}

export interface ExamSettingsPayload {
  passingScore?: number;
  cooldownHours?: number;
  questionCount?: number;
  aiPromptContext?: string | null;
}

export interface ExamStatus {
  configured: boolean;
  passingScore?: number;
  cooldownHours?: number;
  questionCount?: number;
  courseComplete?: boolean;
  passed?: boolean;
  bestScore?: number | null;
  lastAttemptAt?: string | null;
  weakTopics?: string[];
  inCooldown?: boolean;
  cooldownEndsAt?: string | null;
  canStart?: boolean;
}

// Student-facing question — no correct answer, that's kept server-side in
// the encrypted session token until /exam/submit scores it.
export interface ExamQuestion {
  id: string;
  topic: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
}

export interface ExamStartResult {
  sessionToken: string;
  durationMinutes: number;
  passingScore: number;
  questions: ExamQuestion[];
}

export type ExamAnswerLetter = 'A' | 'B' | 'C' | 'D';

export interface ExamReviewQuestion extends ExamQuestion {
  correctAnswer: ExamAnswerLetter;
  selected: ExamAnswerLetter | null;
  correct: boolean;
  explanation: string;
}

export interface ExamSubmitResult {
  score: number;
  passed: boolean;
  correctCount: number;
  total: number;
  passingScore: number;
  weakTopics: string[];
  cooldownEndsAt: string | null;
  review: ExamReviewQuestion[];
  // Set when passed: true — the CDC Alumni grant + certificate record are
  // created instantly server-side, see Backend's POST /:id/exam/submit.
  certificateIssued: boolean;
  verificationCode: string | null;
}
