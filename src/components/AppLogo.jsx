/** Drop hi-res PNG at public/branding/logo.png — used automatically when present. */
const LOGO_PNG = '/branding/logo.png';
const LOGO_SVG = '/branding/logo.svg';

/**
 * @param {'mark' | 'full' | 'auth'} [variant]
 * @param {string} [className]
 */
export function AppLogo({ variant = 'full', className = '' }) {
  if (variant === 'mark') {
    return (
      <FridgeMarkSvg
        className={`h-11 w-11 shrink-0 text-cyan-600 dark:text-cyan-400 ${className}`}
        aria-hidden
      />
    );
  }

  const sizeClass =
    variant === 'auth'
      ? 'mx-auto h-auto w-full max-w-[min(100%,280px)]'
      : 'h-10 w-auto max-w-[220px]';

  return (
    <picture className={`block text-cyan-600 dark:text-cyan-400 ${sizeClass} ${className}`}>
      <source srcSet={LOGO_PNG} type="image/png" />
      <img
        src={LOGO_SVG}
        alt="What's in the Fridge"
        className="h-full w-full object-contain object-left"
        decoding="async"
      />
    </picture>
  );
}

function FridgeMarkSvg({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="What's in the Fridge"
      {...props}
    >
      <rect
        x="6"
        y="8"
        width="52"
        height="48"
        rx="7"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <line x1="32" y1="8" x2="32" y2="56" stroke="currentColor" strokeWidth="2" />
      <rect x="12" y="14" width="14" height="3.5" rx="1" fill="currentColor" fillOpacity="0.4" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="38" y1="18" x2="50" y2="18" />
        <line x1="38" y1="24" x2="50" y2="24" />
        <line x1="38" y1="30" x2="47" y2="30" />
        <line x1="38" y1="36" x2="50" y2="36" />
        <line x1="38" y1="42" x2="48" y2="42" />
        <line x1="38" y1="48" x2="50" y2="48" />
      </g>
      <text
        x="19"
        y="36"
        fill="currentColor"
        fontFamily="system-ui, sans-serif"
        fontSize="14"
        fontWeight="800"
        textAnchor="middle"
      >
        WF
      </text>
    </svg>
  );
}

/** Centered branding for login, signup, and household setup. */
export function AppLogoHero({ tagline, title, className = '' }) {
  return (
    <header className={`mb-8 text-center ${className}`}>
      <AppLogo variant="auth" />
      {title && (
        <h1 className="text-heading mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h1>
      )}
      {tagline && (
        <p className="text-muted mx-auto mt-2 max-w-sm text-sm leading-relaxed">{tagline}</p>
      )}
    </header>
  );
}
