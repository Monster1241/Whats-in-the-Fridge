import {
  getCategoriesForItemType,
  getCategoryMeta,
  ITEM_TYPE,
} from '../inventory/constants.js';

export function StorageCategoryToggle({ itemType = ITEM_TYPE.FOOD, value, onChange }) {
  const options = getCategoriesForItemType(itemType);

  return (
    <div
      className="grid w-full grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-dm-inset"
      role="group"
      aria-label={`${itemType} storage location`}
    >
      {options.map((cat) => {
        const meta = getCategoryMeta(cat, itemType);
        const selected = value === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition active:scale-95 ${
              selected
                ? meta.tabActive
                : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
            }`}
            aria-pressed={selected}
          >
            <span className="mr-0.5" aria-hidden>
              {meta.emoji}
            </span>
            {cat}
          </button>
        );
      })}
    </div>
  );
}
