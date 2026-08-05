export function toFriendlyError(err) {
  if (!err) return new Error('Something went wrong. Please try again.');

  if (err.code === 11000) {
    const message = String(err.message || '');
    if (message.includes('email')) {
      const friendly = new Error('An account with this email already exists.');
      friendly.status = 409;
      return friendly;
    }
    const friendly = new Error(
      'Database setup is still syncing. Please wait a moment and try sign up again.',
    );
    friendly.status = 503;
    return friendly;
  }

  if (err.status) return err;

  const message = String(err.message || '');
  if (message.includes('JWT_SECRET')) {
    const friendly = new Error(message);
    friendly.status = 503;
    return friendly;
  }
  if (message.includes('MONGODB_URI') || message.includes('Cannot connect to MongoDB')) {
    const friendly = new Error(message);
    friendly.status = 503;
    return friendly;
  }

  const friendly = new Error(message || 'Something went wrong. Please try again.');
  friendly.status = 500;
  return friendly;
}

/**
 * Parse @google/genai ApiError (message often contains JSON).
 * @param {unknown} err
 * @returns {{ status: number, message: string, code: string }}
 */
export function parseGeminiApiError(err) {
  const raw = err && typeof err === 'object' ? err : { message: String(err ?? '') };
  let status = Number(raw.status ?? raw.statusCode ?? 0) || 502;
  let message = String(raw.message ?? raw.error?.message ?? '');
  let code = String(raw.code ?? '');

  const jsonStart = message.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart));
      const errObj = parsed?.error ?? parsed;
      if (errObj?.message) message = String(errObj.message);
      if (errObj?.code) status = Number(errObj.code) || status;
      if (errObj?.status) code = String(errObj.status);
    } catch {
      // keep original message
    }
  }

  return {
    status: status >= 400 && status < 600 ? status : 502,
    message: message.trim(),
    code,
  };
}

export const GOOGLE_AI_QUOTA_ERROR =
  'Daily Google AI quota reached. Please try again tomorrow.';

/**
 * @param {unknown} err
 */
export function isGeminiQuotaError(err) {
  const { status, message, code } = parseGeminiApiError(err);
  const haystack = `${code} ${message}`.toLowerCase();
  return (
    status === 429 ||
    haystack.includes('resource_exhausted') ||
    haystack.includes('resourcehasbeenexhausted') ||
    haystack.includes('quota exceeded') ||
    haystack.includes('free_tier')
  );
}

/**
 * @param {unknown} err
 * @returns {{ status: number, message: string }}
 */
export function formatGeminiErrorForClient(err, fallback = 'Failed to generate AI recipe.') {
  const { status, message } = parseGeminiApiError(err);

  if (isGeminiQuotaError(err)) {
    return { status: 429, message: GOOGLE_AI_QUOTA_ERROR };
  }

  if (!message) {
    return { status, message: fallback };
  }

  const firstLine = message.split('\n').map((line) => line.trim()).find(Boolean) ?? message;
  return { status, message: firstLine };
}

/**
 * Maps Google GenAI / Gemini SDK errors to safe user-facing messages.
 * @param {unknown} err
 */
export function toFriendlyGeminiError(err) {
  const raw = err && typeof err === 'object' ? err : { message: String(err ?? '') };
  const status = Number(raw.status ?? raw.statusCode ?? 0) || undefined;
  let code = String(raw.code ?? raw.error?.status ?? raw.error?.code ?? '');
  let message = String(raw.message ?? '');

  const jsonStart = message.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart));
      const nested = parsed?.error?.message ?? parsed?.message;
      if (nested) message = String(nested);
      if (parsed?.error?.status) code = String(parsed.error.status);
      if (parsed?.error?.code) code = String(parsed.error.code);
    } catch {
      // keep original message
    }
  }

  if (isGeminiQuotaError(err)) {
    const friendly = new Error(GOOGLE_AI_QUOTA_ERROR);
    friendly.status = 429;
    return friendly;
  }

  if (
    status === 404 ||
    /no longer available|not found|models\//i.test(message)
  ) {
    const friendly = new Error(
      'AI recipe matching is temporarily unavailable. Please try again later.',
    );
    friendly.status = 502;
    return friendly;
  }

  if (/API key|permission|unauthorized|403/i.test(message)) {
    const friendly = new Error('AI recipe matching is not configured correctly.');
    friendly.status = 503;
    return friendly;
  }

  const friendly = new Error(
    'Could not generate recipe suggestions right now. Please try again in a few minutes.',
  );
  friendly.status = status && status >= 400 && status < 600 ? status : 502;
  return friendly;
}
