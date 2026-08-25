import { Router } from 'express';
import {
  handleGetSupportChat,
  handlePostSupportChatMessage,
  handleStartSupportChat,
  handleSubmitFeedback,
  handleSubmitReport,
} from '../supportHandlers.js';
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

supportRouter.get(
  '/chat',
  asyncRoute(handleGetSupportChat, 'GET /api/support/chat', 'Could not load support chat.'),
);
supportRouter.post(
  '/chat',
  supportRateLimit,
  asyncRoute(handleStartSupportChat, 'POST /api/support/chat', 'Could not start support chat.'),
);
supportRouter.post(
  '/chat/messages',
  supportRateLimit,
  asyncRoute(
    handlePostSupportChatMessage,
    'POST /api/support/chat/messages',
    'Could not send support message.',
  ),
);
