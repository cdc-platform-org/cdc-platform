/**
 * Courses / LMS API, mounted at /api/courses.
 *
 * Each file in this folder is a small router for one area; shared helpers are
 * in shared.ts. Route order matters (GET /:id must not shadow later paths),
 * so routers are mounted in the same order as in the original single file.
 */
import { Router } from 'express';
import catalogRoutes from './catalog';
import learningRoutes from './learning';
import examCertificateRoutes from './examAndCertificates';
import curriculumAdminRoutes from './curriculumAdmin';
import assignmentRoutes from './assignments';
import leaderboardRoutes from './leaderboard';
import discussionRoutes from './discussion';

const router = Router();

router.use(catalogRoutes);
router.use(learningRoutes);
router.use(examCertificateRoutes);
router.use(curriculumAdminRoutes);
router.use(assignmentRoutes);
router.use(leaderboardRoutes);
router.use(discussionRoutes);

export { checkCourseAccess } from './shared';

export default router;
