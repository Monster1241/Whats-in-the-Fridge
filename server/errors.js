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
 * True only for Google API quota / rate-limit exhaustion (not generic errors).
 * @param {unknown} err
 */
export function isGeminiQuotaError(err) {
  const raw = err && typeof err === 'object' ? err : { message: String(err ?? '') };
  const status = Number(raw.status ?? raw.statusCode ?? 0) || undefined;
  const message = String(raw.message ?? '');

  return (
    status === 429 ||
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('ResourceHasBeenExhausted')
  );
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
    const friendly = new Error('Daily Google AI quota reached. Please try again tomorrow.');
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
