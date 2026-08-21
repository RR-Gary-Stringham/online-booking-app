import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleOAuthConfigurationError,
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  encryptGoogleSession,
  exchangeAuthorizationCode,
} from '@/src/lib/google-oauth-server';
import { appUrl, AppUrlConfigurationError } from '@/src/lib/app-url';

export const dynamic = 'force-dynamic';

function redirectWithClearedState(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return response;
}

function googleErrorRedirect(appUrl: URL, reason: 'invalid-state' | 'configuration' | 'unexpected') {
  appUrl.searchParams.set('google', 'error');
  appUrl.searchParams.set('retry', 'connect-calendar');
  appUrl.searchParams.set('reason', reason);
  return redirectWithClearedState(appUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  let returnUrl: URL | null = null;

  try {
    returnUrl = appUrl('?google=connected');

    if (!code || !state || !expectedState || state !== expectedState) {
      return googleErrorRedirect(returnUrl, 'invalid-state');
    }

    const session = await exchangeAuthorizationCode(code);
    const response = NextResponse.redirect(returnUrl);
    response.cookies.set(GOOGLE_OAUTH_COOKIE, encryptGoogleSession(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    if (error instanceof GoogleOAuthConfigurationError || error instanceof AppUrlConfigurationError) {
      console.warn('[google-oauth] Callback configuration is incomplete.', error.message);
      return returnUrl
        ? googleErrorRedirect(returnUrl, 'configuration')
        : NextResponse.json(
            { error: 'Google Calendar connection is not configured.' },
            { status: 503 },
          );
    }

    console.error('[google-oauth] Authorization callback failed.', error);
    return returnUrl
      ? googleErrorRedirect(returnUrl, 'unexpected')
      : NextResponse.json(
          { error: 'Google Calendar connection could not be completed.' },
          { status: 500 },
        );
  }
}
