import { NextRequest, NextResponse } from 'next/server';
import { decryptGoogleSession, GOOGLE_OAUTH_COOKIE } from '@/src/lib/google-oauth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = decryptGoogleSession(request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value);
  return NextResponse.json({
    connected: Boolean(session),
    user: session ? { email: session.email, displayName: session.name, photoURL: session.picture } : null,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ connected: false });
  response.cookies.set(GOOGLE_OAUTH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
