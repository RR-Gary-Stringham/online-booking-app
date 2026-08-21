import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { GOOGLE_OAUTH_STATE_COOKIE, googleAuthorizationUrl } from '@/src/lib/google-oauth-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
  } catch {
    return NextResponse.json({ error: 'Google Calendar connection is unavailable.' }, { status: 503 });
  }
}
