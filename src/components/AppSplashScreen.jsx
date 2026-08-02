import { useEffect, useMemo } from 'react';
import { UnloadingLoader } from './UnloadingLoader.jsx';

const FADE_MS = 520;
const TITLE = "What's in the Fridge?";

/**
 * Boot splash — groceries unloading from cart to pantry shelf.
 * @param {{ exiting?: boolean, onExitComplete?: () => void }} props
 */
export function AppSplashScreen({ exiting = false, onExitComplete }) {
  useEffect(() => {
    if (!exiting) return undefined;
    const timer = window.setTimeout(() => onExitComplete?.(), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, onExitComplete]);

  const titleLetters = useMemo(() => [...TITLE], []);

  return (
    <div
      className={`app-splash${exiting ? ' app-splash--exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={TITLE}
    >
      <div className="app-splash__viewport">
        <UnloadingLoader size="md" />

        <h1 className="splash-title">
          {titleLetters.map((char, index) => (
            <span
              key={`${char}-${index}`}
              className="splash-title__letter"
              style={{ animationDelay: `${index * 0.055}s` }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
        <p className="splash-caption">Stocking your pantry…</p>
      </div>
    </div>
  );
}
