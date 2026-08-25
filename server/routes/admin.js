import { Router } from 'express';
import {
  handleAdminDashboard,
  handleAdminGetSupportChat,
  handleAdminListFeedback,
  handleAdminListReports,
  handleAdminListSupportChats,
  handleAdminLookupHousehold,
  handleAdminLookupUser,
  handleAdminMe,
  handleAdminRecoveryConfirmCode,
  handleAdminRecoverySendCode,
  handleAdminRejoinHousehold,
  handleAdminReplySupportChat,
  handleAdminUpdateFeedback,
  handleAdminUpdateReport,
  handleAdminUpdateSupportChat,
  handleCreateAdminDeal,
  handleDeleteAdminDeal,
  handleListAdminDeals,
  handleListUnverifiedDeals,
  handleUnverifyWeeklyDeals,
  handleUpdateAdminDeal,
  handleVerifyWeeklyDeals,
} from '../adminHandlers.js';
import { asyncRoute } from '../routeUtils.js';

export const adminRouter = Router();

adminRouter.get('/me', asyncRoute(handleAdminMe, 'GET /api/admin/me', 'Could not check admin access.'));
adminRouter.get(
  '/dashboard',
  asyncRoute(handleAdminDashboard, 'GET /api/admin/dashboard', 'Could not load dashboard.'),
);
adminRouter.get(
  '/deals',
  asyncRoute(handleListAdminDeals, 'GET /api/admin/deals', 'Could not list deals.'),
);
adminRouter.get(
  '/deals/unverified',
  asyncRoute(handleListUnverifiedDeals, 'GET /api/admin/deals/unverified', 'Could not list deals.'),
);
adminRouter.post(
  '/deals/verify',
  asyncRoute(handleVerifyWeeklyDeals, 'POST /api/admin/deals/verify', 'Could not verify deals.'),
);
adminRouter.post(
  '/deals/unverify',
  asyncRoute(handleUnverifyWeeklyDeals, 'POST /api/admin/deals/unverify', 'Could not unverify deals.'),
);
adminRouter.post(
  '/deals',
  asyncRoute(handleCreateAdminDeal, 'POST /api/admin/deals', 'Could not create deal.'),
);
adminRouter.patch(
  '/deals/:id',
  asyncRoute(handleUpdateAdminDeal, 'PATCH /api/admin/deals/:id', 'Could not update deal.'),
);
adminRouter.delete(
  '/deals/:id',
  asyncRoute(handleDeleteAdminDeal, 'DELETE /api/admin/deals/:id', 'Could not delete deal.'),
);
adminRouter.get(
  '/reports',
  asyncRoute(handleAdminListReports, 'GET /api/admin/reports', 'Could not list reports.'),
);
adminRouter.patch(
  '/reports/:id',
  asyncRoute(handleAdminUpdateReport, 'PATCH /api/admin/reports/:id', 'Could not update report.'),
);
adminRouter.get(
  '/feedback',
  asyncRoute(handleAdminListFeedback, 'GET /api/admin/feedback', 'Could not list feedback.'),
);
adminRouter.patch(
  '/feedback/:id',
  asyncRoute(handleAdminUpdateFeedback, 'PATCH /api/admin/feedback/:id', 'Could not update feedback.'),
);
adminRouter.get(
  '/support-chats',
  asyncRoute(handleAdminListSupportChats, 'GET /api/admin/support-chats', 'Could not list support chats.'),
);
adminRouter.get(
  '/support-chats/:id',
  asyncRoute(handleAdminGetSupportChat, 'GET /api/admin/support-chats/:id', 'Could not load support chat.'),
);
adminRouter.post(
  '/support-chats/:id/messages',
  asyncRoute(
    handleAdminReplySupportChat,
    'POST /api/admin/support-chats/:id/messages',
    'Could not reply to support chat.',
  ),
);
adminRouter.patch(
  '/support-chats/:id',
  asyncRoute(
    handleAdminUpdateSupportChat,
    'PATCH /api/admin/support-chats/:id',
    'Could not update support chat.',
  ),
);
adminRouter.get(
  '/recovery/users',
  asyncRoute(handleAdminLookupUser, 'GET /api/admin/recovery/users', 'Could not look up user.'),
);
adminRouter.get(
  '/recovery/households',
  asyncRoute(
    handleAdminLookupHousehold,
    'GET /api/admin/recovery/households',
    'Could not look up household.',
  ),
);
adminRouter.post(
  '/recovery/send-code',
  asyncRoute(
    handleAdminRecoverySendCode,
    'POST /api/admin/recovery/send-code',
    'Could not send recovery code.',
  ),
);
adminRouter.post(
  '/recovery/confirm-code',
  asyncRoute(
    handleAdminRecoveryConfirmCode,
    'POST /api/admin/recovery/confirm-code',
    'Could not confirm recovery code.',
  ),
);
adminRouter.post(
  '/recovery/rejoin',
  asyncRoute(handleAdminRejoinHousehold, 'POST /api/admin/recovery/rejoin', 'Could not rejoin household.'),
);
