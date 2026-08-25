/**
 * Keeps CSS viewport tokens in sync with the visual viewport so full-screen
 * chats and composers adapt when the soft keyboard opens on iOS/Android.
 */
export function installAdaptiveViewport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const root = document.documentElement;

  const apply = () => {
    const vv = window.visualViewport;
    const height = Math.round(vv?.height ?? window.innerHeight);
    const offsetTop = Math.round(vv?.offsetTop ?? 0);
    const width = Math.round(vv?.width ?? window.innerWidth);

    root.style.setProperty('--vv-height', `${height}px`);
    root.style.setProperty('--vv-offset-top', `${offsetTop}px`);
    root.style.setProperty('--vv-width', `${width}px`);
    root.dataset.narrow = width < 360 ? 'true' : 'false';
  };

  apply();

  const vv = window.visualViewport;
  vv?.addEventListener('resize', apply);
  vv?.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);

  return () => {
    vv?.removeEventListener('resize', apply);
    vv?.removeEventListener('scroll', apply);
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', apply);
  };
}
