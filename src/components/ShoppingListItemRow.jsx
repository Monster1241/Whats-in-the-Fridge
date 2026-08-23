import { memo } from 'react';
import { CircleCheck, Loader2, MapPin, Trash2 } from 'lucide-react';
import { getCategoryMeta } from '../inventory/constants.js';
import { getShoppingSuggestionForItem } from '../inventory/getSuggestedStore.js';
import { formatInventoryQuantityLabel } from '../inventory/quantityDisplay.js';
import { itemTypeIconName, SHOPPING_ACCENT } from '../inventory/uiAccents.js';
import { IconActionButton } from './IconActionButton.jsx';
import { StoreBadgeSelector } from './StoreBadgeSelector.jsx';
import { MetaIcon } from './MetaIcon.jsx';

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

export const ShoppingListItemRow = memo(function ShoppingListItemRow({
  item,
  onOpenEditor,
  onDelete,
  onGotIt,
  onPreferredStoreChange,
  stockingId,
}) {
  const catMeta = getCategoryMeta(item.category, item.itemType);
  const { store, detail } = getShoppingSuggestionForItem(item);
  const quantityLabel = formatInventoryQuantityLabel(item);

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
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <MetaIcon name={itemTypeIconName(item.itemType)} className="h-3 w-3" />
                <MetaIcon name={catMeta.label} className="h-3 w-3" /> {catMeta.label}
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
});
