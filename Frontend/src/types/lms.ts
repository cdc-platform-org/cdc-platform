export type CourseLanguage = 'GEORGIAN' | 'ENGLISH' | 'BOTH';

export interface Course {
  id: string;
  title: string;
  description: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CoursePayload {
  title: string;
  description: string;
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
  language?: CourseLanguage;
}

// --- Student-facing curriculum (learn page) ---

export interface LmsLesson {
  id: string;
  title: string;
  durationSeconds: number;
  order: number;
  resources: string[];
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
  durationSeconds: number;
  order: number;
  resources: string[];
  bunnyVideoId: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSection {
  id: string;
  courseId: string;
  title: string;
  order: number;
  lessons: AdminLesson[];
  createdAt: string;
  updatedAt: string;
}

export interface SectionPayload {
  title: string;
  order: number;
}

export interface LessonPayload {
  title: string;
  durationSeconds?: number;
  resources?: string[];
  order: number;
  // Manual fallback for when direct upload-to-Bunny fails — a raw Bunny
  // Stream video GUID or a full embed URL (parsed server-side).
  bunnyVideoId?: string | null;
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
}
