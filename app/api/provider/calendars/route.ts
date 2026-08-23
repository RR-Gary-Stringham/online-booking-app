import { NextRequest, NextResponse } from 'next/server';
import { listDelegatedGoogleCalendars, GoogleServiceAccountConfigurationError } from '@/src/lib/google-service-account';
import { refreshProviderCookie, requireProviderSession } from '@/src/lib/provider-auth-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireProviderSession(request);
    if (!authorization?.session.email) {
      return NextResponse.json({ error: 'An authorized REVREBEL account is required.' }, { status: 401 });
    }
    const calendars = await listDelegatedGoogleCalendars(authorization.session.email);
    return refreshProviderCookie(
      NextResponse.json({ calendars }),
      authorization.session,
      authorization.storedSession,
    );
  } catch (error) {
    if (error instanceof GoogleServiceAccountConfigurationError) {
      console.warn('[google-calendar] Delegated calendar access is not configured.', error.message);
      return NextResponse.json({ error: 'Delegated Google Calendar access is not configured.' }, { status: 503 });
    }
    console.error('[google-calendar] Unable to list delegated calendars.', error);
    return NextResponse.json({ error: 'Google calendars could not be loaded.' }, { status: 502 });
  }
}
