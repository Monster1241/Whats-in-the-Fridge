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

  const friendly = new Error(err.message || 'Something went wrong. Please try again.');
  friendly.status = err.status || 500;
  return friendly;
}
