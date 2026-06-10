import { useEffect, useMemo } from 'react';

const FADE_MS = 520;
const TITLE = "What's in the Fridge?";

const ORBIT_CIRCLES = [
  { id: 'yellow', fill: '#FFDE7D', angle: 0, introDelay: '0s', waveDelay: '0s' },
  { id: 'blue', fill: '#3B82F6', angle: 120, introDelay: '0.1s', waveDelay: '-0.73s' },
  { id: 'red', fill: '#EF4444', angle: 240, introDelay: '0.2s', waveDelay: '-1.46s' },
];

function OrbitCircle({ fill, angle, introDelay, waveDelay, classSuffix }) {
  return (
    <div
      className={`splash-orbit__node splash-orbit__node--${classSuffix}`}
      style={{ transform: `rotate(${angle}deg)` }}
    >
      <div
        className="splash-orbit__pulse"
        style={{ animationDelay: waveDelay }}
      >
        <svg
          className="splash-orbit__circle"
          style={{ animationDelay: introDelay }}
          viewBox="0 0 72 72"
          width="72"
          height="72"
          aria-hidden
        >
          <circle cx="36" cy="36" r="30" fill={fill} />
        </svg>
      </div>
    </div>
  );
}

/**
 * Vibrant SVG orbital loader — shown while the app boots.
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
        <div className="splash-orbit" aria-hidden>
          <div className="splash-orbit__spinner">
            {ORBIT_CIRCLES.map((circle) => (
              <OrbitCircle key={circle.id} {...circle} classSuffix={circle.id} />
            ))}
          </div>
        </div>

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
      </div>
    </div>
  );
}
