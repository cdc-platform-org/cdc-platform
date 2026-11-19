/**
 * Course Mentor Agent — the universal catalogue of task types.
 * Exports: TASK_TYPES, TaskTypeKey, isTaskTypeKey, normalizeTaskType, describeTaskTypes.
 *
 * The mentor is subject-agnostic: the teacher picks which of these types a
 * course should use (MentorCourse.taskTypes; empty = the agent chooses what
 * fits the subject). Code tasks are just two of the options, used only when
 * the material is about programming. Must stay in sync with the Prisma enum
 * MentorTaskType and Frontend locales (courseMentor.json "practiceType").
 */
export const TASK_TYPES = {
  QUIZ: 'multiple choice, 4 options, exactly one correct',
  SHORT_ANSWER: 'a short written answer (definition, explanation, fact)',
  ESSAY: 'a longer written answer: argue, compare, reflect',
  CALCULATION: 'a numeric / step-by-step problem to solve (math, science, finance, engineering)',
  CASE_STUDY: 'a realistic situation to analyse and decide what to do',
  MATCHING: 'match terms to definitions, steps to order, items to categories (describe the pairs in the instructions)',
  PRACTICAL: 'a hands-on activity done in real life or in a tool, reported in writing or with a photo/screenshot',
  DESIGN: 'create a visual/layout/plan and upload an image of it',
  PROJECT: 'a larger multi-step piece of real-world work',
  CODING: 'write program code (only for programming subjects)',
  DEBUGGING: 'find and fix mistakes in given code (only for programming subjects)',
} as const;

export type TaskTypeKey = keyof typeof TASK_TYPES;
export const TASK_TYPE_KEYS = Object.keys(TASK_TYPES) as TaskTypeKey[];

export function isTaskTypeKey(v: string): v is TaskTypeKey {
  return (TASK_TYPE_KEYS as string[]).includes(v);
}

// Models write "short-answer", "Short answer", "coding"... -> enum key.
export function normalizeTaskType(v: unknown): TaskTypeKey {
  const key = String(v ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return isTaskTypeKey(key) ? key : 'SHORT_ANSWER';
}

// Prompt text: the allowed types with one-line explanations.
export function describeTaskTypes(allowed: string[]): string {
  const keys = allowed.filter(isTaskTypeKey);
  const list = keys.length ? keys : TASK_TYPE_KEYS;
  return list.map((k) => `${k}: ${TASK_TYPES[k]}`).join('\n');
}
