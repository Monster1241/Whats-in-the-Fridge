import { CalendarClock, Refrigerator, ScanBarcode, Users } from 'lucide-react';

const FEATURES = [
  { Icon: CalendarClock, label: 'Track expiry' },
  { Icon: Users, label: 'Shared household' },
  { Icon: ScanBarcode, label: 'Scan barcodes' },
];

/**
 * Shared full-screen layout for login, signup, verify, and household setup.
 */
export function AuthShell({ title, subtitle, children, step = 'auth', compact = false }) {
  return (
    <div className="auth-screen">
      <div className="auth-screen__mesh" aria-hidden />
      <div className="auth-screen__orb auth-screen__orb--a" aria-hidden />
      <div className="auth-screen__orb auth-screen__orb--b" aria-hidden />
      <div className="auth-screen__orb auth-screen__orb--c" aria-hidden />

      <div className={`auth-screen__inner${compact ? ' auth-screen__inner--compact' : ''}`}>
        <header className="auth-screen__hero animate-auth-rise">
          <div className="auth-screen__logo-wrap">
            <div className="auth-screen__logo-ring" aria-hidden />
            <Refrigerator className="auth-screen__logo-icon" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="auth-screen__title">{title}</h1>
          {subtitle && <p className="auth-screen__subtitle">{subtitle}</p>}
          {step === 'auth' && (
            <ul className="auth-screen__features" aria-label="App features">
              {FEATURES.map((feature, index) => (
                <li
                  key={feature.label}
                  className="auth-screen__feature animate-auth-rise"
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                >
                  <feature.Icon className="auth-screen__feature-icon" strokeWidth={2} aria-hidden />
                  {feature.label}
                </li>
              ))}
            </ul>
          )}
        </header>

        <div className="auth-screen__body animate-auth-rise" style={{ animationDelay: '200ms' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
