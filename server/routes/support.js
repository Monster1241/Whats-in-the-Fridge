import { Router } from 'express';
import { handleSubmitFeedback, handleSubmitReport } from '../supportHandlers.js';
import { asyncRoute } from '../routeUtils.js';
import { supportRateLimit } from '../rateLimit.js';

export const supportRouter = Router();

supportRouter.post(
  '/report',
  supportRateLimit,
  asyncRoute(handleSubmitReport, 'POST /api/support/report', 'Could not submit report.'),
);
supportRouter.post(
  '/feedback',
  supportRateLimit,
  asyncRoute(handleSubmitFeedback, 'POST /api/support/feedback', 'Could not submit feedback.'),
);
