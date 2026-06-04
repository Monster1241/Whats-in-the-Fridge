import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthScreen } from './components/AuthScreen.jsx';
import { VerifyEmailScreen } from './components/VerifyEmailScreen.jsx';
import { useAppData } from './hooks/useAppData.js';
import { useAuth } from './hooks/useAuth.js';
import { fetchHouseholdMembers, removeHouseholdMember } from './api.js';
import { ItemTypeahead } from './components/ItemTypeahead.jsx';
import { StorageCategoryToggle } from './components/StorageCategoryToggle.jsx';
import { StoreBadgeSelector } from './components/StoreBadgeSelector.jsx';
import {
  defaultCategoryForItemType,
  getCategoriesForItemType,
  getCategoryMeta,
  INVENTORY_VIEW,
  isShoppingView,
  FOOD_CATEGORY,
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
import { classifyItem } from './inventory/classifyItem.js';
import { normalizeName } from './inventory/itemUtils.js';
import {
  Bookmark,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ChefHat,
  CircleCheck,
  Copy,
  FlaskConical,
  Info,
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

const RECIPE_VIEW = {
  MATCHED: 'matched',
  SAVED: 'saved',
};

/** Minimum in-stock ingredients (Fresh / Expiring) to show a matched recipe. */
const MIN_STOCKED_INGREDIENTS_FOR_RECIPE = 3;

const MAIN_INGREDIENT_PATTERN =
  /chicken|beef|salmon|chorizo|egg|pork|mince|tofu|lentil|potato|noodle|shrimp|fish|turkey|lamb|sausage|bacon/i;

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
  [STATUS.OUT]: {
    label: 'Out of Stock',
    badge: 'bg-rose-600 text-white',
    section: 'out',
  },
};

const RECIPES = [
  {
    id: 'creamy-basil-chicken',
    title: 'Creamy Basil Chicken',
    prepTime: '35 min',
    ingredients: [
      'Chicken Thighs',
      'Basil',
      'Heavy Cream',
      'Garlic',
      'Onion',
      'Olive Oil',
    ],
    instructions: [
      'Season chicken thighs with salt and pepper. Sear in olive oil until golden, then set aside.',
      'Sauté diced onion and minced garlic until soft. Pour in heavy cream and simmer 3–4 minutes.',
      'Return chicken to the pan, tear in fresh basil, and simmer until cooked through.',
      'Taste and adjust seasoning. Serve hot with rice or crusty bread.',
    ],
  },
  {
    id: 'chorizo-carbonara',
    title: 'Chorizo Carbonara Pasta',
    prepTime: '25 min',
    ingredients: ['Chorizo', 'Pasta', 'Eggs', 'Parmesan', 'Garlic', 'Black Pepper'],
    instructions: [
      'Cook pasta in salted boiling water until al dente. Reserve 1 cup pasta water.',
      'Brown sliced chorizo in a pan. Add minced garlic for 30 seconds.',
      'Whisk eggs, grated Parmesan, and plenty of black pepper in a bowl.',
      'Toss drained pasta with chorizo off the heat, then quickly mix in the egg mixture.',
      'Loosen with pasta water until silky. Serve immediately with extra Parmesan.',
    ],
  },
  {
    id: 'spicy-stir-fry',
    title: 'Spicy Veggie Stir-Fry',
    prepTime: '20 min',
    ingredients: [
      'Bell Peppers',
      'Broccoli',
      'Soy Sauce',
      'Ginger',
      'Garlic',
      'Rice',
      'Chili Flakes',
    ],
    instructions: [
      'Cook rice according to package directions.',
      'Stir-fry broccoli and sliced bell peppers in hot oil over high heat for 4–5 minutes.',
      'Add minced garlic, ginger, soy sauce, and chili flakes. Toss 1 minute more.',
      'Serve over rice and finish with sesame oil if you have it.',
    ],
  },
  {
    id: 'greek-chicken-bowl',
    title: 'Greek Chicken Power Bowl',
    prepTime: '30 min',
    ingredients: [
      'Chicken Breast',
      'Cucumber',
      'Tomatoes',
      'Feta',
      'Olives',
      'Lemon',
      'Olive Oil',
    ],
    instructions: [
      'Grill or pan-sear seasoned chicken breast until cooked through. Rest and slice.',
      'Chop cucumber and tomatoes. Combine with olives and crumbled feta.',
      'Whisk lemon juice, olive oil, salt, and pepper for a quick dressing.',
      'Layer chicken over salad, drizzle dressing, and serve.',
    ],
  },
  {
    id: 'beef-tacos',
    title: 'Weeknight Beef Tacos',
    prepTime: '22 min',
    ingredients: [
      'Ground Beef',
      'Taco Shells',
      'Lettuce',
      'Tomatoes',
      'Cheddar',
      'Sour Cream',
      'Onion',
    ],
    instructions: [
      'Brown ground beef with diced onion. Season with salt, pepper, and taco spices.',
      'Warm taco shells in the oven or skillet.',
      'Chop lettuce and tomatoes. Shred cheddar.',
      'Fill shells with beef and toppings. Finish with sour cream.',
    ],
  },
  {
    id: 'salmon-lemon-dill',
    title: 'Lemon Dill Salmon',
    prepTime: '28 min',
    ingredients: ['Salmon Fillet', 'Lemon', 'Dill', 'Butter', 'Asparagus', 'Garlic'],
    instructions: [
      'Pat salmon dry. Season with salt, pepper, lemon zest, and chopped dill.',
      'Pan-sear or bake at 200°C / 400°F for 12–15 minutes until flaky.',
      'Sauté asparagus with garlic in butter until tender-crisp.',
      'Serve salmon over asparagus with lemon wedges and melted butter.',
    ],
  },
  {
    id: 'egg-fried-rice',
    title: 'High-Protein Egg Fried Rice',
    prepTime: '18 min',
    ingredients: ['Eggs', 'Rice', 'Soy Sauce', 'Peas', 'Carrots', 'Sesame Oil', 'Green Onion'],
    instructions: [
      'Use day-old rice if possible. Scramble eggs in a hot wok, then set aside.',
      'Stir-fry diced carrots and peas until bright. Add rice and break up clumps.',
      'Return eggs, splash in soy sauce, and toss on high heat.',
      'Finish with sesame oil and sliced green onion.',
    ],
  },
  {
    id: 'thai-holy-basil-chicken',
    title: 'Thai Holy Basil Chicken (Pad Krapow)',
    prepTime: '22 min',
    cuisine: 'Asian',
    ingredients: [
      'Chicken Thighs',
      'Basil',
      'Garlic',
      'Rice',
      'Soy Sauce',
      'Chili Flakes',
      'Onion',
    ],
    instructions: [
      'Cook jasmine or plain rice. Finely chop garlic and slice onion.',
      'Mince or pound chicken thighs. Stir-fry garlic and onion in hot oil until fragrant.',
      'Add chicken and cook through on high heat. Splash in soy sauce and chili flakes.',
      'Tear in plenty of basil, toss 30 seconds, and serve over rice with a fried egg if you like.',
    ],
  },
  {
    id: 'teriyaki-chicken-bowl',
    title: 'Teriyaki Chicken Rice Bowl',
    prepTime: '28 min',
    cuisine: 'Asian',
    ingredients: [
      'Chicken Breast',
      'Rice',
      'Soy Sauce',
      'Ginger',
      'Garlic',
      'Sesame Oil',
      'Green Onion',
    ],
    instructions: [
      'Cook rice. Mix soy sauce, grated ginger, minced garlic, and a little honey or sugar for teriyaki glaze.',
      'Pan-sear sliced chicken breast until golden. Brush with glaze and cook until sticky.',
      'Steam or stir-fry broccoli or carrots on the side if you have them.',
      'Serve chicken over rice, drizzle remaining glaze, and finish with sesame oil and green onion.',
    ],
  },
  {
    id: 'korean-bibimbap-bowl',
    title: 'Korean Bibimbap-Style Bowl',
    prepTime: '30 min',
    cuisine: 'Asian',
    ingredients: [
      'Rice',
      'Eggs',
      'Beef Mince',
      'Soy Sauce',
      'Garlic',
      'Carrots',
      'Spinach',
      'Sesame Oil',
      'Chili Flakes',
    ],
    instructions: [
      'Cook rice. Season beef mince with soy sauce, garlic, and sesame oil; cook in a hot pan until browned.',
      'Quickly sauté julienned carrots and spinach (or any veg) with a pinch of salt.',
      'Fry eggs sunny-side up. Arrange rice in bowls with veg and beef around the edges.',
      'Top with egg, chili flakes, and extra sesame oil. Mix everything together before eating.',
    ],
  },
  {
    id: 'vietnamese-lemon-chicken',
    title: 'Vietnamese-Style Lemon Chicken',
    prepTime: '25 min',
    cuisine: 'Asian',
    ingredients: [
      'Chicken Thighs',
      'Lemon',
      'Garlic',
      'Ginger',
      'Soy Sauce',
      'Rice',
      'Fish Sauce',
      'Green Onion',
    ],
    instructions: [
      'Marinate chicken thighs 15 minutes in lemon juice, fish sauce (or extra soy), garlic, and ginger.',
      'Grill or pan-sear chicken until charred at the edges and cooked through. Rest and slice.',
      'Cook rice. Warm any leftover marinade in the pan as a light sauce.',
      'Serve chicken over rice with lemon wedges, sliced green onion, and herbs if you have them.',
    ],
  },
  {
    id: 'japanese-miso-salmon',
    title: 'Miso-Ginger Glazed Salmon',
    prepTime: '24 min',
    cuisine: 'Asian',
    ingredients: [
      'Salmon Fillet',
      'Miso Paste',
      'Ginger',
      'Soy Sauce',
      'Rice',
      'Garlic',
      'Sesame Oil',
    ],
    instructions: [
      'Whisk miso paste, grated ginger, soy sauce, and a little water into a smooth glaze.',
      'Brush salmon fillets with glaze. Bake at 200°C / 400°F for 12–14 minutes or pan-sear skin-side down first.',
      'Cook rice. Sauté garlic in sesame oil and toss with steamed greens if available.',
      'Serve salmon over rice with extra glaze spooned on top.',
    ],
  },
  {
    id: 'nepali-chicken-curry',
    title: 'Nepali Chicken Curry (Kukhura ko Tarkari)',
    prepTime: '40 min',
    cuisine: 'Nepali',
    ingredients: [
      'Chicken Thighs',
      'Onion',
      'Garlic',
      'Ginger',
      'Tomatoes',
      'Turmeric',
      'Cumin',
      'Rice',
      'Cilantro',
    ],
    instructions: [
      'Blend or finely chop onion, garlic, ginger, and tomatoes into a rough paste (or chop small).',
      'Brown chicken pieces in oil. Add turmeric and cumin; stir until fragrant.',
      'Pour in the paste and simmer 20–25 minutes, adding a splash of water if it sticks.',
      'Season with salt. Serve with steamed rice and fresh cilantro.',
    ],
  },
  {
    id: 'dal-bhat',
    title: 'Dal Bhat (Lentil & Rice Plate)',
    prepTime: '35 min',
    cuisine: 'Nepali',
    ingredients: [
      'Red Lentils',
      'Rice',
      'Onion',
      'Garlic',
      'Ginger',
      'Turmeric',
      'Cumin',
      'Tomatoes',
      'Ghee',
    ],
    instructions: [
      'Rinse lentils. Simmer with turmeric, chopped garlic, ginger, and water until soft (25–30 min).',
      'In a small pan, fry cumin seeds in ghee (or oil) with diced onion until golden; stir into dal.',
      'Cook rice separately. Dice tomatoes and stir into dal for the last 5 minutes.',
      'Serve dal over rice — the classic Nepali comfort meal. Pickles or salad on the side if you have them.',
    ],
  },
  {
    id: 'nepali-potato-curry',
    title: 'Nepali Potato Curry (Aloo Tarkari)',
    prepTime: '30 min',
    cuisine: 'Nepali',
    ingredients: [
      'Potatoes',
      'Onion',
      'Garlic',
      'Ginger',
      'Tomatoes',
      'Turmeric',
      'Cumin',
      'Cilantro',
      'Rice',
    ],
    instructions: [
      'Peel and cube potatoes. Par-boil 8 minutes until just tender; drain.',
      'Sauté onion, garlic, and ginger in oil. Add turmeric and cumin, then diced tomatoes.',
      'Add potatoes and a little water. Simmer until saucy and potatoes are fully tender.',
      'Garnish with cilantro and serve with rice or roti.',
    ],
  },
  {
    id: 'nepali-momo-soup',
    title: 'Nepali Momo Jhol (Dumpling Soup)',
    prepTime: '45 min',
    cuisine: 'Nepali',
    ingredients: [
      'Chicken Mince',
      'Wonton Wrappers',
      'Onion',
      'Garlic',
      'Ginger',
      'Tomatoes',
      'Soy Sauce',
      'Cilantro',
      'Chili Flakes',
    ],
    instructions: [
      'Mix chicken mince with finely chopped onion, garlic, ginger, soy sauce, and cilantro for filling.',
      'Spoon filling onto wonton wrappers, pleat, and seal. Steam dumplings 10–12 minutes until cooked.',
      'For jhol: blend tomatoes, ginger, garlic, and chili with water; simmer 10 minutes. Season with soy and lemon.',
      'Pour warm jhol over steamed momos. Top with cilantro and serve immediately.',
    ],
  },
  {
    id: 'thukpa-noodle-soup',
    title: 'Thukpa (Nepali Noodle Soup)',
    prepTime: '35 min',
    cuisine: 'Nepali',
    ingredients: [
      'Egg Noodles',
      'Chicken Thighs',
      'Onion',
      'Garlic',
      'Ginger',
      'Tomatoes',
      'Soy Sauce',
      'Spinach',
      'Cilantro',
    ],
    instructions: [
      'Simmer sliced chicken in water with onion, garlic, and ginger for a simple broth (20 min).',
      'Shred chicken back into the pot. Add diced tomatoes and soy sauce; simmer 5 minutes more.',
      'Cook egg noodles separately. Divide noodles into bowls and ladle hot broth over.',
      'Top with spinach (wilts in the bowl) and cilantro. Adjust salt and chili to taste.',
    ],
  },
];

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

function CollapsibleInstructions({ recipe }) {
  const [open, setOpen] = useState(false);
  const stepCount = recipe.instructions.length;

  return (
    <div className="surface-inset mb-4 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-muted text-xs font-semibold uppercase tracking-wide">
          Cooking instructions ({stepCount} steps)
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>
      {open && (
        <ol className="mt-3 list-decimal space-y-2 border-t border-slate-200 pt-3 pl-5 text-sm leading-relaxed text-slate-700 dark:border-slate-600 dark:text-slate-300">
          {recipe.instructions.map((step, index) => (
            <li key={`${recipe.id}-step-${index}`}>{step}</li>
          ))}
        </ol>
      )}
      {!open && (
        <p className="text-muted mt-2 text-xs">Tap to expand step-by-step directions.</p>
      )}
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
  if (!item.expiryDate || item.status === STATUS.OUT) return false;
  return daysUntilExpiry(item.expiryDate) <= EXPIRING_SOON_DAYS;
}

function getDisplayStatus(item) {
  if (item.status === STATUS.OUT) return STATUS.OUT;
  if (isExpiringSoon(item)) return STATUS.EXPIRING;
  return STATUS.FRESH;
}

function groupByCategory(items, category, itemType) {
  const inCategory = items.filter(
    (item) =>
      item.category === category &&
      item.itemType === itemType &&
      item.status !== STATUS.OUT,
  );
  const expiring = inCategory.filter(isExpiringSoon).sort(sortByUrgencyThenName);
  const plentiful = inCategory
    .filter((item) => !isExpiringSoon(item))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { expiring, plentiful };
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

function findInventoryMatch(ingredientName, items) {
  const needle = normalizeName(ingredientName);
  return items.find(
    (item) =>
      item.itemType === ITEM_TYPE.FOOD && normalizeName(item.name) === needle,
  );
}

function findStockedFoodMatch(ingredientName, items) {
  const exact = findInventoryMatch(ingredientName, items);
  if (exact && exact.status !== STATUS.OUT) return exact;

  const needle = normalizeName(ingredientName);
  if (!needle) return null;

  return items.find((item) => {
    if (item.itemType !== ITEM_TYPE.FOOD || item.status === STATUS.OUT) return false;
    const itemName = normalizeName(item.name);
    return itemName.includes(needle) || needle.includes(itemName);
  });
}

function getRecipeMainIngredient(recipe) {
  if (recipe.mainIngredient) return recipe.mainIngredient;
  const protein = recipe.ingredients.find((ing) => MAIN_INGREDIENT_PATTERN.test(ing));
  return protein ?? recipe.ingredients[0];
}

function isStockedIngredient(ingredientName, items) {
  return Boolean(findStockedFoodMatch(ingredientName, items));
}

function itemTypeLabelEmoji(itemType) {
  if (itemType === ITEM_TYPE.BABY) return '👶';
  if (itemType === ITEM_TYPE.HOUSEHOLD) return '🕯️';
  return '🍏';
}

function groupShoppingList(items, enabledModules) {
  return items
    .filter(
      (item) =>
        item.status === STATUS.OUT && isItemTypeEnabled(enabledModules, item.itemType),
    )
    .sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      if (cat !== 0) return cat;
      return a.name.localeCompare(b.name);
    });
}

function analyzeRecipe(recipe, items) {
  const have = [];
  const need = [];

  for (const ingredient of recipe.ingredients) {
    const match = findInventoryMatch(ingredient, items);
    if (!match || match.status === STATUS.OUT) {
      need.push(ingredient);
    } else {
      have.push({ name: ingredient, status: getDisplayStatus(match) });
    }
  }

  const stockedCount = have.filter(
    (entry) => entry.status === STATUS.FRESH || entry.status === STATUS.EXPIRING,
  ).length;
  const mainIngredient = getRecipeMainIngredient(recipe);
  const hasMainIngredient = isStockedIngredient(mainIngredient, items);
  const qualifiesForMatch =
    hasMainIngredient && stockedCount >= MIN_STOCKED_INGREDIENTS_FOR_RECIPE;

  return {
    have,
    need,
    canCook: need.length === 0,
    mainIngredient,
    hasMainIngredient,
    stockedCount,
    qualifiesForMatch,
  };
}

function recipeMatchesInventory(analysis) {
  return analysis.qualifiesForMatch;
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
  const [needToBuy, setNeedToBuy] = useState(item.status === STATUS.OUT);
  const enabledTypes = getEnabledItemTypes(enabledModules);
  const initialType = enabledTypes.includes(item.itemType)
    ? item.itemType
    : enabledTypes[0] ?? ITEM_TYPE.FOOD;
  const [itemType, setItemType] = useState(initialType);
  const [category, setCategory] = useState(item.category);
  const [hasExpiry, setHasExpiry] = useState(Boolean(item.expiryDate));
  const [expiryDate, setExpiryDate] = useState(item.expiryDate ?? '');
  const expiringHint = !needToBuy && hasExpiry && expiryDate && isExpiringSoon({
    ...item,
    status: STATUS.FRESH,
    expiryDate,
  });

  const handleItemTypeChange = (nextType) => {
    setItemType(nextType);
    const options = getCategoriesForItemType(nextType);
    if (!options.includes(category)) {
      setCategory(defaultCategoryForItemType(nextType));
    }
  };

  const handleSave = () => {
    onSave({
      status: needToBuy ? STATUS.OUT : STATUS.FRESH,
      itemType,
      category,
      expiryDate: hasExpiry && expiryDate ? expiryDate : null,
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
          className={`mb-3 grid gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-900 ${getModuleGridClass(getEnabledModuleList(enabledModules).length)}`}
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
          <StorageCategoryToggle itemType={itemType} value={category} onChange={setCategory} />
        </div>

        <label className="surface-inset mb-3 flex cursor-pointer items-center gap-2 px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={needToBuy}
            onChange={(e) => setNeedToBuy(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 bg-white text-sky-600 focus:ring-sky-500 dark:border-slate-500 dark:bg-slate-900"
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
                className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500 dark:border-slate-500 dark:bg-slate-900"
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

function ShoppingListBoughtButton({ itemName, onBought }) {
  return (
    <button
      type="button"
      onClick={onBought}
      className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 pl-4 pr-5 text-sm font-bold text-white shadow-lg shadow-emerald-900/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] dark:shadow-emerald-950/40"
      aria-label={`Mark ${itemName} as bought and return to inventory`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30 transition group-active:scale-95">
        <CircleCheck className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      </span>
      <span className="flex flex-col items-start text-left leading-tight">
        <span>Bought it</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/90">
          Back in stock
        </span>
      </span>
    </button>
  );
}

function ShoppingListItemRow({ item, onOpenEditor, onDelete, onGotIt, onPreferredStoreChange }) {
  const catMeta = getCategoryMeta(item.category, item.itemType);
  const { store, detail } = getShoppingSuggestionForItem(item);

  return (
    <li className="surface-row px-3 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-heading text-sm font-semibold">{item.name}</p>
            {catMeta && (
              <p className="mt-0.5 text-xs text-slate-500">
                {itemTypeLabelEmoji(item.itemType)} {catMeta.emoji}{' '}
                {catMeta.label}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className={`shrink-0 rounded-lg p-2 text-slate-500 transition ${SHOPPING_ACCENT.hover}`}
            aria-label={`Remove ${item.name} from shopping list`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
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

function InventoryItemRow({ item, onOpenEditor, onDelete, showCategory = false }) {
  const urgencyLabel = formatExpiryUrgency(item);
  const catMeta = getCategoryMeta(item.category, item.itemType);
  const displayStatus = getDisplayStatus(item);
  return (
    <li className="surface-row flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-heading truncate text-sm font-medium">{item.name}</p>
        {showCategory && catMeta && (
          <p className="mt-0.5 text-xs text-slate-500">
            {catMeta.emoji} {catMeta.label}
          </p>
        )}
        {urgencyLabel && item.status !== STATUS.OUT && (
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
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
        aria-label={`Remove ${item.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function InventorySection({ title, emoji, accent, itemCount, children, emptyText }) {
  return (
    <section className="mb-5">
      <h2 className={`mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${accent}`}>
        <span aria-hidden>{emoji}</span>
        {title}
      </h2>
      {itemCount > 0 ? (
        <ul className="space-y-2">{children}</ul>
      ) : (
        <p className="surface-inset border-dashed px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function ShareFallbackModal({ message, onClose }) {
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    copyMessage();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="surface-card w-full max-w-md p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 id="share-modal-title" className="text-heading text-lg font-bold">
              Share with your partner
            </h3>
            <p className="text-muted mt-1 text-sm">
              Native sharing isn&apos;t available here — message copied to clipboard.
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
        <textarea
          readOnly
          value={message}
          className="input-field h-32 resize-none"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={copyMessage}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy again'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-300"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function StorageLocationTabs({
  enabledModules,
  inventoryScope,
  onScopeChange,
  activeView,
  onChange,
  shoppingCount,
}) {
  const modules = getEnabledModuleList(enabledModules);
  const scopeItemType = getItemTypeForModule(inventoryScope);
  const categoryOptions = getCategoriesForItemType(scopeItemType);

  return (
    <div className="mb-5 space-y-2">
      <div className={`grid gap-2 ${getModuleGridClass(modules.length)}`}>
        {modules.map((mod) => {
          const active = inventoryScope === mod.key;
          return (
            <button
              key={mod.key}
              type="button"
              onClick={() => onScopeChange(mod.key)}
              className={`rounded-xl border px-2 py-2.5 text-center text-sm font-bold transition active:scale-[0.98] ${
                active
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <span className="block text-base" aria-hidden>
                {mod.emoji}
              </span>
              <span className="text-heading mt-0.5 block text-[11px] leading-tight">{mod.label}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {categoryOptions.map((cat) => {
          const meta = getCategoryMeta(cat, scopeItemType);
          const active = activeView === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(cat)}
              className={`rounded-xl border px-2 py-3 text-center transition active:scale-[0.98] ${
                active
                  ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-500 dark:border-emerald-600 dark:bg-emerald-950/60 dark:ring-emerald-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500'
              }`}
            >
              <span className="text-lg" aria-hidden>
                {meta.emoji}
              </span>
              <p className="text-heading mt-1 text-xs font-bold">{meta.label}</p>
              <p className="text-muted text-[10px]">{meta.subtitle}</p>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(INVENTORY_VIEW.SHOPPING)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition active:scale-[0.98] ${
          activeView === INVENTORY_VIEW.SHOPPING
            ? SHOPPING_ACCENT.bgActive
            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500'
        }`}
      >
        <span className="text-heading flex items-center gap-2 text-sm font-bold">
          <span aria-hidden>🛒</span>
          Shopping List
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${SHOPPING_ACCENT.badge}`}
        >
          {shoppingCount}
        </span>
      </button>
    </div>
  );
}

function InventoryView({ items, updateItems, onboarding, enabledModules }) {
  const { isDismissed, dismiss } = onboarding;
  const defaultModuleKey = getDefaultModuleKey(enabledModules);
  const [inventoryScope, setInventoryScope] = useState(defaultModuleKey);
  const [draft, setDraft] = useState('');
  const [addItemType, setAddItemType] = useState(getItemTypeForModule(defaultModuleKey));
  const [addCategory, setAddCategory] = useState(getInitialCategoryForModule(defaultModuleKey));
  const [addExpiry, setAddExpiry] = useState(false);
  const [addExpiryDate, setAddExpiryDate] = useState('');
  const [shopDraft, setShopDraft] = useState('');
  const [shopItemType, setShopItemType] = useState(getItemTypeForModule(defaultModuleKey));
  const [shopCategory, setShopCategory] = useState(getInitialCategoryForModule(defaultModuleKey));
  const [activeView, setActiveView] = useState(getInitialCategoryForModule(defaultModuleKey));
  const [editingItem, setEditingItem] = useState(null);
  const [shareMessage, setShareMessage] = useState(null);
  const [showAddAdvanced, setShowAddAdvanced] = useState(false);
  const [showShoppingAdvanced, setShowShoppingAdvanced] = useState(false);

  const scopeItemType = getItemTypeForModule(inventoryScope);

  const shoppingList = useMemo(
    () => groupShoppingList(items, enabledModules),
    [items, enabledModules],
  );

  const categoryGrouped = useMemo(() => {
    if (isShoppingView(activeView)) return null;
    return groupByCategory(items, activeView, scopeItemType);
  }, [items, activeView, scopeItemType]);

  useEffect(() => {
    const resolved = resolveModuleKey(enabledModules, inventoryScope);
    if (resolved !== inventoryScope) {
      setInventoryScope(resolved);
      const type = getItemTypeForModule(resolved);
      setAddItemType(type);
      setAddCategory(defaultCategoryForItemType(type));
      if (!isShoppingView(activeView)) {
        setActiveView(defaultCategoryForItemType(type));
      }
    }
  }, [enabledModules, inventoryScope, activeView]);

  const handleScopeChange = (nextModuleKey) => {
    setInventoryScope(nextModuleKey);
    const nextType = getItemTypeForModule(nextModuleKey);
    if (!isShoppingView(activeView)) {
      const options = getCategoriesForItemType(nextType);
      if (!options.includes(activeView)) {
        setActiveView(defaultCategoryForItemType(nextType));
      }
    }
    setAddItemType(nextType);
    setAddCategory(defaultCategoryForItemType(nextType));
  };

  const applySuggestion = (entry, target) => {
    if (target === 'add') {
      setAddItemType(entry.itemType);
      setAddCategory(entry.category);
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
      if (!hit) return;

      if (target === 'add') {
        setAddItemType(ITEM_TYPE.FOOD);
        setAddCategory(hit.category);
      } else {
        setShopItemType(ITEM_TYPE.FOOD);
        setShopCategory(hit.category);
      }
    },
    [],
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
    if (!result) return;

    const classified = classifyItem(result.name);
    const entry = {
      name: result.name,
      itemType: classified?.itemType ?? result.itemType,
      category: classified?.category ?? result.category,
    };

    applySuggestion(entry, 'add');

    const mod = getEnabledModuleList(enabledModules).find(
      (m) => m.itemType === entry.itemType,
    );
    if (mod) {
      setInventoryScope(mod.key);
      if (!isShoppingView(activeView)) {
        setActiveView(entry.category);
      }
    }
  };

  const resetAddForm = () => {
    setDraft('');
    setAddItemType(scopeItemType);
    setAddCategory(defaultCategoryForItemType(scopeItemType));
    setAddExpiry(false);
    setAddExpiryDate('');
  };

  const addItem = (e) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || name === BARCODE_LOOKUP_LOADING_TEXT) return;
    const existing = items.find((i) => normalizeName(i.name) === normalizeName(name));
    if (existing) {
      resetAddForm();
      return;
    }
    updateItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        itemType: addItemType,
        status: STATUS.FRESH,
        category: addCategory,
        expiryDate:
          addItemType === ITEM_TYPE.FOOD && addExpiry && addExpiryDate ? addExpiryDate : null,
      },
    ]);
    resetAddForm();
    if (!isShoppingView(activeView)) {
      setActiveView(addCategory);
      const mod = MODULE_DEFINITIONS.find((m) => m.itemType === addItemType);
      if (mod) setInventoryScope(mod.key);
    }
  };

  const addShoppingItem = (e) => {
    e.preventDefault();
    const name = shopDraft.trim();
    if (!name) return;
    const needle = normalizeName(name);
    updateItems((prev) => {
      const existingIdx = prev.findIndex((i) => normalizeName(i.name) === needle);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          status: STATUS.OUT,
          itemType: shopItemType,
          category: shopCategory,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name,
          itemType: shopItemType,
          status: STATUS.OUT,
          category: shopCategory,
          expiryDate: null,
        },
      ];
    });
    setShopDraft('');
  };

  const saveItemEdits = (id, updates) => {
    updateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  const deleteItem = (id) => {
    updateItems((prev) => prev.filter((item) => item.id !== id));
  };

  const markItemStocked = (id) => {
    updateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: STATUS.FRESH } : item)),
    );
  };

  const updatePreferredStore = (id, store) => {
    updateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, preferredStore: store } : item)),
    );
  };

  const buildShoppingMessage = () => {
    const missing = shoppingList.map((i) => i.name);
    if (missing.length === 0) {
      return 'Hey! Our fridge shopping list is empty right now — we\'re all stocked up!';
    }
    return `Hey! Heading home or near the shops? Can you grab these missing items for the fridge: ${missing.join(', ')}?`;
  };

  const pingPartner = async () => {
    const message = buildShoppingMessage();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Fridge Shopping List', text: message });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    setShareMessage(message);
  };

  return (
    <div className="pb-28">
      <header className="mb-4">
        <h1 className="text-heading flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <Refrigerator className="h-7 w-7 shrink-0 text-emerald-600" aria-hidden />
          What&apos;s in the Fridge?
        </h1>
        <p className="text-muted mt-1.5 text-sm leading-relaxed">
          Food & household supplies · expiring soon within {EXPIRING_SOON_DAYS} days (food)
        </p>
      </header>

      {!isDismissed('welcome') && (
        <TipBanner
          title="Welcome to your household fridge"
          onDismiss={() => dismiss('welcome')}
        >
          Track food and household supplies, then use Shopping List for what you need to buy.
          Open Settings to share your household code and switch theme.
        </TipBanner>
      )}

      {!isDismissed('color-hint') && !isShoppingView(activeView) && (
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

      <StorageLocationTabs
        enabledModules={enabledModules}
        inventoryScope={inventoryScope}
        onScopeChange={handleScopeChange}
        activeView={activeView}
        onChange={setActiveView}
        shoppingCount={shoppingList.length}
      />

      {isShoppingView(activeView) ? (
        <>
          {!isDismissed('shopping-tip') && (
            <TipBanner
              title="Your shared shopping list"
              accentClass="border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
              onDismiss={() => dismiss('shopping-tip')}
            >
              Add missing items, tap check when bought, or share the list with your partner.
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
                inputClassName={`input-field min-w-0 flex-1 ${SHOPPING_ACCENT.focus}`}
                id="shop-item-input"
              />
              <button
                type="submit"
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg active:scale-95 ${SHOPPING_ACCENT.btn}`}
                aria-label="Add to shopping list"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
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
                onDelete={deleteItem}
                onGotIt={markItemStocked}
                onPreferredStoreChange={updatePreferredStore}
              />
            ))}
          </InventorySection>

          <button
            type="button"
            onClick={pingPartner}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-lg active:scale-[0.98] ${SHOPPING_ACCENT.btn}`}
          >
            <Share2 className="h-5 w-5" />
            🚀 Ping Shopping List to Partner
          </button>
        </>
      ) : (
        categoryGrouped && (
          <>
            <form onSubmit={addItem} className="surface-card mb-4 space-y-3 p-4">
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
                />
                <button
                  type="submit"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 active:scale-95"
                  aria-label="Add item"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
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
                      onChange={setAddCategory}
                    />
                  </div>
                  <div>
                    <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
                      Item type
                    </p>
                    <div
                      className={`grid gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-900 ${getModuleGridClass(getEnabledModuleList(enabledModules).length)}`}
                    >
                      {getEnabledModuleList(enabledModules).map((mod) => (
                        <button
                          key={mod.key}
                          type="button"
                          onClick={() => {
                            setAddItemType(mod.itemType);
                            setAddCategory(defaultCategoryForItemType(mod.itemType));
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
                      onChange={(e) => setAddExpiry(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500 dark:border-slate-500 dark:bg-slate-900"
                    />
                    Add expiry date (optional)
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

            <p className="text-muted mb-4 text-sm">
              {getCategoryMeta(activeView, scopeItemType)?.emoji}{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {getCategoryMeta(activeView, scopeItemType)?.label}
              </span>{' '}
              — {getCategoryMeta(activeView, scopeItemType)?.subtitle}
            </p>

            <InventorySection
              title={`Expiring Soon (within ${EXPIRING_SOON_DAYS} days)`}
              emoji="🟠"
              accent="text-amber-600"
              itemCount={categoryGrouped.expiring.length}
              emptyText="Nothing urgent in this location — add an expiry date to track."
            >
              {categoryGrouped.expiring.map((item) => (
                <InventoryItemRow
                  key={item.id}
                  item={item}
                  onOpenEditor={setEditingItem}
                  onDelete={deleteItem}
                />
              ))}
            </InventorySection>

            <InventorySection
              title="Plentiful"
              emoji="🟢"
              accent="text-emerald-600"
              itemCount={categoryGrouped.plentiful.length}
              emptyText="No plentiful items here yet — add something above."
            >
              {categoryGrouped.plentiful.map((item) => (
                <InventoryItemRow
                  key={item.id}
                  item={item}
                  onOpenEditor={setEditingItem}
                  onDelete={deleteItem}
                />
              ))}
            </InventorySection>
          </>
        )
      )}

      {shareMessage && (
        <ShareFallbackModal message={shareMessage} onClose={() => setShareMessage(null)} />
      )}

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

function RecipeCard({ recipe, analysis, isSaved, onToggleSave, onMarkCooked, onAddNeedToShoppingList }) {
  const [showAddConfirm, setShowAddConfirm] = useState(false);

  return (
    <li className="surface-card p-4 shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-heading text-lg font-bold">{recipe.title}</h2>
          <p className="text-muted text-xs font-medium">
            {recipe.cuisine ? `${recipe.cuisine} · ` : ''}Prep: {recipe.prepTime}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {analysis.canCook && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              Ready!
            </span>
          )}
          <button
            type="button"
            onClick={() => onToggleSave(recipe.id)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition active:scale-95 ${
              isSaved
                ? 'border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-violet-300 hover:text-violet-600 dark:border-slate-600 dark:bg-slate-900 dark:hover:text-violet-400'
            }`}
            aria-label={isSaved ? 'Remove from saved recipes' : 'Save recipe'}
            aria-pressed={isSaved}
          >
            <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {analysis.have.length > 0 ? (
        <div className="mb-3">
          <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
            What you have
          </p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.have.map((ing) => (
              <span
                key={ing.name}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  ing.status === STATUS.EXPIRING
                    ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:ring-amber-700'
                    : 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-700'
                }`}
              >
                {ing.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted mb-3 text-xs">
          Add matching ingredients in Fridge to see what you already have for this recipe.
        </p>
      )}

      {analysis.need.length > 0 && (
        <div className="mb-4">
          <p className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wide">
            What you need
          </p>
          <ul className="mb-3 flex flex-wrap gap-1.5">
            {analysis.need.map((name) => (
              <li
                key={name}
                className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:ring-rose-700"
              >
                {name}
              </li>
            ))}
          </ul>
          {showAddConfirm ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/40">
              <p className="text-heading text-sm font-semibold">Add to shopping list?</p>
              <p className="text-muted mt-1 text-xs leading-relaxed">
                Add {analysis.need.length} missing ingredient
                {analysis.need.length === 1 ? '' : 's'} from &ldquo;{recipe.title}&rdquo; to your
                household shopping list.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddConfirm(false)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddNeedToShoppingList(analysis.need);
                    setShowAddConfirm(false);
                  }}
                  className="flex-1 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white active:scale-[0.98]"
                >
                  Add all
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 py-2.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 active:scale-[0.98] dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-950"
            >
              <ShoppingCart className="h-4 w-4" />
              Add all to shopping list
            </button>
          )}
        </div>
      )}

      <CollapsibleInstructions recipe={recipe} />

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onMarkCooked(recipe)}
          className="surface-inset flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-800 transition hover:border-emerald-500 hover:text-emerald-700 active:scale-[0.98] dark:text-slate-200 dark:hover:border-emerald-600 dark:hover:text-emerald-400"
        >
          <ChefHat className="h-4 w-4" />
          Cooked It!
        </button>
        <button
          type="button"
          onClick={() => onToggleSave(recipe.id)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98] ${
            isSaved
              ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200'
              : 'border-slate-200 text-slate-700 hover:border-violet-300 hover:text-violet-700 dark:border-slate-600 dark:text-slate-300 dark:hover:text-violet-400'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
          {isSaved ? 'Saved' : 'Save recipe'}
        </button>
      </div>
    </li>
  );
}

function RecipesView({ items, updateItems, savedRecipes }) {
  const { savedIds, isSaved, toggleSave } = savedRecipes;
  const [recipeView, setRecipeView] = useState(RECIPE_VIEW.MATCHED);

  const cookableRecipes = useMemo(() => {
    return RECIPES.map((recipe) => {
      const analysis = analyzeRecipe(recipe, items);
      return { recipe, analysis, score: analysis.stockedCount };
    })
      .filter(({ analysis }) => recipeMatchesInventory(analysis))
      .sort((a, b) => b.score - a.score);
  }, [items]);

  const savedRecipeCards = useMemo(() => {
    return savedIds
      .map((id) => RECIPES.find((recipe) => recipe.id === id))
      .filter(Boolean)
      .map((recipe) => ({
        recipe,
        analysis: analyzeRecipe(recipe, items),
      }))
      .sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
  }, [savedIds, items]);

  const markCooked = (recipe) => {
    updateItems((prev) => {
      const next = [...prev];
      for (const ingredient of recipe.ingredients) {
        const idx = next.findIndex(
          (item) => normalizeName(item.name) === normalizeName(ingredient),
        );
        if (idx >= 0) {
          next[idx] = { ...next[idx], status: STATUS.OUT };
        }
      }
      return next;
    });
  };

  const addNeededToShoppingList = (neededIngredients) => {
    updateItems((prev) => {
      let next = [...prev];
      for (const name of neededIngredients) {
        const needle = normalizeName(name);
        const idx = next.findIndex((item) => normalizeName(item.name) === needle);
        if (idx >= 0) {
          next[idx] = { ...next[idx], status: STATUS.OUT };
          continue;
        }
        const classified = classifyItem(name);
        next.push({
          id: crypto.randomUUID(),
          name,
          itemType: ITEM_TYPE.FOOD,
          status: STATUS.OUT,
          category: classified?.category ?? FOOD_CATEGORY.AMBIENT,
          expiryDate: null,
        });
      }
      return next;
    });
  };

  const list =
    recipeView === RECIPE_VIEW.SAVED ? savedRecipeCards : cookableRecipes;

  return (
    <div className="pb-28">
      <header className="mb-4">
        <h1 className="text-heading text-2xl font-extrabold">What Can We Cook?</h1>
        <p className="text-muted mt-1.5 text-sm">
          {recipeView === RECIPE_VIEW.SAVED
            ? 'Your bookmarked recipes — always available here'
            : `Shows recipes when you have the main ingredient plus at least ${MIN_STOCKED_INGREDIENTS_FOR_RECIPE} items in stock`}
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRecipeView(RECIPE_VIEW.MATCHED)}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition active:scale-[0.98] ${
            recipeView === RECIPE_VIEW.MATCHED
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
          }`}
        >
          <ChefHat className="h-4 w-4" />
          Matched
          {cookableRecipes.length > 0 && (
            <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {cookableRecipes.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setRecipeView(RECIPE_VIEW.SAVED)}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition active:scale-[0.98] ${
            recipeView === RECIPE_VIEW.SAVED
              ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300'
              : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-400'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${recipeView === RECIPE_VIEW.SAVED ? 'fill-current' : ''}`} />
          Saved
          {savedIds.length > 0 && (
            <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {savedIds.length}
            </span>
          )}
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={recipeView === RECIPE_VIEW.SAVED ? Bookmark : ChefHat}
          title={recipeView === RECIPE_VIEW.SAVED ? 'No saved recipes yet' : 'No recipes yet'}
          description={
            recipeView === RECIPE_VIEW.SAVED
              ? 'Tap the bookmark on any recipe in “Matched” to save favourites for quick access.'
              : `Stock the main ingredient for a recipe plus at least ${MIN_STOCKED_INGREDIENTS_FOR_RECIPE} of its items (Fresh or Expiring Soon) to see matches here.`
          }
        />
      ) : (
        <ul className="space-y-4">
          {list.map(({ recipe, analysis }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              analysis={analysis}
              isSaved={isSaved(recipe.id)}
              onToggleSave={toggleSave}
              onMarkCooked={markCooked}
              onAddNeedToShoppingList={addNeededToShoppingList}
            />
          ))}
        </ul>
      )}
    </div>
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
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-500 dark:bg-slate-900"
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
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/50"
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
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-800 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
    </div>
  );
}

function LoadingScreen({ message }) {
  return (
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-6">
      <Refrigerator className="mb-4 h-12 w-12 animate-pulse text-emerald-600" aria-hidden />
      <p className="text-heading text-center text-sm font-semibold">{message}</p>
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

export default function App() {
  const [activeTab, setActiveTab] = useState('inventory');
  const auth = useAuth();
  const appReady = auth.canUseApp;
  const {
    loading,
    error,
    saveError,
    dismissSaveError,
    reload,
    items,
    updateItems,
    settings,
    updateSettings,
    enabledModules,
    updateEnabledModules,
    householdCode,
    savedRecipes,
    onboarding,
  } = useAppData(appReady);

  const navTabs = useMemo(() => {
    const tabs = [{ id: 'inventory', label: 'Home', icon: Refrigerator }];
    if (isModuleEnabled(enabledModules, MODULE_KEYS.FOOD)) {
      tabs.push({ id: 'recipes', label: 'Recipes', icon: ChefHat });
    }
    tabs.push({ id: 'settings', label: 'Settings', icon: Settings });
    return tabs;
  }, [enabledModules]);

  useEffect(() => {
    if (activeTab === 'recipes' && !isModuleEnabled(enabledModules, MODULE_KEYS.FOOD)) {
      setActiveTab('inventory');
    }
  }, [activeTab, enabledModules]);

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
    <div className="app-shell mx-auto flex min-h-full max-w-lg flex-col">
      <main className="flex-1 overflow-y-auto px-4 pb-6 pt-6 sm:px-5">
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
        {activeTab === 'inventory' && (
          <InventoryView
            items={items}
            updateItems={updateItems}
            onboarding={onboarding}
            enabledModules={enabledModules}
          />
        )}
        {activeTab === 'recipes' && (
          <RecipesView items={items} updateItems={updateItems} savedRecipes={savedRecipes} />
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
      </main>

      <nav
        className="nav-bar fixed bottom-0 left-0 right-0 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto flex max-w-lg">
          {navTabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-sm font-semibold transition active:scale-[0.98] ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
              >
                <Icon
                  className={`h-6 w-6 ${active ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                  strokeWidth={active ? 2.25 : 2}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
