import { NextRequest, NextResponse } from 'next/server';
import {
  decryptGoogleSession,
  encryptGoogleSession,
  getValidAccessToken,
  GOOGLE_OAUTH_COOKIE,
} from '@/src/lib/google-oauth-server';
import { ensureProviderBookingPage } from '@/src/lib/webflow-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = decryptGoogleSession(request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value);
  if (!session) return NextResponse.json({ connected: false, user: null });

  try {
    const { session: validSession } = await getValidAccessToken(session);
    try {
      await ensureProviderBookingPage(validSession);
    } catch (error) {
      console.error('[webflow] Unable to ensure provider booking page.', error);
    }
    const response = NextResponse.json({
      connected: true,
      user: {
        email: validSession.email,
        displayName: validSession.name,
        photoURL: validSession.picture,
      },
    });
    if (validSession !== session) {
      response.cookies.set(GOOGLE_OAUTH_COOKIE, encryptGoogleSession(validSession), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return response;
  } catch (error) {
    console.warn('[google-oauth] Stored authorization is no longer valid.', error);
    const response = NextResponse.json({ connected: false, user: null });
    response.cookies.delete(GOOGLE_OAUTH_COOKIE);
    return response;
  }
}

export async function DELETE() {
  const response = NextResponse.json({ connected: false });
  response.cookies.delete(GOOGLE_OAUTH_COOKIE);
  return response;
}
