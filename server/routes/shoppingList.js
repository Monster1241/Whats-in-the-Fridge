import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../routeUtils.js';
import { getInventoryForHousehold, saveInventoryItems } from '../db.js';
import { sanitizeInventoryItems } from '../inventorySanitize.js';
import {
  addRecipeIngredientsToShoppingList,
  addShoppingListItem,
  getShoppingListItems,
  markShoppingItemPurchased,
} from '../shoppingListLogic.js';

export const shoppingListRouter = Router();

shoppingListRouter.use(requireAuth);

shoppingListRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const items = await getInventoryForHousehold(req.user.household_id);
    res.status(200).json({ items: getShoppingListItems(items) });
  }, 'GET /api/shopping-list', 'Could not load shopping list'),
);

shoppingListRouter.post(
  '/add',
  asyncRoute(async (req, res) => {
    const existing = await getInventoryForHousehold(req.user.household_id);
    const result = addShoppingListItem(existing, req.body ?? {});
    const saved = await saveInventoryItems(
      req.user.household_id,
      sanitizeInventoryItems(result.items),
    );
    res.status(200).json({
      item: result.item,
      merged: result.merged,
      warnings: result.warnings,
      items: saved,
      shoppingList: getShoppingListItems(saved),
    });
  }, 'POST /api/shopping-list/add', 'Could not add shopping list item'),
);

shoppingListRouter.post(
  '/add-from-recipe',
  asyncRoute(async (req, res) => {
    const existing = await getInventoryForHousehold(req.user.household_id);
    const result = addRecipeIngredientsToShoppingList(existing, req.body ?? {});
    const saved = await saveInventoryItems(
      req.user.household_id,
      sanitizeInventoryItems(result.items),
    );
    res.status(200).json({
      addedCount: result.addedCount,
      warnings: result.warnings,
      items: saved,
      shoppingList: getShoppingListItems(saved),
    });
  }, 'POST /api/shopping-list/add-from-recipe', 'Could not add recipe ingredients'),
);

shoppingListRouter.post(
  '/mark-purchased',
  asyncRoute(async (req, res) => {
    const itemId = String(req.body?.id ?? req.body?.itemId ?? '').trim();
    if (!itemId) {
      res.status(400).json({ error: 'Shopping list item id is required.' });
      return;
    }

    const existing = await getInventoryForHousehold(req.user.household_id);
    const result = markShoppingItemPurchased(existing, itemId, {
      applyExpiry: req.body?.applyExpiry !== false,
    });
    const saved = await saveInventoryItems(
      req.user.household_id,
      sanitizeInventoryItems(result.items),
    );
    res.status(200).json({
      item: result.item,
      items: saved,
      shoppingList: getShoppingListItems(saved),
    });
  }, 'POST /api/shopping-list/mark-purchased', 'Could not mark item purchased'),
);
