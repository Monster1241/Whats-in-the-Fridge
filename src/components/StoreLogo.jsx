import { useState } from 'react';
import { STORE_LOGO_FALLBACK, STORE_LOGO_URLS } from '../inventory/storeLogos.js';

/**
 * @param {{
 *   store: string,
 *   label?: string,
 *   className?: string,
 *   imgClassName?: string,
 * }} props
 */
export function StoreLogo({ store, label = '', className = '', imgClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = STORE_LOGO_URLS[store];
  const fallback = STORE_LOGO_FALLBACK[store] ?? {
    initials: label?.slice(0, 2)?.toUpperCase() || '?',
    bg: 'bg-slate-600',
    text: 'text-white',
  };

  if (!logoUrl || failed) {
    return (
      <span
        className={`inline-flex h-full w-full items-center justify-center rounded-lg text-xs font-extrabold tracking-tight ${fallback.bg} ${fallback.text} ${className}`}
        aria-hidden
      >
        {fallback.initials}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${label || store} logo`}
      className={`h-full w-full object-contain ${imgClassName}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
