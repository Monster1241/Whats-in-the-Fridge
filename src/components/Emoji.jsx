/**
 * Renders emoji with an iOS-safe font stack.
 * Custom webfonts + font-weight can turn emoji into missing-glyph boxes in WKWebView.
 */
export function Emoji({ children, className = '', ...props }) {
  if (children == null || children === '') return null;
  return (
    <span className={className ? `emoji ${className}` : 'emoji'} {...props}>
      {children}
    </span>
  );
}
