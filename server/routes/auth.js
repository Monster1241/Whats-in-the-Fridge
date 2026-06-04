import { Router } from 'express';
import {
  handleDeleteAccount,
  handleFirebaseSession,
  handleLogin,
  handleMe,
  handlePasswordRecoveryQuestion,
  handlePasswordRecoveryReset,
  handlePasswordRecoveryVerify,
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
  '/verify',
  asyncRoute(handleVerifyEmail, 'POST /api/auth/verify', 'Verification failed'),
);
authRouter.post(
  '/password-recovery/question',
  asyncRoute(
    handlePasswordRecoveryQuestion,
    'POST /api/auth/password-recovery/question',
    'Could not load security question',
  ),
);
authRouter.post(
  '/password-recovery/verify',
  asyncRoute(
    handlePasswordRecoveryVerify,
    'POST /api/auth/password-recovery/verify',
    'Could not verify answer',
  ),
);
authRouter.post(
  '/password-recovery/reset',
  asyncRoute(
    handlePasswordRecoveryReset,
    'POST /api/auth/password-recovery/reset',
    'Could not reset password',
  ),
);
authRouter.delete(
  '/account',
  asyncRoute(handleDeleteAccount, 'DELETE /api/auth/account', 'Could not delete account.'),
);
