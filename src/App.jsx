import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { AppSplashScreen } from './components/AppSplashScreen.jsx';
import { UnloadingLoader } from './components/UnloadingLoader.jsx';
import { AuthScreen } from './components/AuthScreen.jsx';
import { VerifyEmailScreen } from './components/VerifyEmailScreen.jsx';
import { useAppData } from './hooks/useAppData.js';
import { useAuth } from './hooks/useAuth.js';
import {
  PushNotificationProvider,
  usePushNotifications,
} from './context/PushNotificationContext.jsx';
import {
  checkApiHealth,
  fetchHouseholdMembers,
  pingShoppingList,
  removeHouseholdMember,
  addShoppingListItem as addShoppingListItemApi,
  markShoppingItemPurchased,
} from './api.js';
import { readStoredPostcode } from './inventory/postcodeStorage.js';
import { InventorySearch } from './components/InventorySearch.jsx';
import { ReceiptScanner } from './components/ReceiptScanner.jsx';
import { IconActionButton } from './components/IconActionButton.jsx';
import { ItemTypeahead } from './components/ItemTypeahead.jsx';
import { StorageCategoryToggle } from './components/StorageCategoryToggle.jsx';
import { SubCategoryToggle } from './components/SubCategoryToggle.jsx';
import { SubCategoryFilterMenu } from './components/SubCategoryFilterMenu.jsx';
import { StoreBadgeSelector } from './components/StoreBadgeSelector.jsx';
import { LegalFooterLinks } from './components/LegalFooterLinks.jsx';
import {
  defaultCategoryForItemType,
  getCategoriesForItemType,
  getCategoryMeta,
  FOOD_CATEGORY,
  isInStockInventory,
  isOnShoppingList,
  ITEM_TYPE,
  STATUS,
} from './inventory/constants.js';
import { getShoppingSuggestionForItem } from './inventory/getSuggestedStore.js';
import {
  countEnabledModules,
  getDefaultModuleKey,
  getEnabledItemTypes,
  getEnabledModuleList,
  getInitialCategoryForModule,
  getItemTypeForModule,
  getModuleGridClass,
  isItemTypeEnabled,
  isModuleEnabled,
  MODULE_DEFINITIONS,
  MODULE_KEYS,
  normalizeEnabledModules,
  resolveModuleKey,
} from './inventory/modules.js';
import { BARCODE_LOOKUP_LOADING_TEXT } from './inventory/barcodeLookup.js';
import { guessExpiryForItem } from './inventory/expiryGuess.js';
import { inferStorageLocation } from './inventory/smartInventory.js';
import { classifyItem } from './inventory/classifyItem.js';
import {
  countItemsBySubCategory,
  getSubcategoryMeta,
  groupItemsBySubCategory,
  resolveSubCategory,
  SUBCATEGORY_OTHER,
} from './inventory/subcategories.js';
import { dealStoreToPreferred, mapDealToInventory } from './inventory/mapDealToInventory.js';
import { findInventoryItem, getItemId, normalizeName } from './inventory/itemUtils.js';
import {
  getFrequentlyRestocked,
  recordRestockEvent,
  restockHistoryKey,
} from './inventory/restockHistory.js';
import { filterKitchenStatusItems } from './inventory/kitchenStatus.js';
import {
  buildConsumptionFields,
  calculateItemStatus,
  filterPredictedLowItems,
  getConsumptionUrgencyLabel,
} from './inventory/consumption.js';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ChefHat,
  CircleCheck,
  Copy,
  Flame,
  FlaskConical,
  Info,
  Loader2,
  LogOut,
  MapPin,
  Moon,
  Plus,
  Refrigerator,
  Settings,
  Share2,
  ShoppingCart,
  Sun,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

const WeeklyDealsFeed = lazy(() =>
  import('./components/WeeklyDealsFeed.jsx').then((m) => ({ default: m.WeeklyDealsFeed })),
);
const RecipesView = lazy(() =>
  import('./components/RecipesView.jsx').then((m) => ({ default: m.RecipesView })),
);

function TabPanelLoader() {
  return (
    <div className="flex justify-center py-20" role="status" aria-live="polite">
      <UnloadingLoader size="sm" />
    </div>
  );
}

const MAIN_TAB_ORDER = ['fridge', 'shopping', 'deals', 'recipes', 'settings'];

function getStepDirection(order, prevId, nextId) {
  const prev = order.indexOf(prevId);
  const next = order.indexOf(nextId);
  if (prev < 0 || next < 0 || prev === next) return 0;
  return next > prev ? 1 : -1;
}

function flowEnterClass(direction, base = 'animate-flow') {
  if (direction > 0) return `${base}-forward`;
  if (direction < 0) return `${base}-back`;
  return `${base}-neutral`;
}

const COLOR_LEGEND = [
  { swatch: 'bg-emerald-600', label: 'Emerald', desc: 'In stock · plentiful · primary actions' },
  { swatch: 'bg-amber-500', label: 'Amber', desc: 'Expiring soon (auto from expiry date)' },
  { swatch: 'bg-rose-600', label: 'Rose', desc: 'Out of stock — tap badge to mark need to buy' },
  { swatch: 'bg-sky-600', label: 'Sky', desc: 'Shopping list tab, tips & add-to-buy flow' },
  { swatch: 'bg-violet-600', label: 'Violet', desc: 'Saved recipes & invite partner' },
];

const SHOPPING_ACCENT = {
  border: 'border-sky-300 dark:border-sky-600',
  borderSoft: 'border-sky-200 dark:border-sky-800',
  bgActive: 'bg-sky-50 ring-2 ring-sky-500 dark:bg-sky-950/50 dark:ring-sky-500',
  bgMuted: 'bg-sky-100 dark:bg-sky-950/40',
  text: 'text-sky-700 dark:text-sky-300',
  textLabel: 'text-sky-800 dark:text-sky-400',
  btn: 'bg-sky-600 shadow-sky-900/40 hover:bg-sky-500',
  badge: 'bg-sky-600',
  focus: 'focus:border-sky-500 focus:ring-sky-500/30',
  section: 'text-sky-600 dark:text-sky-400',
  hover: 'hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950 dark:hover:text-sky-400',
};

const EXPIRING_SOON_DAYS = 3;

const STATUS_OPTIONS = [STATUS.FRESH, STATUS.OUT];

const STATUS_META = {
  [STATUS.FRESH]: {
    label: 'Plentiful',
    badge: 'bg-emerald-600 text-white',
    section: 'fresh',
  },
  [STATUS.EXPIRING]: {
    label: 'Expiring Soon',
    badge: 'bg-amber-500 text-slate-900',
    section: 'expiring',
  },
  [STATUS.ALMOST_FINISHED]: {
    label: 'Almost Finished',
    badge: 'bg-orange-500 text-white',
    section: 'almost',
  },
  [STATUS.OUT]: {
    label: 'Out of Stock',
    badge: 'bg-rose-600 text-white',
    section: 'out',
  },
};

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

function ColorLegendCard() {
  return (
    <section className="surface-card mb-5 p-4">
      <h2 className="text-heading mb-1 text-sm font-bold uppercase tracking-wide">Color guide</h2>
      <p className="text-muted mb-3 text-sm">What each color means across the app.</p>
      <ul className="space-y-2.5">
        {COLOR_LEGEND.map((item) => (
          <li key={item.label} className="flex items-start gap-3">
            <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${item.swatch}`} aria-hidden />
            <div>
              <p className="text-heading text-sm font-semibold">{item.label}</p>
              <p className="text-muted text-xs">{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
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

function daysUntilExpiry(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${iso}T12:00:00`);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

function isExpiringSoon(item) {
  if (!item.expiryDate || isOnShoppingList(item)) return false;
  return daysUntilExpiry(item.expiryDate) <= EXPIRING_SOON_DAYS;
}

function getDisplayStatus(item) {
  return calculateItemStatus(item);
}

function groupByCategory(items, category, itemType, selectedSubCategories = null) {
  const inCategory = items.filter(
    (item) =>
      item.category === category &&
      item.itemType === itemType &&
      isInStockInventory(item),
  );
  const filterBySub = (list) => {
    if (!selectedSubCategories || selectedSubCategories.size === 0) return list;
    return list.filter((item) =>
      selectedSubCategories.has(item.subCategory || SUBCATEGORY_OTHER),
    );
  };

  const expiring = filterBySub(
    inCategory.filter(isExpiringSoon).sort(sortByUrgencyThenName),
  );
  const plentiful = filterBySub(
    inCategory
      .filter((item) => !isExpiringSoon(item))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  return {
    expiring,
    plentiful,
    expiringGroups: groupItemsBySubCategory(expiring, itemType, category),
    plentifulGroups: groupItemsBySubCategory(plentiful, itemType, category),
    subCategoryCounts: countItemsBySubCategory(inCategory, itemType, category),
  };
}

function formatExpiryDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatExpiryUrgency(item) {
  if (!item.expiryDate) return null;
  const days = daysUntilExpiry(item.expiryDate);
  const dateLabel = formatExpiryDate(item.expiryDate);
  if (days < 0) return `Expired ${dateLabel}`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days (${dateLabel})`;
}

function sortByUrgencyThenName(a, b) {
  if (a.expiryDate && b.expiryDate) {
    const cmp = a.expiryDate.localeCompare(b.expiryDate);
    if (cmp !== 0) return cmp;
  } else if (a.expiryDate) return -1;
  else if (b.expiryDate) return 1;
  return a.name.localeCompare(b.name);
}

function itemTypeLabelEmoji(itemType) {
  if (itemType === ITEM_TYPE.BABY) return '👶';
  if (itemType === ITEM_TYPE.HOUSEHOLD) return '🕯️';
  return '🍏';
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
          <span className="text-xl leading-none" aria-hidden>
            {meta.emoji}
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

function StatusBadge({ status, onOpenPicker }) {
  const meta = STATUS_META[status];
  return (
    <button
      type="button"
      onClick={onOpenPicker}
      className={`min-h-11 shrink-0 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wide transition active:scale-95 ${meta.badge}`}
      aria-label={`Status: ${meta.label}. Tap to choose a different status.`}
    >
      {meta.label}
    </button>
  );
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
    onSave({
      status: needToBuy ? STATUS.OUT : STATUS.FRESH,
      itemType,
      category,
      subCategory,
      expiryDate: hasExpiry && expiryDate ? expiryDate : null,
      quantity: Number(quantity) > 0 ? Number(quantity) : 1,
      unit: unit.trim(),
      isLow,
      storageLocation: inferStorageLocation(category, item.foodGroup, item.storageLocation),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-editor-title"
    >
      <div className="surface-card w-full max-w-md p-5 shadow-2xl">
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
              {mod.emoji} {mod.label.split(' ')[0]}
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
              placeholder="g, ml, pack"
              className="input-field"
            />
          </div>
        </div>

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
        {expiringHint && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            This date is within {EXPIRING_SOON_DAYS} days — it will show under Expiring Soon
            automatically.
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
    </div>
  );
}

function ShoppingListBoughtButton({ itemName, onBought, busy = false }) {
  return (
    <button
      type="button"
      onClick={onBought}
      disabled={busy}
      className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 pl-4 pr-5 text-sm font-bold text-white shadow-lg shadow-emerald-900/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 dark:shadow-emerald-950/40"
      aria-label={`Add ${itemName} to pantry`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30 transition group-active:scale-95">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <CircleCheck className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        )}
      </span>
      <span className="flex flex-col items-start text-left leading-tight">
        <span>{busy ? 'Adding to pantry…' : 'Add to pantry'}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/90">
          {busy ? 'One moment' : 'Tap when you have bought it'}
        </span>
      </span>
    </button>
  );
}

function ShoppingListItemRow({
  item,
  onOpenEditor,
  onDelete,
  onGotIt,
  onPreferredStoreChange,
  stockingId,
}) {
  const catMeta = getCategoryMeta(item.category, item.itemType);
  const { store, detail } = getShoppingSuggestionForItem(item);
  const quantityLabel =
    item.quantity && item.quantity !== 1
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
      : item.unit
        ? item.unit
        : null;

  return (
    <li className="surface-row px-3 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-heading text-sm font-semibold">
              {item.name}
              {quantityLabel ? (
                <span className="text-muted ml-1 text-xs font-medium">· {quantityLabel}</span>
              ) : null}
            </p>
            {catMeta && (
              <p className="mt-0.5 text-xs text-slate-500">
                {itemTypeLabelEmoji(item.itemType)} {catMeta.emoji} {catMeta.label}
              </p>
            )}
            {item.sourceRecipe?.title && (
              <p className="mt-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
                For recipe: {item.sourceRecipe.title}
              </p>
            )}
          </div>
          <IconActionButton
            variant="delete"
            onClick={() => onDelete(item.id)}
            aria-label={`Remove ${item.name} from shopping list`}
          >
            <Trash2 className="h-4 w-4" />
          </IconActionButton>
        </div>

        <div
          className={`rounded-xl border px-3 py-2.5 ${SHOPPING_ACCENT.borderSoft} ${SHOPPING_ACCENT.bgMuted}`}
        >
          <div className="flex items-start gap-2">
            <MapPin
              className={`mt-0.5 h-4 w-4 shrink-0 ${SHOPPING_ACCENT.text}`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className={`flex flex-wrap items-center gap-x-1 text-xs font-bold ${SHOPPING_ACCENT.textLabel}`}>
                <span>Where to buy</span>
                <StoreBadgeSelector
                  store={store}
                  onSelect={(nextStore) => onPreferredStoreChange(item.id, nextStore)}
                />
              </p>
              <p className={`mt-1 text-xs leading-relaxed ${SHOPPING_ACCENT.text}`}>{detail}</p>
            </div>
          </div>
        </div>

        <ShoppingListBoughtButton
          itemName={item.name}
          busy={stockingId === item.id}
          onBought={() => onGotIt(item.id)}
        />

        <button
          type="button"
          onClick={() => onOpenEditor(item)}
          className="text-muted w-full text-center text-xs font-semibold underline-offset-2 hover:text-sky-700 hover:underline dark:hover:text-sky-300"
        >
          Edit item details
        </button>
      </div>
    </li>
  );
}

function InventoryItemRow({
  item,
  onOpenEditor,
  onDelete,
  onMoveToShopping,
  showCategory = false,
}) {
  const urgencyLabel = formatExpiryUrgency(item);
  const catMeta = getCategoryMeta(item.category, item.itemType);
  const subMeta = getSubcategoryMeta(item.subCategory, item.itemType, item.category);
  const displayStatus = getDisplayStatus(item);
  const quantityLabel =
    item.quantity && item.quantity !== 1
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
      : item.unit
        ? item.unit
        : null;

  return (
    <li className="surface-row group flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-heading truncate text-sm font-medium">{item.name}</p>
          {isExpiringSoon(item) && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-900 shadow-sm">
              Expiring Soon
            </span>
          )}
          {item.isLow && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Low
            </span>
          )}
        </div>
        {quantityLabel && (
          <p className="text-muted mt-0.5 text-[10px] font-semibold">Qty: {quantityLabel}</p>
        )}
        {item.subCategory && item.subCategory !== SUBCATEGORY_OTHER && (
          <p className="text-muted mt-0.5 text-[10px] font-semibold">
            {subMeta.emoji} {subMeta.label}
          </p>
        )}
        {showCategory && catMeta && (
          <p className="mt-0.5 text-xs text-slate-500">
            {catMeta.emoji} {catMeta.label}
          </p>
        )}
        {urgencyLabel && isInStockInventory(item) && (
          <p
            className={`mt-0.5 flex items-center gap-1 text-xs ${
              isExpiringSoon(item) ? 'text-amber-700' : 'text-slate-600'
            }`}
          >
            <Calendar className="h-3 w-3 shrink-0" />
            {urgencyLabel}
          </p>
        )}
      </div>
      <StatusBadge status={displayStatus} onOpenPicker={() => onOpenEditor(item)} />
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-80 sm:group-hover:opacity-100">
        {onMoveToShopping && (
          <IconActionButton
            variant="cart"
            onClick={() => onMoveToShopping(item.id)}
            className="hover:text-sky-700 dark:hover:text-sky-300"
            aria-label={`Add ${item.name} to shopping list`}
          >
            <ShoppingCart className="h-4 w-4" />
          </IconActionButton>
        )}
        <IconActionButton
          variant="delete"
          onClick={() => onDelete(item.id)}
          aria-label={`Remove ${item.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </IconActionButton>
      </div>
    </li>
  );
}

function KitchenStatusCard({ item, onFinished, onRestock }) {
  const urgencyLabel = formatExpiryUrgency(item);
  const catMeta = getCategoryMeta(item.category, item.itemType);

  return (
    <article className="surface-card flex w-[min(100%,17rem)] shrink-0 snap-start flex-col gap-3 rounded-xl border border-amber-200/80 p-3 shadow-sm dark:border-amber-800/60">
      <div className="min-w-0">
        <p className="text-heading line-clamp-2 text-sm font-bold leading-snug">{item.name}</p>
        {urgencyLabel && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            {urgencyLabel}
          </p>
        )}
        {catMeta && (
          <p className="text-muted mt-1 text-[10px]">
            {catMeta.emoji} {catMeta.label}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onFinished(item.id)}
          className="rounded-lg border border-rose-200 bg-rose-50 py-2 text-xs font-bold text-rose-700 transition active:scale-[0.98] hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-950"
        >
          Finished
        </button>
        <button
          type="button"
          onClick={() => onRestock(item.id)}
          className={`rounded-lg py-2 text-xs font-bold text-white transition active:scale-[0.98] ${SHOPPING_ACCENT.btn}`}
        >
          Restock
        </button>
      </div>
    </article>
  );
}

const PREDICTED_LOW_ACTION_BTN =
  'touch-manipulation relative z-10 select-none transition active:scale-[0.98]';

function PredictedLowCard({ item, onRestock, onStillGotIt, onDelete }) {
  const urgencyLabel = getConsumptionUrgencyLabel(item);
  const catMeta = getCategoryMeta(item.category, item.itemType);

  return (
    <article className="surface-card flex w-[min(100%,18rem)] shrink-0 snap-start flex-col gap-3 rounded-xl border border-orange-200/90 p-3 shadow-sm dark:border-orange-800/60">
      <div className="min-w-0">
        <p className="text-heading line-clamp-2 text-sm font-bold leading-snug">{item.name}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-orange-800 dark:text-orange-300">
          {urgencyLabel}
        </p>
        {catMeta && (
          <p className="text-muted mt-1 text-[10px]">
            {catMeta.emoji} {catMeta.label}
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

function PredictedLowBanner({ items, onRestock, onStillGotIt, onDelete, onDismiss }) {
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
            Based on how long items usually last in your household (~85% of typical supply used).
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
                    <p className="text-muted mt-0.5 text-[10px]">
                      {meta?.emoji} {meta?.label}
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

function InventorySection({ title, emoji, accent, itemCount, children, emptyText, grouped = false }) {
  return (
    <section className="mb-5">
      <h2 className={`mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${accent}`}>
        <span aria-hidden>{emoji}</span>
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
              <span className="scope-tab-btn__emoji block text-base" aria-hidden>
                {mod.emoji}
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
              <span className="storage-tab-btn__emoji text-lg" aria-hidden>
                {meta.emoji}
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

function InventoryView({
  mode,
  items,
  updateItems,
  patchItems,
  replaceItemsFromServer,
  restockHistory,
  updateRestockHistory,
  onboarding,
  enabledModules,
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
    () => filterPredictedLowItems(items, enabledModules),
    [items, enabledModules],
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

      const hit = classifyItem(trimmed);
      if (!hit) {
        if (target === 'add') {
          setAddSubCategory(resolveSubCategory(trimmed, addItemType, addCategory));
        }
        return;
      }

      if (target === 'add') {
        setAddItemType(ITEM_TYPE.FOOD);
        setAddCategory(hit.category);
        setAddSubCategory(hit.subCategory);
      } else {
        setShopItemType(ITEM_TYPE.FOOD);
        setShopCategory(hit.category);
      }
    },
    [addCategory, addItemType],
  );

  const handleDraftChange = useCallback(
    (value) => {
      setDraft(value);
      if (addItemType === ITEM_TYPE.FOOD) {
        applySmartClassification(value, 'add');
      }
    },
    [applySmartClassification, addItemType],
  );

  const handleShopDraftChange = useCallback(
    (value) => {
      setShopDraft(value);
      if (shopItemType === ITEM_TYPE.FOOD) {
        applySmartClassification(value, 'shop');
      }
    },
    [applySmartClassification, shopItemType],
  );

  const handleBarcodeResolved = (result) => {
    if (!result) return;

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

  const addItem = (e) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || name === BARCODE_LOOKUP_LOADING_TEXT) return;
    const existing = findInventoryItem(items, name, addItemType);
    if (existing) return;
    const consumption = buildConsumptionFields({
      name,
      itemType: addItemType,
      category: addCategory,
    });
    updateItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        itemType: addItemType,
        status: STATUS.FRESH,
        category: addCategory,
        subCategory: addSubCategory,
        expiryDate:
          addItemType === ITEM_TYPE.FOOD && addExpiry && addExpiryDate ? addExpiryDate : null,
        ...consumption,
      },
    ]);
    resetAddForm();
    if (!isShoppingPage) {
      setActiveView(addCategory);
      const mod = MODULE_DEFINITIONS.find((m) => m.itemType === addItemType);
      if (mod) setInventoryScope(mod.key);
    }
  };

  const addShoppingItem = async (e) => {
    e.preventDefault();
    const name = shopDraft.trim();
    if (!name) return;
    setShopFeedback(null);
    try {
      const result = await addShoppingListItemApi({
        name,
        itemType: shopItemType,
        category: shopCategory,
        quantity: 1,
      });
      replaceItemsFromServer(result.items);
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
    }
  };

  const markItemStocked = async (id) => {
    const item = items.find((entry) => entry.id === id);
    if (item) rememberRestock(item);
    setShopFeedback(null);
    setStockingId(id);
    try {
      const result = await markShoppingItemPurchased(id, { applyExpiry: true });
      replaceItemsFromServer(result.items);
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
    updateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const rememberRestock = (item) => {
    if (!item) return;
    updateRestockHistory((prev) => recordRestockEvent(prev, item));
  };

  const deleteItem = (id, { trackHistory = false } = {}) => {
    const item = items.find((entry) => entry.id === id);
    if (trackHistory && item) rememberRestock(item);
    updateItems((prev) => prev.filter((entry) => entry.id !== id));
  };

  const moveItemToShoppingList = (id) => {
    updateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: STATUS.OUT } : item)),
    );
  };

  const predictiveRestock = useCallback(
    (item) => {
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
            restockFrom: target,
          };
        },
        { saveNow: true },
      );
    },
    [patchItems],
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
            restockFrom: target,
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
      const consumption = buildConsumptionFields({
        name: entry.name,
        itemType: entry.itemType,
        category: entry.category,
      });
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
        return prev.map((entry) =>
          findInventoryItem([entry], target) ? { ...entry, status: STATUS.OUT } : entry,
        );
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
            restockFrom: target,
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
          Track food and household supplies. Use the Shopping tab when you need to buy something.
          Open Settings to share your household code and switch theme.
        </TipBanner>
      )}

      {!isDismissed('color-hint') && !isShoppingPage && (
        <TipBanner
          title="Quick color guide"
          accentClass="border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
          onDismiss={() => dismiss('color-hint')}
        >
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Green</span> in
          stock · <span className="font-semibold text-amber-700 dark:text-amber-400">Amber</span>{' '}
          expiring · <span className="font-semibold text-rose-700 dark:text-rose-400">Rose</span>{' '}
          out of stock · <span className={`font-semibold ${SHOPPING_ACCENT.textLabel}`}>Sky</span>{' '}
          shopping list
        </TipBanner>
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
              Add what you need with the + button. When you have bought something at the store, tap{' '}
              <strong className="font-semibold">Add to pantry</strong> on that item — it moves to your
              Fridge tab automatically. Ping your partner if you want them to shop.
            </TipBanner>
          )}

          {!isDismissed('shopping-bought-tip') && shoppingList.length > 0 && (
            <TipBanner
              title="How to mark items as bought"
              accentClass="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
              onDismiss={() => dismiss('shopping-bought-tip')}
            >
              One tap is all you need: press the green{' '}
              <strong className="font-semibold">Add to pantry</strong> button on each item after you
              buy it. It leaves this list and appears in Fridge with a suggested use-by date — no
              checkbox required.
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
              <ItemTypeahead
                value={shopDraft}
                onChange={handleShopDraftChange}
                onPick={(entry) => applySuggestion(entry, 'shop')}
                enabledModules={enabledModules}
                placeholder='What do you need? (e.g. "Milk")'
                inputClassName={`input-field min-w-0 flex-1 ${SHOPPING_ACCENT.focus}${
                  shopListDuplicate ? ` ${DUPLICATE_INPUT_RING}` : ''
                }`}
                id="shop-item-input"
              />
              <button
                type="submit"
                disabled={Boolean(shopListDuplicate)}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${SHOPPING_ACCENT.btn}`}
                aria-label="Add to shopping list"
              >
                <Plus className="h-5 w-5" />
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
            emoji="🛒"
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
            <Bell className="h-5 w-5" />
            {pingBusy ? 'Pinging…' : '🚀 Ping partner to shop'}
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
            <ReceiptScanner
              replaceItemsFromServer={replaceItemsFromServer}
              onSuccess={(message) => setReceiptFeedback({ type: 'success', text: message })}
            />
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
                <ItemTypeahead
                  value={draft}
                  onChange={handleDraftChange}
                  onPick={(entry) => applySuggestion(entry, 'add')}
                  onBarcodeResolved={handleBarcodeResolved}
                  enabledModules={enabledModules}
                  enableBarcodeScan
                  placeholder="Item name or scan barcode"
                  id="quick-add-input"
                  inputClassName={`input-field min-w-0 flex-1${
                    addDuplicateMatch ? ` ${DUPLICATE_INPUT_RING}` : ''
                  }`}
                />
                <button
                  type="submit"
                  disabled={Boolean(addDuplicateMatch)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="Add item"
                >
                  <Plus className="h-5 w-5" />
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
                          {mod.emoji} {mod.label.split('&')[0].trim()}
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

            {categoryGrouped.expiring.length > 0 && (
              <InventorySection
                title={`Expiring Soon (within ${EXPIRING_SOON_DAYS} days)`}
                emoji="🟠"
                accent="text-amber-600"
                itemCount={categoryGrouped.expiring.length}
                emptyText=""
                grouped
              >
                {categoryGrouped.expiringGroups.map((group) => (
                  <div key={`expiring-${group.subCategory}`}>
                    <h3 className="text-muted mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                      <span aria-hidden>{group.meta.emoji}</span>
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
              emoji="🟢"
              accent="text-emerald-600"
              itemCount={categoryGrouped.plentiful.length}
              emptyText="No plentiful items here yet — add something above."
              grouped
            >
              {categoryGrouped.plentifulGroups.map((group) => (
                <div key={`plentiful-${group.subCategory}`}>
                  <h3 className="text-muted mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                    <span aria-hidden>{group.meta.emoji}</span>
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

function DealsView({ items, updateItems }) {
  const shoppingListNames = useMemo(
    () =>
      new Set(
        items
          .filter((item) => isOnShoppingList(item))
          .map((item) => normalizeName(item.name)),
      ),
    [items],
  );

  const addDealToShoppingList = (deal) => {
    const { itemType, category } = mapDealToInventory(deal);
    const needle = normalizeName(deal.name);
    const preferredStore = dealStoreToPreferred(deal.store);

    updateItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) => normalizeName(item.name) === needle && item.itemType === itemType,
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          status: STATUS.OUT,
          category,
          preferredStore: preferredStore ?? next[existingIdx].preferredStore ?? null,
        };
        return next;
      }
      const consumption = buildConsumptionFields({ name: deal.name, itemType, category });
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: deal.name,
          itemType,
          status: STATUS.OUT,
          category,
          expiryDate: null,
          preferredStore,
          ...consumption,
        },
      ];
    });
  };

  return (
    <Suspense fallback={<TabPanelLoader />}>
      <WeeklyDealsFeed onAddDeal={addDealToShoppingList} addedNames={shoppingListNames} />
    </Suspense>
  );
}

function AppGuideSection({ enabledModules, onShowTipsAgain }) {
  const [open, setOpen] = useState(false);
  const showRecipes = isModuleEnabled(enabledModules, MODULE_KEYS.FOOD);

  const sections = [
    {
      icon: Refrigerator,
      title: 'Home — track what you have',
      steps: [
        'Type an item name for suggestions, or scan a barcode on the add field.',
        'Use Ambient, Fresh, and Freezer tabs for pantry, fridge, and frozen goods.',
        'Tap a status badge on any row to edit details or mark it out of stock.',
        `Food with an expiry date within ${EXPIRING_SOON_DAYS} days moves to Expiring Soon automatically.`,
        'Use More options when adding to pick Home Essentials or Baby Care categories.',
      ],
    },
    {
      icon: ShoppingCart,
      title: 'Shopping list — what to buy',
      steps: [
        'Use the Shopping tab in the bottom bar for your shared buy list.',
        'Out-of-stock items appear here; add more with the + field.',
        'Tap a store badge to set where your household buys each item.',
        'Tap Add to pantry on an item after you buy it — it returns to your Fridge with a use-by date.',
        'Ping partner to shop sends a push notification to other household members.',
      ],
    },
    ...(showRecipes
      ? [
          {
            icon: ChefHat,
            title: 'Recipes — AI recommendations & catalogue',
            steps: [
              'Open the Fridge Scout tab to chat with Scout or generate meals from your inventory.',
              'Generated recipes appear in Recommendations — browse your catalogue there too.',
              'Add cravings or quick filters like Under 15 Mins before generating.',
              'Use Search to find built-in recipes or import from TheMealDB.',
              'Save favourites with the bookmark icon.',
              'Add missing ingredients straight to the shared shopping list.',
            ],
          },
        ]
      : []),
    {
      icon: Users,
      title: 'Household — share with your partner',
      steps: [
        'Share your invite code so someone can join the same fridge.',
        'Everyone in the household sees the same inventory and shopping list.',
        'Enable push notifications below to get alerts when food is expiring soon.',
      ],
    },
    {
      icon: Settings,
      title: 'Settings — customize the app',
      steps: [
        'Turn modules on or off: Food & Kitchen, Home Essentials, and Baby Care.',
        'Switch light or dark mode, update your profile, and manage household members.',
        'Clear all items only if you want to wipe inventory for everyone.',
      ],
    },
  ];

  return (
    <section className="surface-card mb-5 overflow-hidden p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left active:scale-[0.99]"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-heading flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
            <BookOpen className="h-4 w-4 text-sky-600" aria-hidden />
            How to use the app
          </h2>
          {!open && (
            <p className="text-muted mt-1 text-xs leading-relaxed">
              Quick guide to Home, shopping list, recipes, and household sharing
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
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-600">
          <p className="text-muted text-sm leading-relaxed">
            What&apos;s in the Fridge keeps a shared household inventory. Start on Home,
            restock from Shopping List, and invite your partner with the code below.
          </p>

          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="surface-inset rounded-xl p-3">
                <h3 className="text-heading flex items-center gap-2 text-sm font-bold">
                  <Icon className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  {section.title}
                </h3>
                <ol className="text-muted mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            );
          })}

          <div className="rounded-xl border border-black/[0.08] bg-lm-inset/80 p-3 dark:border-slate-600 dark:bg-dm-inset">
            <p className="text-heading flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
              <Info className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              Color badges
            </p>
            <ul className="text-muted mt-2 space-y-1 text-xs leading-relaxed">
              <li>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Green</span>{' '}
                — in stock / plentiful
              </li>
              <li>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Amber</span>{' '}
                — expiring soon
              </li>
              <li>
                <span className="font-semibold text-rose-700 dark:text-rose-400">Rose</span>{' '}
                — out of stock (shows on shopping list)
              </li>
              <li>
                <span className="font-semibold text-sky-700 dark:text-sky-400">Sky</span>{' '}
                — shopping list tab and tips
              </li>
            </ul>
          </div>

          {onShowTipsAgain && (
            <button
              type="button"
              onClick={onShowTipsAgain}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Show welcome tips again on Home
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function PushNotificationsSettings() {
  const { status, error, enablePush, permission, vapidConfigured } = usePushNotifications();
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    try {
      await enablePush();
    } finally {
      setBusy(false);
    }
  };

  let statusLabel = 'Not enabled';
  if (status === 'enabled') statusLabel = 'Enabled on this device';
  else if (status === 'loading' || busy) statusLabel = 'Setting up…';
  else if (status === 'denied' || permission === 'denied') {
    statusLabel = 'Blocked in browser settings';
  } else if (status === 'unsupported') statusLabel = 'Not supported in this browser';
  else if (!vapidConfigured) statusLabel = 'Server key not configured';

  return (
    <section className="surface-card mb-5 p-4">
      <h2 className="text-heading mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
        <Bell className="h-4 w-4 text-emerald-600" aria-hidden />
        Push notifications
      </h2>
      <p className="text-muted mb-3 text-sm">
        Get notified when food in your fridge is expiring soon. Works when the app is open
        (banner) or in the background (system notification).
      </p>
      <p className="text-muted mb-3 text-xs">
        Status: <span className="font-semibold text-slate-700 dark:text-slate-300">{statusLabel}</span>
      </p>
      {error && (
        <p className="mb-3 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleEnable}
        disabled={busy || status === 'loading' || status === 'unsupported' || !vapidConfigured}
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {status === 'enabled' ? 'Refresh push registration' : 'Enable notifications'}
      </button>
    </section>
  );
}

function SettingsView({
  settings,
  updateSettings,
  updateItems,
  onboarding,
  householdCode,
  enabledModules,
  onUpdateEnabledModules,
  accountEmail,
  onLogout,
  onDeleteAccount,
  onLeaveHousehold,
}) {
  const { resetOnboarding } = onboarding;
  const [name, setName] = useState(settings.user.name);
  const [email, setEmail] = useState(settings.user.email || accountEmail);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [members, setMembers] = useState([]);
  const [currentUserIsOwner, setCurrentUserIsOwner] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [memberActionError, setMemberActionError] = useState('');
  const [modulesBusy, setModulesBusy] = useState(false);
  const [modulesError, setModulesError] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const enabledModulesSummary = useMemo(
    () =>
      getEnabledModuleList(enabledModules)
        .map((mod) => mod.label)
        .join(' · '),
    [enabledModules],
  );

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError('');
    try {
      const data = await fetchHouseholdMembers();
      setMembers(data.members || []);
      setCurrentUserIsOwner(Boolean(data.currentUserIsOwner));
    } catch (err) {
      setMembersError(err.message || 'Could not load household members.');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setName(settings.user.name);
    setEmail(settings.user.email || accountEmail || '');
  }, [settings.user.name, settings.user.email, accountEmail]);

  const saveProfile = () => {
    updateSettings((prev) => ({
      ...prev,
      user: { name: name.trim(), email: email.trim() },
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setTheme = (theme) => {
    updateSettings((prev) => ({ ...prev, theme }));
  };

  const handleModuleToggle = async (moduleKey, checked) => {
    setModulesError('');
    const current = normalizeEnabledModules(enabledModules);
    const next = { ...current, [moduleKey]: checked };
    const enabledCount = [next.food, next.homeEssentials, next.babyCare].filter(Boolean).length;
    if (enabledCount === 0) {
      setModulesError('Keep at least one module enabled on your dashboard.');
      return;
    }
    setModulesBusy(true);
    try {
      await onUpdateEnabledModules({ [moduleKey]: checked });
    } catch (err) {
      setModulesError(err.message || 'Could not update modules.');
    } finally {
      setModulesBusy(false);
    }
  };

  const inviteMessage = householdCode
    ? `Join our household on What's in the Fridge! Invite code: ${householdCode}`
    : 'Loading invite code…';

  const copyInviteCode = async () => {
    if (!householdCode) return;
    try {
      await navigator.clipboard.writeText(householdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const shareInvite = async () => {
    if (!householdCode) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join our fridge",
          text: inviteMessage,
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    copyInviteCode();
  };

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    updateItems([]);
    setConfirmClear(false);
  };

  const handleDeleteAccount = async () => {
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await onDeleteAccount();
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete account.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!confirmRemoveMember) return;
    setRemoveBusy(true);
    setMemberActionError('');
    try {
      const data = await removeHouseholdMember(confirmRemoveMember.id);
      setMembers(data.members || []);
      setConfirmRemoveMember(null);
    } catch (err) {
      setMemberActionError(err.message || 'Could not remove member.');
    } finally {
      setRemoveBusy(false);
    }
  };

  const handleLeaveHousehold = async () => {
    setLeaveBusy(true);
    setMemberActionError('');
    try {
      await onLeaveHousehold();
      setShowLeaveConfirm(false);
    } catch (err) {
      setMemberActionError(err.message || 'Could not leave household.');
    } finally {
      setLeaveBusy(false);
    }
  };

  return (
    <div className="pb-28">
      <header className="mb-5">
        <h1 className="text-heading flex items-center gap-2.5 text-2xl font-extrabold">
          <Settings className="h-7 w-7 text-emerald-600" aria-hidden />
          Settings
        </h1>
        <p className="text-muted mt-1.5 text-sm">Appearance, account, and household</p>
      </header>

      <ColorLegendCard />

      <AppGuideSection
        enabledModules={enabledModules}
        onShowTipsAgain={resetOnboarding}
      />

      <section className="surface-card mb-5 p-4">
        <h2 className="text-heading mb-1 text-sm font-bold uppercase tracking-wide">Appearance</h2>
        <p className="text-muted mb-3 text-sm">Choose light or dark mode for the app.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition active:scale-[0.98] ${
              settings.theme === 'light'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
            }`}
          >
            <Sun className="h-5 w-5" />
            Light
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition active:scale-[0.98] ${
              settings.theme === 'dark'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
            }`}
          >
            <Moon className="h-5 w-5" />
            Dark
          </button>
        </div>
      </section>

      <PushNotificationsSettings />

      <section className="surface-card mb-5 overflow-hidden p-4">
        <button
          type="button"
          onClick={() => setCustomizeOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 text-left active:scale-[0.99]"
          aria-expanded={customizeOpen}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-heading text-sm font-bold uppercase tracking-wide">
              Customize Dashboard
            </h2>
            {!customizeOpen && (
              <p className="text-muted mt-1 truncate text-xs leading-relaxed">
                {enabledModulesSummary || 'Choose modules'}
              </p>
            )}
          </div>
          {customizeOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          )}
        </button>

        {customizeOpen && (
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
            <p className="text-muted mb-4 text-sm">
              Choose what your household tracks. Changes sync for everyone when the app refreshes.
            </p>
            <div className="space-y-2">
              {MODULE_DEFINITIONS.map((mod) => {
                const checked = normalizeEnabledModules(enabledModules)[mod.key];
                const onlyOneLeft = checked && countEnabledModules(enabledModules) === 1;
                return (
                  <label
                    key={mod.key}
                    className={`surface-inset flex cursor-pointer items-start gap-3 rounded-xl p-3 transition ${
                      modulesBusy ? 'pointer-events-none opacity-60' : ''
                    } ${checked ? 'ring-1 ring-emerald-400/60 dark:ring-emerald-600/50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={modulesBusy || onlyOneLeft}
                      onChange={(e) => handleModuleToggle(mod.key, e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-black/15 bg-lm-raised text-emerald-600 focus:ring-emerald-500 dark:border-white/20 dark:bg-dm-raised"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-heading text-sm font-semibold">
                        <span className="mr-1.5" aria-hidden>
                          {mod.emoji}
                        </span>
                        {mod.label}
                      </p>
                      <p className="text-muted mt-0.5 text-xs leading-relaxed">{mod.description}</p>
                      {onlyOneLeft && (
                        <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          At least one module must stay on
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            {modulesBusy && (
              <p className="text-muted mt-3 text-xs font-medium">Saving for your household…</p>
            )}
            {modulesError && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                {modulesError}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="surface-card mb-5 p-4">
        <h2 className="text-heading mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <User className="h-4 w-4 text-emerald-600" />
          Your account
        </h2>
        <p className="text-muted mb-3 text-sm">Saved to your household account.</p>
        <div className="space-y-3">
          <div>
            <label htmlFor="settings-name" className="text-muted mb-1 block text-xs font-semibold uppercase">
              Display name
            </label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="settings-email" className="text-muted mb-1 block text-xs font-semibold uppercase">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field"
            />
          </div>
          <button
            type="button"
            onClick={saveProfile}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? 'Saved!' : 'Save profile'}
          </button>
        </div>
        {settings.user.name && (
          <p className="text-muted mt-3 text-xs">
            Signed in as <span className="font-semibold text-slate-800 dark:text-slate-200">{settings.user.name}</span>
          </p>
        )}
      </section>

      <section className="surface-card mb-5 p-4">
        <h2 className="text-heading mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <Users className="h-4 w-4 text-violet-600" />
          Who&apos;s in your household
        </h2>
        <p className="text-muted mb-3 text-sm">
          Everyone here shares the same fridge inventory and settings.
        </p>

        {membersLoading ? (
          <p className="text-muted py-2 text-sm">Loading members…</p>
        ) : membersError ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-600 dark:text-rose-400">{membersError}</p>
            <button
              type="button"
              onClick={loadMembers}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
            >
              Try again
            </button>
          </div>
        ) : (
          <ul className="mb-4 space-y-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-lm-inset px-3 py-2.5 dark:border-slate-600 dark:bg-dm-inset"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-heading truncate text-sm font-semibold">{member.email}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {member.isCurrentUser && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        You
                      </span>
                    )}
                    {member.isOwner && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                        Owner
                      </span>
                    )}
                  </div>
                </div>
                {currentUserIsOwner && !member.isCurrentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setMemberActionError('');
                      setConfirmRemoveMember({ id: member.id, email: member.email });
                    }}
                    className="shrink-0 rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 active:scale-[0.98] dark:border-rose-800 dark:text-rose-400"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setShowAddPerson((prev) => !prev)}
          className="mb-3 flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 active:scale-[0.98] dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
        >
          <UserPlus className="h-4 w-4" />
          {showAddPerson ? 'Hide invite code' : 'Add another person'}
        </button>

        {showAddPerson && (
          <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/80 p-3 dark:border-violet-800 dark:bg-violet-950/30">
            <p className="text-muted mb-1 text-xs font-semibold uppercase">Invite code</p>
            <p className="text-heading mb-3 font-mono text-2xl font-bold tracking-widest">
              {householdCode || '—'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={copyInviteCode}
                className="flex items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-lm-raised py-2.5 text-sm font-semibold text-slate-800 active:scale-[0.98] dark:border-white/10 dark:bg-dm-raised dark:text-zinc-200"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copied!' : 'Copy code'}
              </button>
              <button
                type="button"
                onClick={shareInvite}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4" />
                Share code
              </button>
            </div>
            <p className="text-muted mt-3 text-xs leading-relaxed">{inviteMessage}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setMemberActionError('');
            setShowLeaveConfirm(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 active:scale-[0.98] dark:border-slate-600 dark:text-slate-300"
        >
          <LogOut className="h-4 w-4" />
          Leave household
        </button>

        {memberActionError && (
          <p className="text-muted mt-3 text-xs text-rose-600 dark:text-rose-400">{memberActionError}</p>
        )}
      </section>

      <section className="surface-inset p-4">
        <h2 className="text-heading mb-2 flex items-center gap-2 text-sm font-bold">
          <FlaskConical className="h-4 w-4 text-amber-600" />
          Data tools
        </h2>
        <p className="text-muted mb-3 text-xs">Manage help tips and inventory.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={resetOnboarding}
            className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 active:scale-[0.98] dark:border-slate-600 dark:text-slate-200"
          >
            Show tips again
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-xl border border-rose-300 py-3 text-sm font-semibold text-rose-700 active:scale-[0.98] dark:border-rose-800 dark:text-rose-400"
          >
            {confirmClear ? 'Tap again to confirm clear all' : 'Clear all items'}
          </button>
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 active:scale-[0.98] dark:border-slate-600 dark:text-slate-200"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteError('');
              setShowDeleteConfirm(true);
            }}
            className="rounded-xl border border-rose-400 py-3 text-sm font-semibold text-rose-700 active:scale-[0.98] dark:border-rose-700 dark:text-rose-400"
          >
            Delete account
          </button>
        </div>
      </section>

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >
          <div className="surface-card w-full max-w-md p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="logout-title" className="text-heading text-lg font-bold">
                  Log out?
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  You&apos;ll need to sign in again to access your household fridge.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white active:scale-[0.98] dark:bg-slate-200 dark:text-slate-900"
              >
                Yes, log out
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="surface-card w-full max-w-md p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="delete-account-title" className="text-heading text-lg font-bold">
                  Delete your account?
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  This permanently removes your login and profile. If you are the only person in
                  your household, all fridge inventory and settings for that household are deleted
                  too. This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteBusy}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {deleteError && (
              <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                {deleteError}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={handleDeleteAccount}
                className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {deleteBusy ? 'Deleting…' : 'Yes, delete my account'}
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveMember && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-member-title"
        >
          <div className="surface-card w-full max-w-md p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="remove-member-title" className="text-heading text-lg font-bold">
                  Remove from household?
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {confirmRemoveMember.email}
                  </span>{' '}
                  will lose access to this household&apos;s fridge. They can rejoin later with the
                  invite code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRemoveMember(null)}
                disabled={removeBusy}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={removeBusy}
                onClick={handleRemoveMember}
                className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
              >
                {removeBusy ? 'Removing…' : 'Yes, remove them'}
              </button>
              <button
                type="button"
                disabled={removeBusy}
                onClick={() => setConfirmRemoveMember(null)}
                className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-household-title"
        >
          <div className="surface-card w-full max-w-md p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="leave-household-title" className="text-heading text-lg font-bold">
                  Leave household?
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  You will no longer see this household&apos;s fridge inventory or settings. You can
                  create a new household or join another one with an invite code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={leaveBusy}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={leaveBusy}
                onClick={handleLeaveHousehold}
                className="rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
              >
                {leaveBusy ? 'Leaving…' : 'Yes, leave household'}
              </button>
              <button
                type="button"
                disabled={leaveBusy}
                onClick={() => setShowLeaveConfirm(false)}
                className="rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="surface-card mb-5 p-4">
        <h2 className="text-heading mb-1 text-sm font-bold uppercase tracking-wide">Data sources</h2>
        <p className="text-muted text-sm leading-relaxed">
          Barcode product names and categories are looked up from{' '}
          <a
            href="https://au.openfoodfacts.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline dark:text-emerald-400"
          >
            Open Food Facts
          </a>{' '}
          and{' '}
          <a
            href="https://au.openproductsfacts.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline dark:text-emerald-400"
          >
            Open Products Facts
          </a>{' '}
          (Australian and worldwide databases). Use-by dates are estimated from product data or
          typical shelf life when not printed on the pack.
        </p>
      </section>

      <footer className="border-t border-slate-200 pt-6 dark:border-slate-700">
        <LegalFooterLinks />
        <p className="text-muted mt-2 text-center text-[10px]">
          What&apos;s in the Fridge? · Household inventory for Australia
        </p>
      </footer>
    </div>
  );
}

function LoadingScreen({ message }) {
  return (
    <div className="auth-screen">
      <div className="auth-screen__mesh" aria-hidden />
      <div className="auth-screen__orb auth-screen__orb--a" aria-hidden />
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-6">
        <UnloadingLoader size="sm" className="mb-5" />
        <p className="text-heading animate-fade-in text-center text-sm font-semibold">{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col px-6 py-10">
      <div className="surface-card border-rose-200 p-5 dark:border-rose-800">
        <h1 className="text-heading mb-2 text-lg font-bold">Cannot connect to database</h1>
        <p className="text-muted mb-4 text-sm leading-relaxed">{error}</p>
        <ol className="text-muted mb-5 list-decimal space-y-2 pl-5 text-sm">
          <li>
            <strong>Vercel:</strong> Project → Settings → Environment Variables → add{' '}
            <code className="text-xs">MONGODB_URI</code> and <code className="text-xs">JWT_SECRET</code>, then redeploy.
          </li>
          <li>
            In MongoDB Atlas → Network Access, allow <code className="text-xs">0.0.0.0/0</code> so Vercel can connect.
          </li>
          <li>
            <strong>Local:</strong> put <code className="text-xs">MONGODB_URI=...</code> in a{' '}
            <code className="text-xs">.env</code> file and run <code className="text-xs">npm run dev</code>.
          </li>
          <li>
            Name must be exactly <code className="text-xs">MONGODB_URI</code> (not <code className="text-xs">VITE_MONGODB_URI</code>).
            Your local <code className="text-xs">.env</code> file is not uploaded to Vercel.
          </li>
          <li>
            After saving the variable, click <strong>Redeploy</strong> — old deployments do not pick up new env vars.
          </li>
          <li>
            Test: open <code className="text-xs">/api/health</code> on your site — should show{' '}
            <code className="text-xs">connected: true</code>.
          </li>
        </ol>
        <button
          type="button"
          onClick={onRetry}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
        >
          Retry connection
        </button>
      </div>
    </div>
  );
}

const SPLASH_MIN_MS = 1400;

export default function App() {
  const [splashPhase, setSplashPhase] = useState('active');
  const [activeTab, setActiveTab] = useState('fridge');
  const [tabFlowDir, setTabFlowDir] = useState(0);
  const auth = useAuth();

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    (async () => {
      readStoredPostcode();
      await checkApiHealth();

      const elapsed = Date.now() - startedAt;
      if (elapsed < SPLASH_MIN_MS) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, SPLASH_MIN_MS - elapsed);
        });
      }

      if (!cancelled) setSplashPhase('exiting');
    })();

    return () => {
      cancelled = true;
    };
  }, []);
  const appReady = auth.canUseApp;
  const {
    loading,
    error,
    saveError,
    dismissSaveError,
    reload,
    items,
    updateItems,
    patchItems,
    replaceItemsFromServer,
    restockHistory,
    updateRestockHistory,
    settings,
    updateSettings,
    enabledModules,
    updateEnabledModules,
    householdCode,
    savedRecipes,
    onboarding,
  } = useAppData(appReady);

  const navTabs = useMemo(() => {
    const shoppingCount = items.filter((item) => isOnShoppingList(item)).length;
    const tabs = [
      { id: 'fridge', label: 'Fridge', icon: Refrigerator, accent: 'emerald' },
      {
        id: 'shopping',
        label: 'Shopping',
        icon: ShoppingCart,
        accent: 'sky',
        badge: shoppingCount,
      },
      { id: 'deals', label: 'Deals', icon: Flame, accent: 'rose' },
    ];
    if (isModuleEnabled(enabledModules, MODULE_KEYS.FOOD)) {
      tabs.push({ id: 'recipes', label: 'Recipes', icon: ChefHat, accent: 'emerald' });
    }
    tabs.push({ id: 'settings', label: 'Settings', icon: Settings, accent: 'emerald' });
    return tabs;
  }, [enabledModules, items]);

  useEffect(() => {
    if (activeTab === 'recipes' && !isModuleEnabled(enabledModules, MODULE_KEYS.FOOD)) {
      setActiveTab('fridge');
    }
  }, [activeTab, enabledModules]);

  if (splashPhase !== 'done') {
    return (
      <AppSplashScreen
        exiting={splashPhase === 'exiting'}
        onExitComplete={() => setSplashPhase('done')}
      />
    );
  }

  if (auth.booting) {
    return <LoadingScreen message="Checking session…" />;
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        needsHousehold={false}
        error={auth.error}
        setError={auth.setError}
        onSignup={auth.signup}
        onLogin={auth.login}
        onCreateHousehold={auth.createHousehold}
        onJoinHousehold={auth.joinHousehold}
        onFinishHouseholdSetup={auth.finishHouseholdSetup}
      />
    );
  }

  if (auth.needsVerification) {
    return (
      <VerifyEmailScreen
        email={auth.user?.email}
        error={auth.error}
        setError={auth.setError}
        onCheckVerified={auth.checkVerification}
        onResend={auth.resendVerificationEmail}
        onLogout={auth.logout}
      />
    );
  }

  if (auth.needsHousehold) {
    return (
      <AuthScreen
        needsHousehold
        error={auth.error}
        setError={auth.setError}
        onSignup={auth.signup}
        onLogin={auth.login}
        onCreateHousehold={auth.createHousehold}
        onJoinHousehold={auth.joinHousehold}
        onFinishHouseholdSetup={auth.finishHouseholdSetup}
      />
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading your household…" />;
  }

  if (error) {
    return <ErrorScreen error={error} onRetry={() => reload()} />;
  }

  return (
    <PushNotificationProvider enabled={auth.canUseApp}>
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col">
      <main className="app-main flex-1 overflow-y-auto px-4 pb-6 pt-6 sm:px-5">
        <div key={activeTab} className={flowEnterClass(tabFlowDir, 'animate-page')}>
        {saveError && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            Could not sync latest change. We will retry automatically on your next edit.
            <button
              type="button"
              onClick={dismissSaveError}
              className="ml-2 font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {(activeTab === 'fridge' || activeTab === 'shopping') && (
          <InventoryView
            mode={activeTab}
            items={items}
            updateItems={updateItems}
            patchItems={patchItems}
            replaceItemsFromServer={replaceItemsFromServer}
            restockHistory={restockHistory}
            updateRestockHistory={updateRestockHistory}
            onboarding={onboarding}
            enabledModules={enabledModules}
          />
        )}
        {activeTab === 'deals' && (
          <DealsView items={items} updateItems={updateItems} />
        )}
        {activeTab === 'recipes' && (
          <Suspense fallback={<TabPanelLoader />}>
            <RecipesView
              items={items}
              updateItems={updateItems}
              replaceItemsFromServer={replaceItemsFromServer}
              savedRecipes={savedRecipes}
            />
          </Suspense>
        )}
        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            updateSettings={updateSettings}
            updateItems={updateItems}
            onboarding={onboarding}
            householdCode={householdCode}
            enabledModules={enabledModules}
            onUpdateEnabledModules={updateEnabledModules}
            accountEmail={auth.user?.email}
            onLogout={auth.logout}
            onDeleteAccount={auth.deleteAccount}
            onLeaveHousehold={auth.leaveHousehold}
          />
        )}
        </div>
      </main>

      <nav
        className="nav-bar fixed bottom-0 left-0 right-0 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex max-w-lg px-1">
          {navTabs.map(({ id, label, icon: Icon, accent, badge }) => {
            const active = activeTab === id;
            const accentStyles =
              accent === 'rose'
                ? {
                    text: 'text-rose-600 dark:text-rose-400',
                    pill: 'bg-rose-100 dark:bg-rose-950/60',
                    bar: 'bg-rose-500',
                  }
                : accent === 'sky'
                  ? {
                      text: 'text-sky-600 dark:text-sky-400',
                      pill: 'bg-sky-100 dark:bg-sky-950/60',
                      bar: 'bg-sky-500',
                    }
                  : {
                      text: 'text-emerald-600 dark:text-emerald-400',
                      pill: 'bg-emerald-100 dark:bg-emerald-950/60',
                      bar: 'bg-emerald-500',
                    };
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTabFlowDir(getStepDirection(MAIN_TAB_ORDER, activeTab, id));
                  setActiveTab(id);
                }}
                className={`nav-tab-btn relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-bold transition-[color,transform] duration-200 active:scale-[0.96] sm:text-xs ${
                  active ? `nav-tab-btn--active ${accentStyles.text}` : 'text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
              >
                {active && (
                  <span
                    className={`absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full transition-all duration-300 ${accentStyles.bar}`}
                    aria-hidden
                  />
                )}
                <span
                  className={`nav-tab-icon relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all duration-300 ${
                    active ? accentStyles.pill : ''
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
                  {badge > 0 && id === 'shopping' && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-bold text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
    </PushNotificationProvider>
  );
}
