import { NextRequest, NextResponse } from 'next/server';
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  encryptGoogleSession,
  exchangeAuthorizationCode,
} from '@/src/lib/google-oauth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const appUrl = new URL('/app?google=connected', request.url);

  if (!code || !state || !expectedState || state !== expectedState) {
    appUrl.searchParams.set('google', 'error');
    return NextResponse.redirect(appUrl);
  }

  try {
    const session = await exchangeAuthorizationCode(code);
    const response = NextResponse.redirect(appUrl);
    response.cookies.set(GOOGLE_OAUTH_COOKIE, encryptGoogleSession(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch {
    appUrl.searchParams.set('google', 'error');
    return NextResponse.redirect(appUrl);
  }
}
