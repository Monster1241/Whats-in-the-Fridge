import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../routeUtils.js';
import {
  deleteInventoryItem,
  getInventoryForHousehold,
  saveInventoryItems,
} from '../db.js';
import { sanitizeInventoryItemInput, sanitizeInventoryItems } from '../inventorySanitize.js';
import { STATUS } from '../../src/inventory/constants.js';
import { calculateExpiryDate } from '../../src/inventory/smartInventory.js';
import { buildConsumptionFields } from '../../src/inventory/consumption.js';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

inventoryRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const items = await getInventoryForHousehold(req.user.household_id);
    const inStock = items.filter((item) => item.status !== STATUS.OUT);
    res.status(200).json({ items: inStock });
  }, 'GET /api/inventory', 'Could not load inventory'),
);

inventoryRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Item name is required.' });
      return;
    }

    const existing = await getInventoryForHousehold(req.user.household_id);
    const consumption = buildConsumptionFields({
      name,
      itemType: body.itemType,
      category: body.category,
    });
    const now = new Date().toISOString();
    const draft = sanitizeInventoryItemInput({
      id: randomUUID(),
      name,
      itemType: body.itemType,
      category: body.category,
      subCategory: body.subCategory,
      status: body.status ?? STATUS.FRESH,
      expiryDate:
        body.expiryDate ??
        (body.itemType !== 'Household' && body.itemType !== 'Baby' && !body.expiryDate
          ? calculateExpiryDate(body.foodGroup, body.storageLocation)
          : null),
      preferredStore: body.preferredStore,
      quantity: body.quantity,
      unit: body.unit,
      foodGroup: body.foodGroup,
      storageLocation: body.storageLocation,
      isLow: body.isLow,
      dateAdded: body.dateAdded ?? now,
      stockedAt: body.stockedAt ?? now,
      createdAt: now,
      ...consumption,
    });

    if (!draft) {
      res.status(400).json({ error: 'Invalid inventory item.' });
      return;
    }

    const merged = sanitizeInventoryItems([...existing, draft]);
    const saved = await saveInventoryItems(req.user.household_id, merged);
    const item = saved.find((entry) => entry.id === draft.id) ?? draft;
    res.status(201).json({ item, items: saved.filter((entry) => entry.status !== STATUS.OUT) });
  }, 'POST /api/inventory', 'Could not add inventory item'),
);

inventoryRouter.put(
  '/:id',
  asyncRoute(async (req, res) => {
    const itemId = String(req.params.id ?? '').trim();
    if (!itemId) {
      res.status(400).json({ error: 'Item id is required.' });
      return;
    }

    const existing = await getInventoryForHousehold(req.user.household_id);
    const current = existing.find((entry) => String(entry.id) === itemId);
    if (!current) {
      res.status(404).json({ error: 'Inventory item not found.' });
      return;
    }

    const body = req.body ?? {};
    const draft = sanitizeInventoryItemInput({
      ...current,
      ...body,
      id: current.id,
      name: body.name ?? current.name,
    });

    if (!draft) {
      res.status(400).json({ error: 'Invalid inventory item.' });
      return;
    }

    const next = existing.map((entry) => (String(entry.id) === itemId ? draft : entry));
    const saved = await saveInventoryItems(req.user.household_id, sanitizeInventoryItems(next));
    const item = saved.find((entry) => String(entry.id) === itemId);
    res.status(200).json({ item, items: saved.filter((entry) => entry.status !== STATUS.OUT) });
  }, 'PUT /api/inventory/:id', 'Could not update inventory item'),
);

inventoryRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const itemId = String(req.params.id ?? '').trim();
    if (!itemId) {
      res.status(400).json({ error: 'Item id is required.' });
      return;
    }

    await deleteInventoryItem(req.user.household_id, itemId);
    const items = await getInventoryForHousehold(req.user.household_id);
    res.status(200).json({ items: items.filter((entry) => entry.status !== STATUS.OUT) });
  }, 'DELETE /api/inventory/:id', 'Could not delete inventory item'),
);
