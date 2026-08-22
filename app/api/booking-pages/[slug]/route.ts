import { NextResponse } from 'next/server';
import { bookingPageContent, WebflowConfigurationError } from '@/src/lib/webflow-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = decodeURIComponent(rawSlug).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: 'Invalid booking page.' }, { status: 400 });
    }

    const content = await bookingPageContent(slug);
    return content
      ? NextResponse.json(content)
      : NextResponse.json({ error: 'Booking page not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof WebflowConfigurationError) {
      console.warn('[webflow] Public booking-page configuration is incomplete.', error.message);
      return NextResponse.json({ error: 'Booking page is unavailable.' }, { status: 503 });
    }
    console.error('[webflow] Unable to load booking page.', error);
    return NextResponse.json({ error: 'Booking page is unavailable.' }, { status: 502 });
  }
}
