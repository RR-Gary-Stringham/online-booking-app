export class AppUrlConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppUrlConfigurationError';
  }
}

function configuredAppUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value) {
    throw new AppUrlConfigurationError('Required application configuration is missing: APP_URL.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppUrlConfigurationError('APP_URL must be an absolute URL.');
  }

  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new AppUrlConfigurationError('APP_URL must use HTTPS outside local development.');
  }

  if (url.username || url.password) {
    throw new AppUrlConfigurationError('APP_URL must not include credentials.');
  }

  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
}

/**
 * Builds an absolute URL beneath the configured application mount point.
 *
 * With APP_URL=https://example.com/app, `/api/health` becomes
 * https://example.com/app/api/health rather than https://example.com/api/health.
 */
export function appUrl(path = '') {
  const base = configuredAppUrl();
  const suffix = path && !path.startsWith('/') && !path.startsWith('?') ? `/${path}` : path;
  return new URL(`${base.pathname}${suffix}`, base.origin);
}

export function publicAppUrl() {
  return appUrl().toString().replace(/\/$/, '');
}
