import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
  addShoppingListItem as addShoppingListItemApi,
  classifyInventoryItem,
  markShoppingItemPurchased,
  pingShoppingList,
} from '../api.js';
import { InventorySearch } from '../components/InventorySearch.jsx';
import { StorageCategoryToggle } from '../components/StorageCategoryToggle.jsx';
import { SubCategoryToggle } from '../components/SubCategoryToggle.jsx';
import { SubCategoryFilterMenu } from '../components/SubCategoryFilterMenu.jsx';
import { InventoryItemRow } from '../components/InventoryItemRow.jsx';
import { ShoppingListItemRow } from '../components/ShoppingListItemRow.jsx';
import { KitchenStatusCard } from '../components/KitchenStatusCard.jsx';
import { TabPanelLoader } from '../components/TabPanelLoader.jsx';
import { ColorLegendCard } from '../components/ColorLegendCard.jsx';
import {
  defaultCategoryForItemType,
  getCategoriesForItemType,
  getCategoryMeta,
  FOOD_CATEGORY,
  isInStockInventory,
  isOnShoppingList,
  ITEM_TYPE,
  STATUS,
} from '../inventory/constants.js';
import {
  getDefaultModuleKey,
  getEnabledItemTypes,
  getEnabledModuleList,
  getInitialCategoryForModule,
  getItemTypeForModule,
  getModuleGridClass,
  isItemTypeEnabled,
  MODULE_DEFINITIONS,
  resolveModuleKey,
} from '../inventory/modules.js';
import { BARCODE_LOOKUP_LOADING_TEXT } from '../inventory/barcodeLookup.js';
import { guessExpiryForItem } from '../inventory/expiryGuess.js';
import {
  findItemKnowledgeByName,
  recordUserItemCorrection,
} from '../inventory/itemKnowledge.js';
import { resolveItemClassification } from '../inventory/resolveItemClassification.js';
import { inferStorageLocation } from '../inventory/smartInventory.js';
import {
  formatInventoryQuantityLabel,
  normalizeAmbientQuantityFields,
} from '../inventory/quantityDisplay.js';
import {
  EXPIRING_SOON_DAYS,
  getDisplayStatus,
  isExpired,
  isExpiringSoon,
  sortByUrgencyThenName,
} from '../inventory/expiryDisplay.js';
import { SHOPPING_ACCENT, STATUS_META } from '../inventory/uiAccents.js';
import { classifyItem } from '../inventory/classifyItem.js';
import {
  countItemsBySubCategory,
  groupItemsBySubCategory,
  resolveSubCategory,
  SUBCATEGORY_OTHER,
} from '../inventory/subcategories.js';
import { findInventoryItem, getItemId, normalizeName } from '../inventory/itemUtils.js';
import {
  getFrequentlyRestocked,
  recordConsumptionInterval,
  restockHistoryKey,
} from '../inventory/restockHistory.js';
import { filterKitchenStatusItems } from '../inventory/kitchenStatus.js';
import {
  buildConsumptionFields,
  filterPredictedLowItems,
  getConsumptionUrgencyLabel,
} from '../inventory/consumption.js';
import { flowEnterClass, getStepDirection } from '../utils/tabFlow.js';
import { MetaIcon } from '../components/MetaIcon.jsx';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Info,
  Loader2,
  Plus,
  Refrigerator,
  Rocket,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';

const ReceiptScanner = lazy(() =>
  import('../components/ReceiptScanner.jsx').then((m) => ({ default: m.ReceiptScanner })),
);
const ItemTypeahead = lazy(() =>
  import('../components/ItemTypeahead.jsx').then((m) => ({ default: m.ItemTypeahead })),
);

function TipBanner({ title, children, onDismiss, accentClass = 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40' }) {
  return (
    <div className={`mb-4 flex gap-3 rounded-xl border p-3 ${accentClass}`}>
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-heading text-sm font-semibold">{title}</p>
        <p className="text-muted mt-1 text-xs leading-relaxed">{children}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800"
        aria-label="Dismiss tip"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="surface-inset border-dashed px-6 py-10 text-center">
      {Icon && <Icon className="mx-auto mb-3 h-11 w-11 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />}
      <p className="text-heading text-sm font-semibold">{title}</p>
      <p className="text-muted mx-auto mt-2 max-w-xs text-xs leading-relaxed">{description}</p>
    </div>
  );
}

/** Group urgency rows by storage location so Fridge / Pantry / Freezer stay clear. */
function groupItemsByStorageCategory(items, itemType) {
  const categories = getCategoriesForItemType(itemType);
  return categories
    .map((cat) => {
      const groupItems = (items ?? [])
        .filter((item) => item.category === cat)
        .sort(sortByUrgencyThenName);
      return {
        subCategory: cat,
        meta: getCategoryMeta(cat, itemType) ?? { label: cat },
        items: groupItems,
      };
    })
    .filter((group) => group.items.length > 0);
}

function groupByCategory(items, category, itemType, selectedSubCategories = null) {
  const inType = items.filter(
    (item) => item.itemType === itemType && isInStockInventory(item),
  );
  const inCategory = inType.filter((item) => item.category === category);
  const filterBySub = (list) => {
    if (!selectedSubCategories || selectedSubCategories.size === 0) return list;
    return list.filter((item) =>
      selectedSubCategories.has(item.subCategory || SUBCATEGORY_OTHER),
    );
  };

  // Expired / expiring: every category in this module so nothing urgent is hidden
  // behind another storage tab. Sections stay hidden when the lists are empty.
  const expired = inType.filter(isExpired).sort(sortByUrgencyThenName);
  const expiring = inType.filter(isExpiringSoon).sort(sortByUrgencyThenName);
  const plentiful = filterBySub(
    inCategory
      .filter((item) => !isExpired(item) && !isExpiringSoon(item))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  return {
    expired,
    expiring,
    plentiful,
    expiredGroups: groupItemsByStorageCategory(expired, itemType),
    expiringGroups: groupItemsByStorageCategory(expiring, itemType),
    plentifulGroups: groupItemsBySubCategory(plentiful, itemType, category),
    subCategoryCounts: countItemsBySubCategory(inCategory, itemType, category),
  };
}

function getAddItemHeading(category, itemType) {
  const meta = getCategoryMeta(category, itemType);
  if (itemType === ITEM_TYPE.FOOD && category === FOOD_CATEGORY.AMBIENT) {
    return { title: 'Add to pantry', hint: 'Staples, spices, and shelf-stable goods' };
  }
  if (itemType === ITEM_TYPE.FOOD && category === FOOD_CATEGORY.FRESH) {
    return { title: 'Add to fridge', hint: 'Dairy, meat, produce, and chilled items' };
  }
  if (itemType === ITEM_TYPE.FOOD && category === FOOD_CATEGORY.FREEZER) {
    return { title: 'Add to freezer', hint: 'Frozen meals, veg, and desserts' };
  }
  if (meta) {
    return { title: `Add to ${meta.label.toLowerCase()}`, hint: meta.subtitle };
  }
  return { title: 'Add an item', hint: 'Track what your household has in stock' };
}

const DUPLICATE_INPUT_RING =
  'ring-2 ring-amber-300/45 border-amber-300/70 dark:ring-amber-700/35 dark:border-amber-800/50';

function DuplicateInventoryHint({ item, context = 'pantry' }) {
  if (!item) return null;

  const categoryMeta = getCategoryMeta(item.category, item.itemType);
  const storageLabel = categoryMeta?.label?.toLowerCase() ?? item.category;
  const statusLabel = (STATUS_META[getDisplayStatus(item)]?.label ?? 'In stock').toLowerCase();

  if (isOnShoppingList(item)) {
    return (
      <p
        role="status"
        className="animate-fade-in flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/40 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <span>
          <span className="font-semibold">{item.name}</span> is already on your shopping list.
          {context === 'pantry' ? ' Mark it bought in Shopping when you restock.' : ''}
        </span>
      </p>
    );
  }

  return (
    <p
      role="status"
      className="animate-fade-in flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/40 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <span>
        You already have <span className="font-semibold">{item.name}</span> in{' '}
        {storageLabel} ({statusLabel}).
        {context === 'pantry' ? ' Tap the item below to update it instead.' : ''}
      </span>
    </p>
  );
}

const STORAGE_LIST_HEADER_ACCENTS = {
  [FOOD_CATEGORY.AMBIENT]: {
    panel:
      'border-amber-200/90 bg-gradient-to-r from-amber-50 via-amber-50/80 to-white shadow-sm ring-1 ring-amber-200/50 dark:border-amber-900/55 dark:from-amber-950/50 dark:via-amber-950/30 dark:to-dm-card dark:ring-amber-900/40',
    title: 'text-amber-950 dark:text-amber-50',
    subtitle: 'text-amber-800/90 dark:text-amber-200/90',
    hint: 'text-amber-700/80 dark:text-amber-300/75',
    bar: 'border-l-amber-500',
  },
  [FOOD_CATEGORY.FRESH]: {
    panel:
      'border-sky-200/90 bg-gradient-to-r from-sky-50 via-sky-50/80 to-white shadow-sm ring-1 ring-sky-200/50 dark:border-sky-900/55 dark:from-sky-950/50 dark:via-sky-950/30 dark:to-dm-card dark:ring-sky-900/40',
    title: 'text-sky-950 dark:text-sky-50',
    subtitle: 'text-sky-800/90 dark:text-sky-200/90',
    hint: 'text-sky-700/80 dark:text-sky-300/75',
    bar: 'border-l-sky-500',
  },
  [FOOD_CATEGORY.FREEZER]: {
    panel:
      'border-cyan-200/90 bg-gradient-to-r from-cyan-50 via-cyan-50/80 to-white shadow-sm ring-1 ring-cyan-200/50 dark:border-cyan-900/55 dark:from-cyan-950/50 dark:via-cyan-950/30 dark:to-dm-card dark:ring-cyan-900/40',
    title: 'text-cyan-950 dark:text-cyan-50',
    subtitle: 'text-cyan-800/90 dark:text-cyan-200/90',
    hint: 'text-cyan-700/80 dark:text-cyan-300/75',
    bar: 'border-l-cyan-500',
  },
};

const DEFAULT_LIST_HEADER_ACCENT = {
  panel:
    'border-emerald-200/90 bg-gradient-to-r from-emerald-50 via-emerald-50/80 to-white shadow-sm ring-1 ring-emerald-200/50 dark:border-emerald-900/55 dark:from-emerald-950/50 dark:via-emerald-950/30 dark:to-dm-card dark:ring-emerald-900/40',
  title: 'text-emerald-950 dark:text-emerald-50',
  subtitle: 'text-emerald-800/90 dark:text-emerald-200/90',
  hint: 'text-emerald-700/80 dark:text-emerald-300/75',
  bar: 'border-l-emerald-500',
};

function getStorageListHeaderAccent(category, itemType) {
  if (itemType === ITEM_TYPE.FOOD && STORAGE_LIST_HEADER_ACCENTS[category]) {
    return STORAGE_LIST_HEADER_ACCENTS[category];
  }
  return DEFAULT_LIST_HEADER_ACCENT;
}

function InventorySectionHeader({ category, itemType, children }) {
  const meta = getCategoryMeta(category, itemType);
  if (!meta) return null;
  const accent = getStorageListHeaderAccent(category, itemType);

  return (
    <div
      className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-l-[5px] px-4 py-3.5 ${accent.bar} ${accent.panel}`}
    >
      <div className="min-w-0 flex-1">
        <h2
          className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-base font-extrabold leading-tight tracking-tight sm:text-lg ${accent.title}`}
        >
          <span className="inline-flex text-xl leading-none" aria-hidden>
            <MetaIcon name={meta.label} className="h-5 w-5" />
          </span>
          <span>{meta.label}</span>
          <span className={`text-sm font-bold sm:text-base ${accent.subtitle}`}>
            — {meta.subtitle}
          </span>
        </h2>
        <p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${accent.hint}`}>
          Showing this storage area
        </p>
      </div>
      {children}
    </div>
  );
}

function groupShoppingList(items, enabledModules) {
  return items
    .filter(
      (item) =>
        isOnShoppingList(item) && isItemTypeEnabled(enabledModules, item.itemType),
    )
    .sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      if (cat !== 0) return cat;
      return a.name.localeCompare(b.name);
    });
}

function ItemEditorSheet({ item, onSave, onClose, enabledModules }) {
  const [needToBuy, setNeedToBuy] = useState(isOnShoppingList(item));
  const enabledTypes = getEnabledItemTypes(enabledModules);
  const initialType = enabledTypes.includes(item.itemType)
    ? item.itemType
    : enabledTypes[0] ?? ITEM_TYPE.FOOD;
  const [itemType, setItemType] = useState(initialType);
  const [category, setCategory] = useState(item.category);
  const [subCategory, setSubCategory] = useState(
    item.subCategory ?? resolveSubCategory(item.name, item.itemType, item.category),
  );
  const [hasExpiry, setHasExpiry] = useState(Boolean(item.expiryDate));
  const [expiryDate, setExpiryDate] = useState(item.expiryDate ?? '');
  const [quantity, setQuantity] = useState(item.quantity ?? 1);
  const [unit, setUnit] = useState(item.unit ?? '');
  const [isLow, setIsLow] = useState(Boolean(item.isLow));
  const expiringHint = !needToBuy && hasExpiry && expiryDate && isExpiringSoon({
    ...item,
    status: STATUS.FRESH,
    expiryDate,
  });
  const expiredHint = !needToBuy && hasExpiry && expiryDate && isExpired({
    ...item,
    status: STATUS.FRESH,
    expiryDate,
  });

  const handleItemTypeChange = (nextType) => {
    setItemType(nextType);
    const options = getCategoriesForItemType(nextType);
    if (!options.includes(category)) {
      const nextCategory = defaultCategoryForItemType(nextType);
      setCategory(nextCategory);
      setSubCategory(resolveSubCategory(item.name, nextType, nextCategory));
      return;
    }
    setSubCategory(resolveSubCategory(item.name, nextType, category));
  };

  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);
    setSubCategory(resolveSubCategory(item.name, itemType, nextCategory));
  };

  const handleSave = () => {
    const { quantity: nextQuantity, unit: nextUnit } = normalizeAmbientQuantityFields({
      name: item.name,
      itemType,
      category,
      quantity: Number(quantity) > 0 ? Number(quantity) : 1,
      unit: unit.trim(),
    });
    onSave({
      status: needToBuy ? STATUS.OUT : STATUS.FRESH,
      itemType,
      category,
      subCategory,
      expiryDate: hasExpiry && expiryDate ? expiryDate : null,
      quantity: nextQuantity,
      unit: nextUnit,
      isLow,
      storageLocation: inferStorageLocation(category, item.foodGroup, item.storageLocation),
    });
    onClose();
  };

  const shelfQuantityPreview = formatInventoryQuantityLabel({
    name: item.name,
    itemType,
    category,
    quantity: Number(quantity) > 0 ? Number(quantity) : 1,
    unit: unit.trim(),
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-editor-title"
    >
      <div
        className="surface-card max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="item-editor-title" className="text-heading text-lg font-bold">
              {item.name}
            </h3>
            <p className="text-muted mt-1 text-sm">
              Storage, expiry date, and shopping list
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
          Item type
        </p>
        <div
          className={`mb-3 grid gap-1 rounded-xl border border-black/[0.08] bg-lm-inset p-1 dark:border-white/10 dark:bg-dm-inset ${getModuleGridClass(getEnabledModuleList(enabledModules).length)}`}
        >
          {getEnabledModuleList(enabledModules).map((mod) => (
            <button
              key={mod.key}
              type="button"
              onClick={() => handleItemTypeChange(mod.itemType)}
              className={`rounded-lg px-1 py-2 text-xs font-bold transition active:scale-95 ${
                itemType === mod.itemType
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200/80 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              <MetaIcon name={mod.key} className="mr-0.5 inline h-3.5 w-3.5" /> {mod.label.split(' ')[0]}
            </button>
          ))}
        </div>
        <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
          Storage
        </p>
        <div className="mb-4">
          <StorageCategoryToggle itemType={itemType} value={category} onChange={handleCategoryChange} />
        </div>
        <div className="mb-4">
          <SubCategoryToggle
            itemType={itemType}
            category={category}
            value={subCategory}
            onChange={setSubCategory}
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <label className="text-muted mb-1 block text-xs font-semibold uppercase tracking-wide">
              Quantity
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-xs font-semibold uppercase tracking-wide">
              Unit
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={
                itemType === ITEM_TYPE.FOOD && category === FOOD_CATEGORY.AMBIENT
                  ? 'g or ml (total)'
                  : 'g, ml, pack'
              }
              className="input-field"
            />
          </div>
        </div>
        {itemType === ITEM_TYPE.FOOD && category === FOOD_CATEGORY.AMBIENT && shelfQuantityPreview && (
          <p className="text-muted -mt-2 mb-4 text-xs">
            Shown on shelf as <span className="font-semibold">{shelfQuantityPreview}</span>
          </p>
        )}

        <label className="surface-inset mb-4 flex cursor-pointer items-center gap-2 px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={isLow}
            onChange={(e) => setIsLow(e.target.checked)}
            className="h-4 w-4 rounded border-black/15 bg-lm-raised text-orange-600 focus:ring-orange-500 dark:border-white/20 dark:bg-dm-raised"
          />
          Mark as running low
        </label>

        <label className="surface-inset mb-3 flex cursor-pointer items-center gap-2 px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={needToBuy}
            onChange={(e) => setNeedToBuy(e.target.checked)}
            className="h-4 w-4 rounded border-black/15 bg-lm-raised text-sky-600 focus:ring-sky-500 dark:border-white/20 dark:bg-dm-raised"
          />
          Add to shopping list (need to buy)
        </label>

        {itemType === ITEM_TYPE.FOOD && (
          <>
            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hasExpiry}
                onChange={(e) => setHasExpiry(e.target.checked)}
                className="h-4 w-4 rounded border-black/15 bg-lm-raised text-emerald-600 focus:ring-emerald-500 dark:border-white/20 dark:bg-dm-raised"
              />
              Set expiry date
            </label>
            {hasExpiry && (
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="input-field mb-3"
              />
            )}
          </>
        )}
        {expiredHint && (
          <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            This date is in the past — it will show under Expired on every storage tab.
          </p>
        )}
        {expiringHint && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            This date is within {EXPIRING_SOON_DAYS} days — it will show under Expiring Soon
            on every storage tab.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const PREDICTED_LOW_ACTION_BTN =
  'touch-manipulation relative z-10 select-none transition active:scale-[0.98]';

function PredictedLowCard({ item, restockHistory, onRestock, onStillGotIt, onDelete }) {
  const urgencyLabel = getConsumptionUrgencyLabel(item, restockHistory);
  const catMeta = getCategoryMeta(item.category, item.itemType);

  return (
    <article className="surface-card flex w-[min(100%,18rem)] shrink-0 snap-start flex-col gap-3 rounded-xl border border-orange-200/90 p-3 shadow-sm dark:border-orange-800/60">
      <div className="min-w-0">
        <p className="text-heading line-clamp-2 text-sm font-bold leading-snug">{item.name}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-orange-800 dark:text-orange-300">
          {urgencyLabel}
        </p>
        {catMeta && (
          <p className="text-muted mt-1 flex items-center gap-1 text-[10px]">
            <MetaIcon name={catMeta.label} className="h-3 w-3" /> {catMeta.label}
          </p>
        )}
      </div>
      <div className="relative z-10 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onRestock(item)}
          className={`flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 text-xs font-bold text-white ${PREDICTED_LOW_ACTION_BTN} ${SHOPPING_ACCENT.btn}`}
        >
          <ShoppingCart className="h-5 w-5" aria-hidden />
          Restock
        </button>
        <button
          type="button"
          onClick={() => onStillGotIt(item)}
          className={`flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-orange-300 bg-orange-50 py-2.5 text-xs font-bold text-orange-900 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200 dark:hover:bg-orange-950 ${PREDICTED_LOW_ACTION_BTN}`}
        >
          <Check className="h-5 w-5" aria-hidden />
          Still Got It
        </button>
      </div>
      <button
        type="button"
        onClick={() => onDelete(item)}
        className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 ${PREDICTED_LOW_ACTION_BTN}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete — I&apos;m done with this
      </button>
    </article>
  );
}

function PredictedLowBanner({ items, restockHistory, onRestock, onStillGotIt, onDelete, onDismiss }) {
  const [pendingKeys, setPendingKeys] = useState(() => new Set());

  const itemKey = useCallback(
    (item) => `${getItemId(item)}|${normalizeName(item.name)}|${item.itemType}`,
    [],
  );

  const visibleItems = useMemo(
    () => items.filter((item) => !pendingKeys.has(itemKey(item))),
    [items, pendingKeys, itemKey],
  );

  const runAction = useCallback(
    (fn, item) => {
      const key = itemKey(item);
      setPendingKeys((prev) => new Set(prev).add(key));
      fn(item);
    },
    [itemKey],
  );

  if (visibleItems.length === 0) return null;

  return (
    <section className="mb-4 rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50/90 p-4 dark:border-orange-700 dark:from-orange-950/40 dark:to-amber-950/30">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-heading flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-orange-900 dark:text-orange-200">
            <FlaskConical className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
            Predicted to be Running Low
          </h2>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            Based on how long items usually last in your household. After you restock or run out twice, timings personalize (~85% used).
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {visibleItems.length}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/70 hover:text-slate-800 dark:hover:bg-orange-950 dark:hover:text-slate-200"
            aria-label="Hide Predicted to be Running Low section"
            title="Hide"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
        {visibleItems.map((item) => (
          <PredictedLowCard
            key={itemKey(item)}
            item={item}
            restockHistory={restockHistory}
            onRestock={(entry) => runAction(onRestock, entry)}
            onStillGotIt={(entry) => runAction(onStillGotIt, entry)}
            onDelete={(entry) => runAction(onDelete, entry)}
          />
        ))}
      </div>
    </section>
  );
}

function KitchenStatusBanner({ items, onFinished, onRestock, onDismiss }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 p-4 dark:border-amber-700 dark:from-amber-950/50 dark:to-orange-950/30">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-heading flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            Kitchen Status
          </h2>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            Use up soon or running low — finish it or send to your shopping list.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {items.length}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/70 hover:text-slate-800 dark:hover:bg-amber-950 dark:hover:text-slate-200"
            aria-label="Remove Kitchen Status section"
            title="Remove"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      <div className="touch-pan-x flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
        {items.map((item) => (
          <KitchenStatusCard
            key={item.id}
            item={item}
            onFinished={onFinished}
            onRestock={onRestock}
          />
        ))}
      </div>
    </section>
  );
}

function FrequentlyRestockedSection({ suggestions, onAdd }) {
  const [open, setOpen] = useState(false);

  if (suggestions.length === 0) return null;

  return (
    <section className={`surface-card mb-5 overflow-hidden border-2 p-4 ${SHOPPING_ACCENT.borderSoft}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left active:scale-[0.99]"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <h2 className={`text-sm font-bold uppercase tracking-wide ${SHOPPING_ACCENT.textLabel}`}>
            Frequently Restocked
          </h2>
          {!open && (
            <p className="text-muted mt-1 text-xs leading-relaxed">
              {suggestions.length} household favourite{suggestions.length === 1 ? '' : 's'} — tap + to
              re-add
            </p>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
        )}
      </button>

      {open && (
        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-600">
          <p className="text-muted mb-3 text-xs leading-relaxed">
            Items you&apos;ve bought or removed before. Tap + to put them back on your shopping list.
          </p>
          <ul className="space-y-2">
            {suggestions.map((entry) => {
              const meta = getCategoryMeta(entry.category, entry.itemType);
              return (
                <li
                  key={restockHistoryKey(entry)}
                  className="surface-inset flex items-center gap-2 rounded-xl px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-heading truncate text-sm font-medium">{entry.name}</p>
                    <p className="text-muted mt-0.5 flex items-center gap-1 text-[10px]">
                      {meta ? <MetaIcon name={meta.label} className="h-3 w-3" /> : null} {meta?.label}
                      {entry.count > 1 ? ` · restocked ${entry.count}×` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdd(entry)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow active:scale-95 ${SHOPPING_ACCENT.btn}`}
                    aria-label={`Add ${entry.name} to shopping list`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function InventorySection({ title, iconName, accent, itemCount, children, emptyText, grouped = false }) {
  return (
    <section className="mb-5">
      <h2 className={`mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${accent}`}>
        {iconName ? <MetaIcon name={iconName} className="h-4 w-4" /> : null}
        {title}
      </h2>
      {itemCount > 0 ? (
        grouped ? (
          <div className="space-y-4">{children}</div>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )
      ) : (
        <p className="surface-inset border-dashed px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function StorageLocationTabs({
  enabledModules,
  inventoryScope,
  onScopeChange,
  activeView,
  onCategoryChange,
}) {
  const modules = getEnabledModuleList(enabledModules);
  const scopeItemType = getItemTypeForModule(inventoryScope);
  const categoryOptions = getCategoriesForItemType(scopeItemType);

  return (
    <div className="mb-5 space-y-2">
      <div
        className={`scope-segment grid gap-2 ${getModuleGridClass(modules.length)}`}
        role="tablist"
        aria-label="Household modules"
      >
        {modules.map((mod) => {
          const active = inventoryScope === mod.key;
          return (
            <button
              key={mod.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onScopeChange(mod.key)}
              className={`scope-tab-btn rounded-xl border px-2 py-2.5 text-center text-sm font-bold active:scale-[0.98] ${
                active
                  ? 'scope-tab-btn--active border-emerald-300 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500'
                  : 'border-black/[0.08] bg-lm-raised text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-dm-raised dark:text-zinc-400'
              }`}
            >
              <span className="scope-tab-btn__emoji flex justify-center" aria-hidden>
                <MetaIcon name={mod.key} className="h-5 w-5" />
              </span>
              <span className="text-heading mt-0.5 block text-[11px] leading-tight">{mod.label}</span>
            </button>
          );
        })}
      </div>
      <div
        className="storage-segment grid grid-cols-3 gap-2"
        role="tablist"
        aria-label="Storage location"
      >
        {categoryOptions.map((cat) => {
          const meta = getCategoryMeta(cat, scopeItemType);
          const active = activeView === cat;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onCategoryChange(cat)}
              className={`storage-tab-btn rounded-xl border px-2 py-3 text-center active:scale-[0.98] ${
                active
                  ? `storage-tab-btn--active ${meta.tabActive} border-transparent ring-2 ring-offset-1 ring-slate-400/50 dark:ring-offset-slate-900`
                  : `border-black/[0.08] bg-lm-raised dark:border-white/10 dark:bg-dm-raised ${meta.tabIdle}`
              }`}
            >
              <span className="storage-tab-btn__emoji flex justify-center" aria-hidden>
                <MetaIcon name={meta.label} className="h-5 w-5" />
              </span>
              <p className="text-heading mt-1 text-xs font-bold">{meta.label}</p>
              <p className="text-muted text-[10px]">{meta.subtitle}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InventoryView({
  mode,
  items,
  updateItems,
  patchItems,
  replaceItemsFromServer,
  restockHistory,
  updateRestockHistory,
  itemKnowledge,
  updateItemKnowledge,
  recordUsageEvent,
  syncUsageInsights,
  onboarding,
  enabledModules,
  offlineMode = false,
}) {
  const isShoppingPage = mode === 'shopping';
  const { isDismissed, dismiss } = onboarding;
  const defaultModuleKey = getDefaultModuleKey(enabledModules);
  const [inventoryScope, setInventoryScope] = useState(defaultModuleKey);
  const [inventoryFlowDir, setInventoryFlowDir] = useState(0);
  const [draft, setDraft] = useState('');
  const [addItemType, setAddItemType] = useState(getItemTypeForModule(defaultModuleKey));
  const [addCategory, setAddCategory] = useState(getInitialCategoryForModule(defaultModuleKey));
  const [addSubCategory, setAddSubCategory] = useState(() =>
    resolveSubCategory('', getItemTypeForModule(defaultModuleKey), getInitialCategoryForModule(defaultModuleKey)),
  );
  const [addExpiry, setAddExpiry] = useState(false);
  const [addExpiryDate, setAddExpiryDate] = useState('');
  const [shopDraft, setShopDraft] = useState('');
  const [shopItemType, setShopItemType] = useState(getItemTypeForModule(defaultModuleKey));
  const [shopCategory, setShopCategory] = useState(getInitialCategoryForModule(defaultModuleKey));
  const [activeView, setActiveView] = useState(getInitialCategoryForModule(defaultModuleKey));
  const [subCategoryFilters, setSubCategoryFilters] = useState(() => new Set());
  const [editingItem, setEditingItem] = useState(null);
  const [pingBusy, setPingBusy] = useState(false);
  const [pingFeedback, setPingFeedback] = useState(null);
  const pingInFlightRef = useRef(false);
  const [showAddAdvanced, setShowAddAdvanced] = useState(false);
  const [showShoppingAdvanced, setShowShoppingAdvanced] = useState(false);
  const [shopFeedback, setShopFeedback] = useState(null);
  const [stockingId, setStockingId] = useState(null);
  const [receiptFeedback, setReceiptFeedback] = useState(null);
  const [addItemBusy, setAddItemBusy] = useState(false);
  const [shopItemBusy, setShopItemBusy] = useState(false);
  const scopeItemType = getItemTypeForModule(inventoryScope);

  const shoppingList = useMemo(
    () => groupShoppingList(items, enabledModules),
    [items, enabledModules],
  );

  const frequentlyRestocked = useMemo(
    () => getFrequentlyRestocked(restockHistory, items, enabledModules, 10),
    [restockHistory, items, enabledModules],
  );

  const kitchenStatusItems = useMemo(
    () => filterKitchenStatusItems(items, enabledModules, EXPIRING_SOON_DAYS),
    [items, enabledModules],
  );

  const predictedLowItems = useMemo(
    () => filterPredictedLowItems(items, enabledModules, restockHistory),
    [items, enabledModules, restockHistory],
  );

  const categoryGrouped = useMemo(() => {
    if (isShoppingPage) return null;
    return groupByCategory(items, activeView, scopeItemType, subCategoryFilters);
  }, [items, activeView, scopeItemType, isShoppingPage, subCategoryFilters]);

  useEffect(() => {
    setSubCategoryFilters(new Set());
  }, [activeView, inventoryScope]);

  useEffect(() => {
    if (isShoppingPage) return;
    setAddCategory(activeView);
  }, [activeView, isShoppingPage]);

  const addItemHeading = useMemo(
    () => getAddItemHeading(addCategory, addItemType),
    [addCategory, addItemType],
  );

  const addDuplicateMatch = useMemo(() => {
    const name = draft.trim();
    if (!name || name === BARCODE_LOOKUP_LOADING_TEXT) return null;
    return findInventoryItem(items, name, addItemType);
  }, [draft, items, addItemType]);

  const shopListDuplicate = useMemo(() => {
    const name = shopDraft.trim();
    if (!name) return null;
    const existing = findInventoryItem(items, name, shopItemType);
    return existing && isOnShoppingList(existing) ? existing : null;
  }, [shopDraft, items, shopItemType]);

  const toggleSubCategoryFilter = useCallback((subCategory) => {
    setSubCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(subCategory)) next.delete(subCategory);
      else next.add(subCategory);
      return next;
    });
  }, []);

  const clearSubCategoryFilters = useCallback(() => {
    setSubCategoryFilters(new Set());
  }, []);

  useEffect(() => {
    const resolved = resolveModuleKey(enabledModules, inventoryScope);
    if (resolved !== inventoryScope) {
      setInventoryScope(resolved);
      const type = getItemTypeForModule(resolved);
      setAddItemType(type);
      setAddCategory(defaultCategoryForItemType(type));
      if (!isShoppingPage) {
        setActiveView(defaultCategoryForItemType(type));
      }
    }
  }, [enabledModules, inventoryScope, activeView, isShoppingPage]);

  const handleScopeChange = (nextModuleKey) => {
    const moduleOrder = getEnabledModuleList(enabledModules).map((mod) => mod.key);
    setInventoryFlowDir(getStepDirection(moduleOrder, inventoryScope, nextModuleKey));
    setInventoryScope(nextModuleKey);
    const nextType = getItemTypeForModule(nextModuleKey);
    if (!isShoppingPage) {
      const options = getCategoriesForItemType(nextType);
      if (!options.includes(activeView)) {
        setActiveView(defaultCategoryForItemType(nextType));
      }
    }
    const nextCategory = defaultCategoryForItemType(nextType);
    setAddItemType(nextType);
    setAddCategory(nextCategory);
    setAddSubCategory(resolveSubCategory(draft, nextType, nextCategory));
  };

  const handleCategoryChange = (nextCategory) => {
    const options = getCategoriesForItemType(scopeItemType);
    setInventoryFlowDir(getStepDirection(options, activeView, nextCategory));
    setActiveView(nextCategory);
  };

  const suggestAddExpiry = useCallback((name, itemType, category, subCategory) => {
    if (itemType !== ITEM_TYPE.FOOD) return null;
    const trimmed = String(name || '').trim();
    if (!trimmed || trimmed === BARCODE_LOOKUP_LOADING_TEXT) return null;
    return guessExpiryForItem({
      name: trimmed,
      itemType,
      category,
      subCategory,
    }).expiryDate;
  }, []);

  const applySuggestion = (entry, target) => {
    const sub =
      entry.subCategory ?? resolveSubCategory(entry.name, entry.itemType, entry.category);
    if (target === 'add') {
      setAddItemType(entry.itemType);
      setAddCategory(entry.category);
      setAddSubCategory(sub);
      if (entry.itemType !== ITEM_TYPE.FOOD) {
        setAddExpiry(false);
        setAddExpiryDate('');
      }
    } else {
      setShopItemType(entry.itemType);
      setShopCategory(entry.category);
    }
  };

  const applySmartClassification = useCallback(
    (name, target) => {
      const trimmed = String(name || '').trim();
      if (!trimmed || trimmed === BARCODE_LOOKUP_LOADING_TEXT) return;

      const knowledgeHit = findItemKnowledgeByName(itemKnowledge, trimmed, enabledModules);
      if (knowledgeHit) {
        if (target === 'add') {
          setAddItemType(knowledgeHit.itemType);
          setAddCategory(knowledgeHit.category);
          setAddSubCategory(knowledgeHit.subCategory);
        } else {
          setShopItemType(knowledgeHit.itemType);
          setShopCategory(knowledgeHit.category);
        }
        return;
      }

      const hit = classifyItem(trimmed);
      if (!hit) {
        if (target === 'add') {
          setAddSubCategory(resolveSubCategory(trimmed, addItemType, addCategory));
        }
        return;
      }

      if (target === 'add') {
        setAddItemType(hit.itemType ?? ITEM_TYPE.FOOD);
        setAddCategory(hit.category);
        setAddSubCategory(hit.subCategory);
      } else {
        setShopItemType(hit.itemType ?? ITEM_TYPE.FOOD);
        setShopCategory(hit.category);
      }
    },
    [addCategory, addItemType, enabledModules, itemKnowledge, shopItemType],
  );

  const handleKnowledgeUpdate = useCallback(
    (nextKnowledge, usageInsights) => {
      updateItemKnowledge(nextKnowledge);
      if (usageInsights) {
        syncUsageInsights?.(usageInsights);
      }
    },
    [updateItemKnowledge, syncUsageInsights],
  );

  const handleDraftChange = useCallback(
    (value) => {
      setDraft(value);
      applySmartClassification(value, 'add');
    },
    [applySmartClassification],
  );

  const handleShopDraftChange = useCallback(
    (value) => {
      setShopDraft(value);
      applySmartClassification(value, 'shop');
    },
    [applySmartClassification],
  );

  const handleBarcodeResolved = (result) => {
    if (!result) {
      recordUsageEvent?.('barcodeUnknown');
      return;
    }

    const classified = classifyItem(result.name);
    const entry = {
      name: result.name,
      itemType: classified?.itemType ?? result.itemType,
      category: classified?.category ?? result.category,
      subCategory:
        classified?.subCategory ??
        result.subCategory ??
        resolveSubCategory(result.name, result.itemType, result.category),
    };

    applySuggestion(entry, 'add');

    if (entry.itemType === ITEM_TYPE.FOOD && result.suggestedExpiryDate) {
      setAddExpiry(true);
      setAddExpiryDate(result.suggestedExpiryDate);
      setShowAddAdvanced(true);
    }

    const mod = getEnabledModuleList(enabledModules).find(
      (m) => m.itemType === entry.itemType,
    );
    if (mod) {
      setInventoryScope(mod.key);
      if (!isShoppingPage) {
        setActiveView(entry.category);
      }
    }
  };

  const resetAddForm = () => {
    setDraft('');
    setAddItemType(scopeItemType);
    const nextCategory = defaultCategoryForItemType(scopeItemType);
    setAddCategory(nextCategory);
    setAddSubCategory(resolveSubCategory('', scopeItemType, nextCategory));
    setAddExpiry(false);
    setAddExpiryDate('');
  };

  const addItem = async (e) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || name === BARCODE_LOOKUP_LOADING_TEXT || addItemBusy) return;
    const existing = findInventoryItem(items, name, addItemType);
    if (existing) return;

    setAddItemBusy(true);
    try {
      const resolved = await resolveItemClassification({
        name,
        preferredItemType: addItemType,
        itemKnowledge,
        classifyFn: classifyInventoryItem,
        remember: true,
      });

      if (resolved.itemKnowledge) {
        updateItemKnowledge(resolved.itemKnowledge);
      }
      if (resolved.usageInsights) {
        syncUsageInsights?.(resolved.usageInsights);
      }

      const nextType = resolved.itemType ?? addItemType;
      const nextCategory = resolved.category ?? addCategory;
      const nextSubCategory =
        resolved.subCategory ?? resolveSubCategory(name, nextType, nextCategory);
      let nextExpiry =
        nextType === ITEM_TYPE.FOOD && addExpiry && addExpiryDate ? addExpiryDate : null;
      if (!nextExpiry && resolved.expiryDate) {
        nextExpiry = resolved.expiryDate;
      }

      const consumption = {
        ...buildConsumptionFields(
          { name, itemType: nextType, category: nextCategory },
          { restockHistory },
        ),
        ...(resolved.consumptionDurationDays
          ? {
              consumptionDuration: resolved.consumptionDurationDays,
              consumptionLearned: true,
            }
          : {}),
      };

      updateItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name,
          itemType: nextType,
          status: STATUS.FRESH,
          category: nextCategory,
          subCategory: nextSubCategory,
          expiryDate: nextExpiry,
          storageLocation: inferStorageLocation(nextCategory, null, null),
          ...consumption,
        },
      ]);
      recordUsageEvent?.('itemAdded');
      resetAddForm();
      if (!isShoppingPage) {
        setActiveView(nextCategory);
        const mod = MODULE_DEFINITIONS.find((m) => m.itemType === nextType);
        if (mod) setInventoryScope(mod.key);
      }
    } finally {
      setAddItemBusy(false);
    }
  };

  const addShoppingItem = async (e) => {
    e.preventDefault();
    const name = shopDraft.trim();
    if (!name || shopItemBusy) return;
    setShopFeedback(null);
    setShopItemBusy(true);
    try {
      const resolved = await resolveItemClassification({
        name,
        preferredItemType: shopItemType,
        itemKnowledge,
        classifyFn: classifyInventoryItem,
        remember: true,
      });

      if (resolved.itemKnowledge) {
        updateItemKnowledge(resolved.itemKnowledge);
      }
      if (resolved.usageInsights) {
        syncUsageInsights?.(resolved.usageInsights);
      }

      const result = await addShoppingListItemApi({
        name,
        itemType: resolved.itemType ?? shopItemType,
        category: resolved.category ?? shopCategory,
        quantity: 1,
      });
      replaceItemsFromServer(result.items, {
        inventoryRevision: result.inventoryRevision,
      });
      if (result.warnings?.length) {
        setShopFeedback({
          type: 'info',
          text: result.warnings.map((warning) => warning.message).join(' '),
        });
      }
      setShopDraft('');
    } catch (err) {
      setShopFeedback({
        type: 'error',
        text: err.message || 'Could not add to shopping list.',
      });
    } finally {
      setShopItemBusy(false);
    }
  };

  const markItemStocked = async (id) => {
    const item = items.find((entry) => entry.id === id);
    setShopFeedback(null);
    setStockingId(id);
    try {
      const result = await markShoppingItemPurchased(id, { applyExpiry: true });
      replaceItemsFromServer(result.items, {
        restockHistory: result.restockHistory,
        inventoryRevision: result.inventoryRevision,
      });
      setShopFeedback({
        type: 'success',
        text: `${item?.name ?? 'Item'} added to your Fridge with an estimated expiry date.`,
      });
    } catch (err) {
      setShopFeedback({
        type: 'error',
        text: err.message || 'Could not move item to inventory.',
      });
    } finally {
      setStockingId(null);
    }
  };

  const saveItemEdits = (id, updates) => {
    const item = items.find((entry) => entry.id === id);
    const merged = item ? { ...item, ...updates } : updates;
    const { quantity, unit } = normalizeAmbientQuantityFields(merged);
    const normalizedUpdates = { ...updates, quantity, unit };
    updateItems((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...normalizedUpdates } : entry)),
    );
    if (item) {
      updateItemKnowledge((prev) => recordUserItemCorrection(prev, item, updates));
      recordUsageEvent?.('itemUserCorrected');
    }
  };

  const rememberDepletion = (item) => {
    if (!item) return;
    updateRestockHistory((prev) => recordConsumptionInterval(prev, item));
  };

  const deleteItem = (id, { trackHistory = false } = {}) => {
    const item = items.find((entry) => entry.id === id);
    if (trackHistory && item) rememberDepletion(item);
    updateItems((prev) => prev.filter((entry) => entry.id !== id));
  };

  const moveItemToShoppingList = (id) => {
    updateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: STATUS.OUT } : item)),
    );
  };

  const predictiveRestock = useCallback(
    (item) => {
      recordUsageEvent?.('predictedLowRestock');
      void patchItems(
        (prev) => {
          const target = findInventoryItem(prev, item);
          if (!target) return prev;
          return {
            items: prev.map((entry) =>
              findInventoryItem([entry], target)
                ? { ...entry, status: STATUS.OUT }
                : entry,
            ),
            depletionFrom: target,
          };
        },
        { saveNow: true },
      );
    },
    [patchItems, recordUsageEvent],
  );

  const resetConsumptionTimer = useCallback(
    (item) => {
      const now = new Date().toISOString();
      void patchItems((prev) => {
        const target = findInventoryItem(prev, item);
        if (!target) return prev;
        return prev.map((entry) =>
          findInventoryItem([entry], target)
            ? { ...entry, stockedAt: now, createdAt: now, status: STATUS.FRESH }
            : entry,
        );
      }, { saveNow: true });
    },
    [patchItems],
  );

  const predictiveDelete = useCallback(
    (item) => {
      void patchItems(
        (prev) => {
          const target = findInventoryItem(prev, item);
          if (!target) return prev;
          return {
            items: prev.filter((entry) => !findInventoryItem([entry], target)),
            depletionFrom: target,
          };
        },
        { saveNow: true },
      );
    },
    [patchItems],
  );

  const addRestockEntryToShoppingList = (entry) => {
    const needle = normalizeName(entry.name);
    updateItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) => normalizeName(item.name) === needle && item.itemType === entry.itemType,
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          status: STATUS.OUT,
          category: entry.category,
          preferredStore: entry.preferredStore ?? next[existingIdx].preferredStore ?? null,
        };
        return next;
      }
      const consumption = buildConsumptionFields(
        {
          name: entry.name,
          itemType: entry.itemType,
          category: entry.category,
        },
        { restockHistory },
      );
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: entry.name,
          itemType: entry.itemType,
          status: STATUS.OUT,
          category: entry.category,
          expiryDate: null,
          preferredStore: entry.preferredStore ?? null,
          ...consumption,
        },
      ];
    });
  };

  const updatePreferredStore = (id, store) => {
    updateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, preferredStore: store } : item)),
    );
  };

  const pingPartner = async () => {
    if (pingInFlightRef.current) return;
    pingInFlightRef.current = true;
    setPingBusy(true);
    setPingFeedback(null);
    try {
      const result = await pingShoppingList();
      setPingFeedback({
        type: result.sent > 0 ? 'success' : 'info',
        text: result.message || 'Notification sent to your household.',
      });
    } catch (err) {
      setPingFeedback({
        type: 'error',
        text: err.message || 'Could not send notification.',
      });
    } finally {
      pingInFlightRef.current = false;
      setPingBusy(false);
    }
  };

  const handleSearchMoveToShopping = useCallback(
    (item) => {
      void patchItems((prev) => {
        const target = findInventoryItem(prev, item);
        if (!target) return prev;
        return {
          items: prev.map((entry) =>
            findInventoryItem([entry], target) ? { ...entry, status: STATUS.OUT } : entry,
          ),
          depletionFrom: target,
        };
      }, { saveNow: true });
    },
    [patchItems],
  );

  const handleSearchMarkStocked = useCallback(
    (item) => {
      const now = new Date().toISOString();
      void patchItems(
        (prev) => {
          const target = findInventoryItem(prev, item);
          if (!target) return prev;
          return {
            items: prev.map((entry) =>
              findInventoryItem([entry], target)
                ? { ...entry, status: STATUS.FRESH, stockedAt: now, createdAt: now }
                : entry,
            ),
            restockFrom: target,
          };
        },
        { saveNow: true },
      );
    },
    [patchItems],
  );

  const handleSearchDelete = useCallback(
    (item) => {
      void patchItems(
        (prev) => {
          const target = findInventoryItem(prev, item);
          if (!target) return prev;
          return {
            items: prev.filter((entry) => !findInventoryItem([entry], target)),
            depletionFrom: target,
          };
        },
        { saveNow: true },
      );
    },
    [patchItems],
  );

  return (
    <div className="pb-28">
      <header className="mb-4">
        <h1 className="text-heading flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          {isShoppingPage ? (
            <>
              <ShoppingCart className={`h-7 w-7 shrink-0 ${SHOPPING_ACCENT.text}`} aria-hidden />
              Shopping List
            </>
          ) : (
            <>
              <Refrigerator className="h-7 w-7 shrink-0 text-emerald-600" aria-hidden />
              Fridge
            </>
          )}
        </h1>
        <p className="text-muted mt-1.5 text-sm leading-relaxed">
          {isShoppingPage
            ? 'Shared list for your household — tap Add to pantry when you have bought an item.'
            : `Track food & supplies · expiring within ${EXPIRING_SOON_DAYS} days`}
        </p>
        {offlineMode ? (
          <p
            className="mt-2 inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
            role="status"
          >
            Offline Mode — Showing cached inventory
          </p>
        ) : null}
      </header>

      <InventorySearch
        items={items}
        enabledModules={enabledModules}
        onMoveToShopping={handleSearchMoveToShopping}
        onMarkStocked={handleSearchMarkStocked}
        onDelete={handleSearchDelete}
        onEdit={setEditingItem}
      />

      {!isShoppingPage && (
        <>
          {!isDismissed('predicted-low') && (
            <PredictedLowBanner
              items={predictedLowItems}
              restockHistory={restockHistory}
              onRestock={predictiveRestock}
              onStillGotIt={resetConsumptionTimer}
              onDelete={predictiveDelete}
              onDismiss={() => dismiss('predicted-low')}
            />
          )}
          {!isDismissed('kitchen-status') && (
            <KitchenStatusBanner
              items={kitchenStatusItems}
              onFinished={(id) => deleteItem(id, { trackHistory: true })}
              onRestock={moveItemToShoppingList}
              onDismiss={() => dismiss('kitchen-status')}
            />
          )}
        </>
      )}

      {!isDismissed('welcome') && (
        <TipBanner
          title="Welcome to your household fridge"
          onDismiss={() => dismiss('welcome')}
        >
          Search the top bar to find anything in stock or on the list. Type a name, scan a barcode,
          or use Scan receipt to add a whole shop. Pantry items show total grams or ml, not can
          counts. The app learns how long staples last and flags predicted-low items. Share your
          invite code in Settings so your partner stays in sync. If you clear everything by mistake,
          Settings can restore cleared items for 7 days. Need help? Open Support chat in Settings.
        </TipBanner>
      )}

      {!isDismissed('color-guide') && !isShoppingPage && (
        <ColorLegendCard onDismiss={() => dismiss('color-guide')} />
      )}

      {!isShoppingPage && (
        <StorageLocationTabs
          enabledModules={enabledModules}
          inventoryScope={inventoryScope}
          onScopeChange={handleScopeChange}
          activeView={activeView}
          onCategoryChange={handleCategoryChange}
        />
      )}

      <div
        key={isShoppingPage ? 'shopping' : `${inventoryScope}-${activeView}`}
        className={flowEnterClass(isShoppingPage ? 0 : inventoryFlowDir, 'animate-inventory')}
      >
      {isShoppingPage ? (
        <>
          {!isDismissed('shopping-tip') && (
            <TipBanner
              title="Your shared shopping list"
              accentClass="border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
              onDismiss={() => dismiss('shopping-tip')}
            >
              Add items with + (matching names merge, including from deals and recipes). After you
              buy something, tap <strong className="font-semibold">Add to pantry</strong> — it moves
              to Fridge with a suggested use-by date. Use Frequently restocked for usual staples,
              tap a store badge to remember where you buy it, then Ping partner for a reminder
              (no item names in the notification). Recipe suggestions and deals can also add missing
              items here automatically.
            </TipBanner>
          )}

          <form
            onSubmit={addShoppingItem}
            className={`surface-card mb-4 space-y-3 border-2 p-4 ${SHOPPING_ACCENT.borderSoft}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wide ${SHOPPING_ACCENT.textLabel}`}>
              Add to shopping list
            </p>
            <div className="relative flex gap-2">
              <Suspense fallback={<input className="input-field min-w-0 flex-1" disabled placeholder="Loading…" />}>
                <ItemTypeahead
                  value={shopDraft}
                  onChange={handleShopDraftChange}
                  onPick={(entry) => applySuggestion(entry, 'shop')}
                  onKnowledgeUpdate={handleKnowledgeUpdate}
                  enabledModules={enabledModules}
                  itemKnowledge={itemKnowledge}
                  preferredItemType={shopItemType}
                  placeholder='What do you need? (e.g. "Milk")'
                  inputClassName={`input-field min-w-0 flex-1 ${SHOPPING_ACCENT.focus}${
                    shopListDuplicate ? ` ${DUPLICATE_INPUT_RING}` : ''
                  }`}
                  id="shop-item-input"
                />
              </Suspense>
              <button
                type="submit"
                disabled={Boolean(shopListDuplicate) || shopItemBusy}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${SHOPPING_ACCENT.btn}`}
                aria-label={shopItemBusy ? 'Smart sorting item' : 'Add to shopping list'}
              >
                {shopItemBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </button>
            </div>
            <DuplicateInventoryHint item={shopListDuplicate} context="shopping" />
            <button
              type="button"
              onClick={() => setShowShoppingAdvanced((v) => !v)}
              className="text-muted text-left text-xs font-semibold"
            >
              {showShoppingAdvanced ? 'Hide options' : 'More options'}
            </button>
            {showShoppingAdvanced && (
              <div>
                <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                  Usually found in
                </p>
                <StorageCategoryToggle
                  itemType={shopItemType}
                  value={shopCategory}
                  onChange={setShopCategory}
                />
              </div>
            )}
          </form>

          <p className="text-muted mb-3 text-xs leading-relaxed">
            Tap a store badge to set where you buy each item — saved for your household.
          </p>

          {shopFeedback && (
            <p
              role="status"
              className={`mb-3 rounded-xl px-3 py-2 text-xs font-medium ${
                shopFeedback.type === 'error'
                  ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                  : shopFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
              }`}
            >
              {shopFeedback.text}
            </p>
          )}

          <InventorySection
            title="Shopping List — All Locations"
            iconName="shopping"
            accent={SHOPPING_ACCENT.section}
            itemCount={shoppingList.length}
            emptyText="Nothing to buy — tap + above to add items."
          >
            {shoppingList.map((item) => (
              <ShoppingListItemRow
                key={item.id}
                item={item}
                onOpenEditor={setEditingItem}
                onDelete={(id) => deleteItem(id, { trackHistory: true })}
                onGotIt={markItemStocked}
                onPreferredStoreChange={updatePreferredStore}
                stockingId={stockingId}
              />
            ))}
          </InventorySection>

          <FrequentlyRestockedSection
            suggestions={frequentlyRestocked}
            onAdd={addRestockEntryToShoppingList}
          />

          <button
            type="button"
            onClick={pingPartner}
            disabled={pingBusy}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-60 ${SHOPPING_ACCENT.btn}`}
          >
            {pingBusy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Rocket className="h-5 w-5" aria-hidden />
            )}
            {pingBusy ? 'Pinging…' : 'Ping partner to shop'}
          </button>
          {pingFeedback && (
            <p
              role="status"
              className={`mt-2 text-center text-xs font-medium ${
                pingFeedback.type === 'error'
                  ? 'text-rose-600 dark:text-rose-400'
                  : pingFeedback.type === 'success'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {pingFeedback.text}
            </p>
          )}
        </>
      ) : (
        categoryGrouped && (
          <>
            <Suspense fallback={<TabPanelLoader />}>
              <ReceiptScanner
                replaceItemsFromServer={replaceItemsFromServer}
                onSuccess={(message) => setReceiptFeedback({ type: 'success', text: message })}
              />
            </Suspense>
            {receiptFeedback && (
              <p
                role="status"
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                {receiptFeedback.text}
              </p>
            )}
            <form onSubmit={addItem} className="surface-card mb-4 space-y-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  {addItemHeading.title}
                </p>
                <p className="text-muted mt-0.5 text-xs leading-relaxed">{addItemHeading.hint}</p>
              </div>
              <div className="relative flex gap-2">
                <Suspense fallback={<input className="input-field min-w-0 flex-1" disabled placeholder="Loading…" />}>
                  <ItemTypeahead
                    value={draft}
                    onChange={handleDraftChange}
                    onPick={(entry) => applySuggestion(entry, 'add')}
                    onBarcodeResolved={handleBarcodeResolved}
                    onKnowledgeUpdate={handleKnowledgeUpdate}
                    enabledModules={enabledModules}
                    itemKnowledge={itemKnowledge}
                    preferredItemType={addItemType}
                    enableBarcodeScan
                    placeholder="Item name or scan barcode"
                    id="quick-add-input"
                    inputClassName={`input-field min-w-0 flex-1${
                      addDuplicateMatch ? ` ${DUPLICATE_INPUT_RING}` : ''
                    }`}
                  />
                </Suspense>
                <button
                  type="submit"
                  disabled={Boolean(addDuplicateMatch) || addItemBusy}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label={addItemBusy ? 'Smart sorting item' : 'Add item'}
                >
                  {addItemBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
              </div>
              <DuplicateInventoryHint item={addDuplicateMatch} context="pantry" />
              {addItemType === ITEM_TYPE.FOOD && addExpiry && addExpiryDate && (
                <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  Suggested use-by:{' '}
                  <span className="font-bold">
                    {new Date(`${addExpiryDate}T12:00:00`).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  {' '}— edit in More options if needed
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowAddAdvanced((v) => !v)}
                className="text-muted text-left text-xs font-semibold"
              >
                {showAddAdvanced ? 'Hide options' : 'More options'}
              </button>
              {showAddAdvanced && (
                <>
                  <div>
                    <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                      Storage location
                    </p>
                    <StorageCategoryToggle
                      itemType={addItemType}
                      value={addCategory}
                      onChange={(nextCategory) => {
                        setAddCategory(nextCategory);
                        setAddSubCategory(resolveSubCategory(draft, addItemType, nextCategory));
                      }}
                    />
                  </div>
                  <SubCategoryToggle
                    itemType={addItemType}
                    category={addCategory}
                    value={addSubCategory}
                    onChange={setAddSubCategory}
                  />
                  <div>
                    <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                      Item type
                    </p>
                    <div
                      className={`grid gap-1 rounded-xl border border-black/[0.08] bg-lm-inset p-1 dark:border-white/10 dark:bg-dm-inset ${getModuleGridClass(getEnabledModuleList(enabledModules).length)}`}
                    >
                      {getEnabledModuleList(enabledModules).map((mod) => (
                        <button
                          key={mod.key}
                          type="button"
                          onClick={() => {
                            const nextCategory = defaultCategoryForItemType(mod.itemType);
                            setAddItemType(mod.itemType);
                            setAddCategory(nextCategory);
                            setAddSubCategory(resolveSubCategory(draft, mod.itemType, nextCategory));
                            if (mod.itemType !== ITEM_TYPE.FOOD) {
                              setAddExpiry(false);
                              setAddExpiryDate('');
                            }
                          }}
                          className={`rounded-lg py-2 text-xs font-bold ${
                            addItemType === mod.itemType
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <MetaIcon name={mod.key} className="mr-0.5 inline h-3.5 w-3.5" />{' '}
                          {mod.label.split('&')[0].trim()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {addItemType === ITEM_TYPE.FOOD && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={addExpiry}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAddExpiry(checked);
                        if (checked) {
                          const suggested = suggestAddExpiry(
                            draft,
                            addItemType,
                            addCategory,
                            addSubCategory,
                          );
                          if (suggested) setAddExpiryDate(suggested);
                        } else {
                          setAddExpiryDate('');
                        }
                      }}
                      className="h-4 w-4 rounded border-black/15 bg-lm-raised text-emerald-600 focus:ring-emerald-500 dark:border-white/20 dark:bg-dm-raised"
                    />
                    Track expiry date
                    {addExpiry && addExpiryDate && (
                      <span className="text-muted text-xs font-medium">
                        (suggested {addExpiryDate})
                      </span>
                    )}
                  </label>
                  )}
                  {addItemType === ITEM_TYPE.FOOD && addExpiry && (
                    <input
                      type="date"
                      value={addExpiryDate}
                      onChange={(e) => setAddExpiryDate(e.target.value)}
                      className="input-field"
                    />
                  )}
                </>
              )}
            </form>

            <InventorySectionHeader category={activeView} itemType={scopeItemType}>
              <SubCategoryFilterMenu
                itemType={scopeItemType}
                category={activeView}
                selected={subCategoryFilters}
                onToggle={toggleSubCategoryFilter}
                onClear={clearSubCategoryFilters}
                counts={categoryGrouped.subCategoryCounts}
              />
            </InventorySectionHeader>

            {categoryGrouped.expired.length > 0 && (
              <InventorySection
                title="Expired"
                iconName="expiring"
                accent="text-rose-700"
                itemCount={categoryGrouped.expired.length}
                emptyText=""
                grouped
              >
                {categoryGrouped.expiredGroups.map((group) => (
                  <div key={`expired-${group.subCategory}`}>
                    <h3 className="text-muted mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                      <MetaIcon name={group.meta.label} className="h-3.5 w-3.5" />
                      {group.meta.label}
                    </h3>
                    <ul className="space-y-2">
                      {group.items.map((item) => (
                        <InventoryItemRow
                          key={item.id}
                          item={item}
                          onOpenEditor={setEditingItem}
                          onDelete={(id) => deleteItem(id, { trackHistory: true })}
                          onMoveToShopping={moveItemToShoppingList}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </InventorySection>
            )}

            {categoryGrouped.expiring.length > 0 && (
              <InventorySection
                title={`Expiring Soon (within ${EXPIRING_SOON_DAYS} days)`}
                iconName="expiring"
                accent="text-amber-600"
                itemCount={categoryGrouped.expiring.length}
                emptyText=""
                grouped
              >
                {categoryGrouped.expiringGroups.map((group) => (
                  <div key={`expiring-${group.subCategory}`}>
                    <h3 className="text-muted mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                      <MetaIcon name={group.meta.label} className="h-3.5 w-3.5" />
                      {group.meta.label}
                    </h3>
                    <ul className="space-y-2">
                      {group.items.map((item) => (
                        <InventoryItemRow
                          key={item.id}
                          item={item}
                          onOpenEditor={setEditingItem}
                          onDelete={(id) => deleteItem(id, { trackHistory: true })}
                          onMoveToShopping={moveItemToShoppingList}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </InventorySection>
            )}

            <InventorySection
              title="Plentiful"
              iconName="stocked"
              accent="text-emerald-600"
              itemCount={categoryGrouped.plentiful.length}
              emptyText="No plentiful items here yet — add something above."
              grouped
            >
              {categoryGrouped.plentifulGroups.map((group) => (
                <div key={`plentiful-${group.subCategory}`}>
                    <h3 className="text-muted mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                      <MetaIcon name={group.meta.label} className="h-3.5 w-3.5" />
                      {group.meta.label}
                    </h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <InventoryItemRow
                        key={item.id}
                        item={item}
                        onOpenEditor={setEditingItem}
                        onDelete={(id) => deleteItem(id, { trackHistory: true })}
                        onMoveToShopping={moveItemToShoppingList}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </InventorySection>
          </>
        )
      )}
      </div>

      {editingItem && (
        <ItemEditorSheet
          item={editingItem}
          enabledModules={enabledModules}
          onSave={(updates) => saveItemEdits(editingItem.id, updates)}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}

