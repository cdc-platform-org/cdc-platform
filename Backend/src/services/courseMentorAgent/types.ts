/**
 * Course Mentor Agent — shared types and model-output schemas.
 * Exports: CourseBrief, OutlineEntry, LessonBlueprint, lessonBlueprintSchema,
 * curriculumDraftSchema, CurriculumDraft, moduleLessonsSchema, ModuleLessonsDraft,
 * CourseMentorError.
 *
 * Every JSON the model returns is validated with these zod schemas before it
 * touches the database ("never trust raw model output", same posture as
 * services/exams/aiExamService.ts).
 */
import { z } from 'zod';

// What the teacher tells the agent about the course.
export interface CourseBrief {
  title: string;
  audience: string;
  goals: string;
  instructions?: string | null;
  teachingLocale: string;
  minutesPerLesson: number;
  totalLessons: number;
  startDate: string;
  endDate: string;
}

// One heading of a source document, stored in MentorSourceDocument.outline.
export interface OutlineEntry {
  title: string;
  level: number;
  chunkPosition: number;
}

const shortText = z.string().trim().min(1).max(600);

// ---- Step 1: curriculum architect (modules in teaching order) ----
export const curriculumDraftSchema = z.object({
  courseSummary: z.string().trim().min(1).max(2000),
  // Notes for the teacher: skipped/outdated material, prerequisites, gaps.
  notesForTeacher: z.array(shortText).max(12).default([]),
  modules: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(200),
        summary: z.string().trim().min(2).max(1500),
        weight: z.coerce.number().positive().max(100),
        // Which document sections feed this module (document number from
        // the prompt + heading text), used for retrieval while expanding.
        sources: z
          .array(z.object({ document: z.coerce.number().int().min(1), headings: z.array(z.string().trim().max(200)).max(30) }))
          .max(10)
          .default([]),
        skills: z.array(z.string().trim().max(200)).max(15).default([]),
      })
    )
    .min(1)
    .max(40),
});
export type CurriculumDraft = z.infer<typeof curriculumDraftSchema>;

// ---- Step 2: lesson blueprints for one module ----
export const lessonKindSchema = z.enum(['LEARN', 'PRACTICE', 'REVIEW', 'PROJECT', 'ASSESSMENT']);

export const lessonBlueprintSchema = z.object({
  kind: lessonKindSchema.default('LEARN'),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(2).max(1200),
  objectives: z.array(z.string().trim().min(2).max(300)).min(1).max(8),
  topics: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
  // Lesson flow: how the 3-hour (or other length) session is split.
  flow: z
    .array(z.object({ step: z.string().trim().min(1).max(200), minutes: z.coerce.number().int().min(1).max(240) }))
    .min(2)
    .max(10),
  realWorldExample: z.string().trim().min(2).max(800),
  practiceIdeas: z
    .array(
      z.object({
        type: z.enum(['quiz', 'coding', 'debugging', 'short-answer', 'design', 'project', 'matching']),
        description: z.string().trim().min(2).max(600),
        difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
      })
    )
    .min(1)
    .max(8),
  homework: z.object({
    description: z.string().trim().min(2).max(800),
    deliverable: z.string().trim().min(2).max(300),
  }),
  // Headings of the source sections this lesson teaches from.
  sourceHeadings: z.array(z.string().trim().max(200)).max(12).default([]),
});
export type LessonBlueprint = z.infer<typeof lessonBlueprintSchema>;

export const moduleLessonsSchema = z.object({ lessons: z.array(lessonBlueprintSchema).min(1).max(40) });
export type ModuleLessonsDraft = z.infer<typeof moduleLessonsSchema>;

// Errors a route can show to the teacher as-is (status + safe message).
export class CourseMentorError extends Error {
  constructor(public readonly status: number, message: string, public readonly code = 'COURSE_MENTOR_ERROR') {
    super(message);
    this.name = 'CourseMentorError';
  }
}
