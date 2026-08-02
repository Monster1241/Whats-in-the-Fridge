/**
 * Compact icon button with cart / delete motion feedback.
 * @param {{
 *   variant?: 'cart' | 'delete' | 'neutral',
 *   className?: string,
 *   children: import('react').ReactNode,
 * } & import('react').ButtonHTMLAttributes<HTMLButtonElement>} props
 */
export function IconActionButton({
  variant = 'neutral',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type="button"
      className={`icon-action-btn icon-action-btn--${variant}${className ? ` ${className}` : ''}`}
      {...props}
    >
      <span className="icon-action-btn__glyph">{children}</span>
    </button>
  );
}
