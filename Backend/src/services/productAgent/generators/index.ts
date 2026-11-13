/**
 * Product agent — category → generator map.
 * Exports: GENERATORS.
 */
import { AgentCategoryKey } from '../categories';
import { Generator } from './shared';
import { generatePrints } from './prints';
import { generateWorksheets } from './worksheets';
import { generatePlanners } from './planners';
import { generateCvTemplates } from './cvTemplates';
import { generateBusinessTemplates } from './businessTemplates';
import { generateInvitations } from './invitations';
import { generateExamPrep } from './examPrep';

export const GENERATORS: Record<AgentCategoryKey, Generator> = {
  PRINTS: generatePrints,
  KIDS_WORKSHEETS: generateWorksheets,
  PLANNERS: generatePlanners,
  CV_TEMPLATES: generateCvTemplates,
  BUSINESS_TEMPLATES: generateBusinessTemplates,
  INVITATIONS: generateInvitations,
  EXAM_PREP: generateExamPrep,
};
