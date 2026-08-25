import { describe, expect, it } from 'vitest';
import { getAdminPageFromPath } from './adminNavigation.js';

describe('getAdminPageFromPath', () => {
  it('maps admin routes to page keys', () => {
    expect(getAdminPageFromPath('/admin')).toBe('dashboard');
    expect(getAdminPageFromPath('/admin/')).toBe('dashboard');
    expect(getAdminPageFromPath('/admin/deals')).toBe('deals');
    expect(getAdminPageFromPath('/admin/reports')).toBe('reports');
    expect(getAdminPageFromPath('/admin/feedback')).toBe('feedback');
  });
});
