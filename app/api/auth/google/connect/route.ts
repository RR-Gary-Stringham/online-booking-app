import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  assertGoogleOAuthConfiguration,
  GoogleOAuthConfigurationError,
  GOOGLE_OAUTH_STATE_COOKIE,
  googleAuthorizationUrl,
} from '@/src/lib/google-oauth-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Validate the complete server configuration before sending the provider
    // through Google consent, including the key needed by the callback.
    assertGoogleOAuthConfiguration();
    const state = randomBytes(24).toString('base64url');
    const response = NextResponse.redirect(googleAuthorizationUrl(state));
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof GoogleOAuthConfigurationError) {
      console.warn('[google-oauth] Authorization is not configured.', error.message);
      return NextResponse.json(
        { error: 'Google Calendar connection is not configured.' },
        { status: 503 },
      );
    }

    // No upstream request occurs in this route. Any non-configuration failure
    // here is an unexpected internal error, so 500 is more accurate than 503.
    console.error('[google-oauth] Unable to start authorization.', error);
    return NextResponse.json(
      { error: 'Google Calendar connection could not be started.' },
      { status: 500 },
    );
  }
}
