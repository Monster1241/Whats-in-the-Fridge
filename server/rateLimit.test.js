import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

function mockRes() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    body: null,
    setHeader(key, value) {
      headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('createRateLimiter', () => {
  it('allows requests under the max then returns 429', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyPrefix: 'test',
      message: 'Slow down.',
    });
    const req = { ip: '1.2.3.4', headers: {}, user: { id: 'u1' } };
    let nextCount = 0;
    const next = () => {
      nextCount += 1;
    };

    limiter(req, mockRes(), next);
    limiter(req, mockRes(), next);
    expect(nextCount).toBe(2);

    const res = mockRes();
    limiter(req, res, next);
    expect(nextCount).toBe(2);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('Slow down.');
    expect(res.headers['Retry-After']).toBeTruthy();
  });
});
