import { sendError } from './http.js';

/**
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<void>} handler
 * @param {string} logLabel
 * @param {string} [fallback]
 */
export function asyncRoute(handler, logLabel, fallback = 'Request failed') {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(logLabel, err);
      sendError(res, err, fallback);
    }
  };
}
