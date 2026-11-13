/**
 * Authentication and account API, mounted at /api/auth.
 *
 * Each file in this folder is a small router for one area; shared helpers are
 * in shared.ts. Routers are mounted in the same order as the routes in the
 * original single file.
 */
import { Router } from 'express';
import credentialRoutes from './credentials';
import oauthRoutes from './oauth';
import profileRoutes from './profile';
import verificationRoutes from './verification';
import accountSettingsRoutes from './accountSettings';

const router = Router();

router.use(credentialRoutes);
router.use(oauthRoutes);
router.use(profileRoutes);
router.use(verificationRoutes);
router.use(accountSettingsRoutes);

export default router;
