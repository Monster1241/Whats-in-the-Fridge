/**
 * Plain-text footer links to public legal pages (full page navigation for shareable URLs).
 */
export function LegalFooterLinks({ className = '' }) {
  return (
    <p className={`text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400 ${className}`}>
      <a href="/privacy" className="underline-offset-2 hover:underline">
        Privacy Policy
      </a>
      {' · '}
      <a href="/terms" className="underline-offset-2 hover:underline">
        Terms of Service
      </a>
    </p>
  );
}
