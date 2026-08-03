import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { getStoreBadgeClassName, PREFERRED_STORE_OPTIONS } from '../inventory/storeOptions.js';

const MENU_MAX_HEIGHT = 280;

function getMenuPosition(anchor) {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;
  const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(
    MENU_MAX_HEIGHT,
    Math.max(120, openUp ? spaceAbove : spaceBelow),
  );

  return {
    openUp,
    style: {
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - 180),
      zIndex: 80,
      minWidth: '10.5rem',
      maxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    },
  };
}

export function StoreBadgeSelector({ store, onSelect, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ style: {}, openUp: false });
  const buttonRef = useRef(null);
  const listId = useId();

  const updateMenuPosition = () => {
    if (!buttonRef.current) return;
    setMenuPos(getMenuPosition(buttonRef.current));
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        const menu = document.getElementById(listId);
        if (menu && menu.contains(e.target)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open, listId]);

  const badgeClass = getStoreBadgeClassName(store);

  const menu = open
    ? createPortal(
        <ul
          id={listId}
          role="listbox"
          style={menuPos.style}
          className={`touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-black/[0.08] bg-lm-raised py-1 shadow-lg dark:border-slate-600 dark:bg-dm-card ${
            menuPos.openUp ? 'origin-bottom' : 'origin-top'
          }`}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {PREFERRED_STORE_OPTIONS.map((option) => {
            const selected = option === store;
            return (
              <li key={option} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold transition ${
                    selected
                      ? 'bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200'
                      : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ring-1 ${getStoreBadgeClassName(option)}`}
                  >
                    {option}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )
    : null;

  return (
    <>
      <span className="relative ml-1.5 inline-flex">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1 transition active:scale-95 disabled:opacity-50 ${badgeClass}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          title="Change preferred store"
        >
          {store}
          <ChevronDown
            className={`h-3 w-3 opacity-70 transition ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      </span>
      {menu}
    </>
  );
}
