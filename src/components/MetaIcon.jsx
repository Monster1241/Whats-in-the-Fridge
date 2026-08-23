import { resolveMetaIcon } from '../inventory/metaIcons.js';

/**
 * SVG icon for inventory meta (modules, storage, subcategories).
 * Prefer this over emoji — iOS WKWebView often fails to render emoji glyphs.
 *
 * @param {{
 *   name?: string,
 *   className?: string,
 *   strokeWidth?: number,
 * }} props
 */
export function MetaIcon({ name, className = 'h-4 w-4 shrink-0', strokeWidth = 2, ...props }) {
  const Icon = resolveMetaIcon(name);
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden {...props} />;
}
