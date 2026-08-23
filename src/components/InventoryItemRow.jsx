import { memo } from 'react';
import { Calendar, ShoppingCart, Trash2 } from 'lucide-react';
import { getCategoryMeta, isInStockInventory } from '../inventory/constants.js';
import { getSubcategoryMeta, SUBCATEGORY_OTHER } from '../inventory/subcategories.js';
import { formatInventoryQuantityLabel } from '../inventory/quantityDisplay.js';
import {
  formatExpiryUrgency,
  getDisplayStatus,
  isExpiringSoon,
} from '../inventory/expiryDisplay.js';
import { IconActionButton } from './IconActionButton.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { MetaIcon } from './MetaIcon.jsx';

export const InventoryItemRow = memo(function InventoryItemRow({
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
  const quantityLabel = formatInventoryQuantityLabel(item);

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
          <p className="text-muted mt-0.5 flex items-center gap-1 text-[10px] font-semibold">
            <MetaIcon name={subMeta.label} className="h-3 w-3" /> {subMeta.label}
          </p>
        )}
        {showCategory && catMeta && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MetaIcon name={catMeta.label} className="h-3 w-3" /> {catMeta.label}
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
});
