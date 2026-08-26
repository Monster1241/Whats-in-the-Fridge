import { afterEach, describe, expect, it } from 'vitest';
import { getAdminAppBaseUrl, getAdminNotifyEmails } from './adminNotifyEmail.js';

describe('adminNotifyEmail', () => {
  const prev = {
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    ADMIN_NOTIFY_EMAILS: process.env.ADMIN_NOTIFY_EMAILS,
    APP_ORIGIN: process.env.APP_ORIGIN,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    VERCEL_URL: process.env.VERCEL_URL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('prefers ADMIN_NOTIFY_EMAILS over ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    process.env.ADMIN_NOTIFY_EMAILS = ' alerts@example.com , ops@example.com ';
    expect(getAdminNotifyEmails()).toEqual(['alerts@example.com', 'ops@example.com']);
  });

  it('falls back to ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'Admin@Example.com';
    delete process.env.ADMIN_NOTIFY_EMAILS;
    expect(getAdminNotifyEmails()).toEqual(['admin@example.com']);
  });

  it('builds app base URL from APP_ORIGIN', () => {
    process.env.APP_ORIGIN = 'https://fridge.example.com/';
    delete process.env.CORS_ORIGIN;
    delete process.env.VERCEL_URL;
    expect(getAdminAppBaseUrl()).toBe('https://fridge.example.com');
  });
});
