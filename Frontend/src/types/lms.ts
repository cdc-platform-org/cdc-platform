export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
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
  price: number;
  published?: boolean;
  mentorName?: string;
  mentorTitle?: string;
  thumbnailUrl?: string;
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

export interface CourseProgressSummary {
  totalLessons: number;
  completedLessons: number;
  percent: number;
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
}
