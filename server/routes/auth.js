import { Router } from 'express';
import {
  handleDeleteAccount,
  handleFirebaseSession,
  handleLogin,
  handleMe,
  handleSaveFcmToken,
  handleSignup,
  handleVerifyEmail,
} from '../handlers.js';
import { asyncRoute } from '../routeUtils.js';

export const authRouter = Router();

authRouter.post(
  '/session',
  asyncRoute(handleFirebaseSession, 'POST /api/auth/session', 'Could not establish session'),
);
authRouter.post(
  '/signup',
  asyncRoute(handleSignup, 'POST /api/auth/signup', 'Signup failed'),
);
authRouter.post(
  '/login',
  asyncRoute(handleLogin, 'POST /api/auth/login', 'Login failed'),
);
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
