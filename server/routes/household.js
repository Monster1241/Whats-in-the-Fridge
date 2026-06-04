import { Router } from 'express';
import {
  handleCreateHousehold,
  handleGetHouseholdMembers,
  handleJoinHousehold,
  handleLeaveHousehold,
  handlePingShoppingList,
  handleRemoveHouseholdMember,
} from '../handlers.js';
import { asyncRoute } from '../routeUtils.js';

export const householdRouter = Router();

householdRouter.post(
  '/create',
  asyncRoute(handleCreateHousehold, 'POST /api/household/create', 'Could not create household'),
);
householdRouter.post(
  '/join',
  asyncRoute(handleJoinHousehold, 'POST /api/household/join', 'Could not join household'),
);
householdRouter.get(
  '/members',
  asyncRoute(
    handleGetHouseholdMembers,
    'GET /api/household/members',
    'Could not load household members',
  ),
);
householdRouter.post(
  '/leave',
  asyncRoute(handleLeaveHousehold, 'POST /api/household/leave', 'Could not leave household'),
);
householdRouter.post(
  '/ping-shopping',
  asyncRoute(
    handlePingShoppingList,
    'POST /api/household/ping-shopping',
    'Could not send shopping notification',
  ),
);
householdRouter.post(
  '/members/remove',
  asyncRoute(
    handleRemoveHouseholdMember,
    'POST /api/household/members/remove',
    'Could not remove household member',
  ),
);
