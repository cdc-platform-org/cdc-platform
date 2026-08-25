import { AdminSection } from './lms';

export type MentorApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MentorApplication {
  id: string;
  userId: string;
  background: string;
  linkedinUrl: string | null;
  bio: string;
  teachingTopics: string[];
  status: MentorApplicationStatus;
  rejectionReason: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string; role: string };
  reviewedBy?: { id: string; name: string; email: string } | null;
}

export interface MentorApplicationPayload {
  background: string;
  linkedinUrl?: string | null;
  bio: string;
  teachingTopics: string[];
}

export type CourseStatus = 'DRAFT' | 'PENDING_REVIEW' | 'NEEDS_REVISION' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface InstructorCourse {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  category: string;
  originalPrice: number;
  status: CourseStatus;
  instructorId: string | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  introVideoUrl: string | null;
  language: 'GEORGIAN' | 'ENGLISH' | 'BOTH';
  skillsTaught: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { sections: number; enrollments: number };
}

export interface CourseReviewHistoryEntry {
  id: string;
  courseId: string;
  action: 'SUBMITTED' | 'APPROVED_PUBLISHED' | 'REQUESTED_REVISION' | 'REJECTED';
  feedback: string | null;
  fromStatus: CourseStatus;
  toStatus: CourseStatus;
  actedById: string;
  actedBy: { id: string; name: string };
  createdAt: string;
}

export interface InstructorCourseDetail extends InstructorCourse {
  sections: AdminSection[];
  reviewHistory: CourseReviewHistoryEntry[];
}

export interface QualityCheck {
  key: string;
  met: boolean;
  message: string;
}

export interface ModerationCourseRow extends Omit<InstructorCourse, '_count'> {
  instructor: { id: string; name: string; email: string; mentorTitle: string | null };
  _count: { sections: number };
}
