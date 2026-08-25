export function getAdminPageFromPath(pathname = window.location.pathname) {
  const path = String(pathname || '').replace(/\/$/, '') || '/admin';
  if (path === '/admin/deals') return 'deals';
  if (path === '/admin/support') return 'support';
  if (path === '/admin/reports') return 'reports';
  if (path === '/admin/feedback') return 'feedback';
  if (path === '/admin/recovery') return 'recovery';
  return 'dashboard';
}

export function adminPathForPage(page) {
  switch (page) {
    case 'deals':
      return '/admin/deals';
    case 'support':
      return '/admin/support';
    case 'reports':
      return '/admin/reports';
    case 'feedback':
      return '/admin/feedback';
    case 'recovery':
      return '/admin/recovery';
    default:
      return '/admin';
  }
}

/**
 * Client-side admin navigation — avoids full reloads that flash auth/admin checks.
 * @param {string} to
 * @param {(page: string) => void} setPage
 */
export function navigateAdmin(to, setPage) {
  const normalized = String(to || '').replace(/\/$/, '') || '/admin';
  const current = window.location.pathname.replace(/\/$/, '') || '/admin';
  if (normalized === current) return;
  window.history.pushState({ admin: true }, '', to);
  setPage(getAdminPageFromPath(normalized));
}
