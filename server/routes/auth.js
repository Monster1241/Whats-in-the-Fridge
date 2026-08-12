import { Router } from 'express';
import {
  handleDeleteAccount,
  handleFirebaseSession,
  handleLegacyPasswordAuthDisabled,
  handleMe,
  handleSaveFcmToken,
  handleVerifyEmail,
} from '../handlers.js';
import { asyncRoute } from '../routeUtils.js';
import { authRateLimit } from '../rateLimit.js';

export const authRouter = Router();

authRouter.use(authRateLimit);

authRouter.post(
  '/session',
  asyncRoute(handleFirebaseSession, 'POST /api/auth/session', 'Could not establish session'),
);
authRouter.post('/signup', handleLegacyPasswordAuthDisabled);
authRouter.post('/login', handleLegacyPasswordAuthDisabled);
authRouter.get('/me', asyncRoute(handleMe, 'GET /api/auth/me', 'Session check failed'));
authRouter.post(
  '/save-token',
  asyncRoute(handleSaveFcmToken, 'POST /api/auth/save-token', 'Could not save push token'),
);
authRouter.post(
  '/verify',
  asyncRoute(handleVerifyEmail, 'POST /api/auth/verify', 'Verification failed'),
);
authRouter.delete(
  '/account',
  asyncRoute(handleDeleteAccount, 'DELETE /api/auth/account', 'Could not delete account.'),
);
