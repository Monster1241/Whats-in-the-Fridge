import { useEffect } from 'react';

const FADE_MS = 520;

/**
 * Playful 3D CSS fridge door splash — shown while the app boots.
 * @param {{ exiting?: boolean, onExitComplete?: () => void }} props
 */
export function AppSplashScreen({ exiting = false, onExitComplete }) {
  useEffect(() => {
    if (!exiting) return undefined;
    const timer = window.setTimeout(() => onExitComplete?.(), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, onExitComplete]);

  return (
    <div
      className={`app-splash${exiting ? ' app-splash--exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Opening the fridge"
    >
      <div className="app-splash__viewport">
        <div className="fridge-container" aria-hidden>
          <div className="fridge-scene">
            <div className="fridge-body">
              <div className="fridge-interior" />
              <div className="fridge-door">
                <span className="fridge-handle" />
              </div>
            </div>
          </div>
        </div>
        <p className="app-splash__caption">Opening the fridge...</p>
      </div>
    </div>
  );
}
