import {
  getSubcategoriesForCategory,
  getSubcategoryMeta,
  SUBCATEGORY_OTHER,
} from '../inventory/subcategories.js';

export function SubCategoryToggle({ itemType, category, value, onChange }) {
  const options = getSubcategoriesForCategory(itemType, category);

  if (options.length <= 1) return null;

  return (
    <div className="space-y-2">
      <p className="text-muted text-xs font-semibold uppercase tracking-wide">Sub-category</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Item sub-category">
        {options.map((sub) => {
          const meta = getSubcategoryMeta(sub, itemType, category);
          const selected = (value || SUBCATEGORY_OTHER) === sub;
          return (
            <button
              key={sub}
              type="button"
              onClick={() => onChange(sub)}
              className={`inline-flex min-h-[2.25rem] items-center gap-1 rounded-full px-3 text-xs font-bold ring-1 transition active:scale-[0.98] ${
                selected
                  ? 'bg-emerald-600 text-white ring-emerald-700'
                  : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600'
              }`}
              aria-pressed={selected}
            >
              <span aria-hidden>{meta.emoji}</span>
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
