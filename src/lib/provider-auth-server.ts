import type { NextRequest, NextResponse } from 'next/server';
import {
  decryptGoogleSession,
  encryptGoogleSession,
  getValidAccessToken,
  GOOGLE_OAUTH_COOKIE,
} from './google-oauth-server';
import type { GoogleOAuthSession } from './google-oauth-server';

export async function requireProviderSession(request: NextRequest) {
  const storedSession = decryptGoogleSession(request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value);
  if (!storedSession?.email || !storedSession.email.toLowerCase().endsWith('@revrebel.io')) {
    return null;
  }
  const { session } = await getValidAccessToken(storedSession);
  return { session, storedSession };
}

export function refreshProviderCookie(
  response: NextResponse,
  session: GoogleOAuthSession,
  storedSession: GoogleOAuthSession,
) {
  if (session === storedSession) return response;
  response.cookies.set(GOOGLE_OAUTH_COOKIE, encryptGoogleSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
