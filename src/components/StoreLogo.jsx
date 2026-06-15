import { useEffect, useRef, useState } from 'react';
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const errorHandledRef = useRef(false);
  const imgRef = useRef(null);

  const logoUrl = STORE_LOGO_URLS[store];
  const fallback = STORE_LOGO_FALLBACK[store] ?? {
    initials: label?.slice(0, 2)?.toUpperCase() || '?',
    bg: 'bg-slate-600',
    text: 'text-white',
  };

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    errorHandledRef.current = false;

    const img = imgRef.current;
    if (img?.complete) {
      if (img.naturalWidth > 0) {
        setLoaded(true);
      } else {
        setFailed(true);
      }
    }
  }, [store, logoUrl]);

  const showFallback = !logoUrl || failed || !loaded;

  const handleError = () => {
    if (errorHandledRef.current) return;
    errorHandledRef.current = true;
    setFailed(true);
    setLoaded(false);
  };

  const handleLoad = () => {
    if (errorHandledRef.current) return;
    setLoaded(true);
  };

  return (
    <span
      className={`relative inline-flex h-full w-full min-h-[1.75rem] min-w-[1.75rem] items-center justify-center overflow-hidden rounded-lg ${className}`}
      aria-hidden={!label}
    >
      <span
        className={`absolute inset-0 inline-flex items-center justify-center rounded-lg text-xs font-extrabold tracking-tight transition-opacity duration-0 ${fallback.bg} ${fallback.text} ${
          showFallback ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {fallback.initials}
      </span>

      {logoUrl ? (
        <img
          ref={imgRef}
          src={logoUrl}
          alt={label ? `${label} logo` : ''}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-0 ${imgClassName} ${
            loaded && !failed ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : null}
    </span>
  );
}
