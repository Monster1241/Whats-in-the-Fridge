import { Router } from 'express';
import {
  handleAdminDashboard,
  handleAdminListFeedback,
  handleAdminListReports,
  handleAdminMe,
  handleAdminUpdateFeedback,
  handleAdminUpdateReport,
  handleListUnverifiedDeals,
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
  '/deals/unverified',
  asyncRoute(handleListUnverifiedDeals, 'GET /api/admin/deals/unverified', 'Could not list deals.'),
);
adminRouter.post(
  '/deals/verify',
  asyncRoute(handleVerifyWeeklyDeals, 'POST /api/admin/deals/verify', 'Could not verify deals.'),
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
