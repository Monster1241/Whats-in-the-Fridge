import { memo } from 'react';
import { Calendar } from 'lucide-react';
import { getCategoryMeta } from '../inventory/constants.js';
import { formatExpiryUrgency } from '../inventory/expiryDisplay.js';
import { SHOPPING_ACCENT } from '../inventory/uiAccents.js';
import { MetaIcon } from './MetaIcon.jsx';

export const KitchenStatusCard = memo(function KitchenStatusCard({ item, onFinished, onRestock }) {
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
          <p className="text-muted mt-1 flex items-center gap-1 text-[10px]">
            <MetaIcon name={catMeta.label} className="h-3 w-3" /> {catMeta.label}
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
});
