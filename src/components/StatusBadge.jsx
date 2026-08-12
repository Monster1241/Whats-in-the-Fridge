import { STATUS_META } from '../inventory/uiAccents.js';

export function StatusBadge({ status, onOpenPicker }) {
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
