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
