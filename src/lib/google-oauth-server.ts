import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { appUrl } from './app-url';

export const GOOGLE_OAUTH_COOKIE = 'revrebel_google_oauth';
export const GOOGLE_OAUTH_STATE_COOKIE = 'revrebel_google_oauth_state';

export interface GoogleOAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  name?: string;
  picture?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

export class GoogleOAuthConfigurationError extends Error {
  constructor(variableName: string) {
    super(`Required Google OAuth configuration is missing: ${variableName}.`);
    this.name = 'GoogleOAuthConfigurationError';
  }
}

function requireEnv(
  name:
    | 'GOOGLE_CLIENT_ID'
    | 'GOOGLE_CLIENT_SECRET'
    | 'TOKEN_ENCRYPTION_KEY',
) {
  const value = process.env[name];
  if (!value) throw new GoogleOAuthConfigurationError(name);
  return value;
}

export function assertGoogleOAuthConfiguration() {
  requireEnv('GOOGLE_CLIENT_ID');
  requireEnv('GOOGLE_CLIENT_SECRET');
  requireEnv('TOKEN_ENCRYPTION_KEY');
  appUrl('/api/auth/google/callback');
}

function encryptionKey() {
  const source = requireEnv('TOKEN_ENCRYPTION_KEY');
  return createHash('sha256').update(source).digest();
}

export function googleAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: appUrl('/api/auth/google/callback').toString(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' '),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeAuthorizationCode(code: string): Promise<GoogleOAuthSession> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: appUrl('/api/auth/google/callback').toString(),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed with ${response.status}.`);
  }

  const tokens = await response.json() as GoogleTokenResponse;
  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: 'no-store',
  });
  const profile = profileResponse.ok
    ? await profileResponse.json() as { email?: string; name?: string; picture?: string }
    : {};

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  };
}

export function encryptGoogleSession(session: GoogleOAuthSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptGoogleSession(value?: string): GoogleOAuthSession | null {
  if (!value) return null;
  try {
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as GoogleOAuthSession;
  } catch {
    return null;
  }
}

export async function getValidAccessToken(session: GoogleOAuthSession) {
  if (session.expiresAt > Date.now() + 60_000) return { accessToken: session.accessToken, session };
  if (!session.refreshToken) throw new Error('Google authorization expired. Reconnect the calendar.');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google token refresh failed with ${response.status}.`);
  const tokens = await response.json() as GoogleTokenResponse;
  const refreshed = {
    ...session,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  return { accessToken: refreshed.accessToken, session: refreshed };
}
