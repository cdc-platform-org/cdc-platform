/**
 * AI Course Mentor Agent — public entry point.
 *
 * Folder map (open in VS Code):
 *   README.md              what the agent does, stages, configuration
 *   types.ts               shared types + zod schemas for every model output
 *   calendar.ts            class days and lesson allocation (pure date math)
 *   legacyGeorgianFont.ts  AcadNusx -> Unicode repair for old Georgian PDFs
 *   textProcessing.ts      cleanup, heading detection, chunks, outline
 *   embeddings.ts          Azure OpenAI embeddings (optional)
 *   retrieval.ts           semantic + keyword search over a course's documents
 *   documentIngestion.ts   upload -> parsed chunks (background job)
 *   curriculumPlanner.ts   documents + brief -> modules and dated lessons
 *   courseService.ts       teacher CRUD with ownership checks
 *   mentorModels.ts        gpt-4o-mini vs gpt-4o routing, escalation rules (cost control)
 *   usageLimits.ts         per-student daily caps behind the seat price
 *   enrollmentService.ts   students join by class code, progress overview
 *   lessonRunner.ts        one lesson: opening, chat turns, end-of-lesson evaluation
 *   taskService.ts         practice tasks, tests, homework; grading
 *   prompts/               all prompt text, separate from control flow
 * HTTP layer: routes/courseMentor.ts (mounted at /api/course-mentor).
 */
export * from './types';
export { listClassDays, allocateLessonsToModules } from './calendar';
export { ingestDocument, SUPPORTED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from './documentIngestion';
export { startCoursePlanning } from './curriculumPlanner';
export { searchCourseChunks } from './retrieval';
export { isEmbeddingConfigured } from './embeddings';
export {
  createCourse,
  listTeacherCourses,
  getTeacherCourse,
  updateCourse,
  deleteCourse,
  assertTeacherOwnsCourse,
  deleteDocument,
  updateLesson,
  approvePlan,
} from './courseService';
export type { CourseInput, LessonEdit } from './courseService';
export { joinCourseByCode, listMyCourses, getMyCourse } from './enrollmentService';
export { startLessonSession, getLessonSession, sendStudentMessage, finishLessonSession } from './lessonRunner';
export { generateTasks, submitTask } from './taskService';
