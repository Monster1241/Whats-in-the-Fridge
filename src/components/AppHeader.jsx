import { AppLogo } from './AppLogo.jsx';

/**
 * Top-left app branding used on main inventory, recipes, and settings screens.
 */
export function AppHeader({ title, subtitle, children }) {
  return (
    <header className="mb-4">
      <div className="flex items-start gap-3">
        <AppLogo variant="mark" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="text-heading text-xl font-extrabold tracking-tight sm:text-2xl">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-muted mt-1 text-sm leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}
