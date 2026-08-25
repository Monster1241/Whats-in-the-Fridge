import { getStoreDisplayLabel, STORE_BADGE_STYLES } from '../inventory/storeLogos.js';

/**
 * Neutral plain-text store badge (no copyrighted corporate logos).
 *
 * @param {{
 *   store: string,
 *   label?: string,
 *   className?: string,
 *   imgClassName?: string,
 * }} props
 */
export function StoreLogo({ store, label = '', className = '', imgClassName = '' }) {
  const display = getStoreDisplayLabel(store, label);
  const style = STORE_BADGE_STYLES[store] ?? {
    bg: 'bg-slate-600',
    text: 'text-white',
  };

  return (
    <span
      className={`inline-flex h-full w-full min-h-[1.75rem] min-w-[1.75rem] items-center justify-center overflow-hidden rounded-lg px-1 text-center ${style.bg} ${style.text} ${className}`}
      title={display}
      role="img"
      aria-label={display}
    >
      <span
        className={`max-w-full font-extrabold leading-tight tracking-tight ${imgClassName || 'text-[10px] sm:text-[11px]'}`}
      >
        {display}
      </span>
    </span>
  );
}
