import { NextResponse } from 'next/server';
import { deleteDelegatedGoogleEvent, getDelegatedGoogleEvent } from '@/src/lib/google-service-account';
import { readBookingManagementToken } from '@/src/lib/booking-management-token';
import { appUrl } from '@/src/lib/app-url';
import { sendBrevoBookingEmail } from '@/src/lib/brevo-server';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  const booking = readBookingManagementToken(token);
  if (!booking) return NextResponse.json({ error: 'This management link is invalid or expired.' }, { status: 404 });

  try {
    const primary = booking.events.find((event) => event.notifyAttendee) || booking.events[0];
    const event = primary ? await getDelegatedGoogleEvent(primary) : null;
    return NextResponse.json({
      clientName: booking.clientName,
      summary: booking.summary,
      startIso: booking.startIso,
      endIso: booking.endIso,
      timeZone: booking.timeZone,
      slug: booking.slug,
      cancelled: !event || event.status === 'cancelled',
    });
  } catch (error) {
    console.error('[booking-management] Unable to load event.', error);
    return NextResponse.json({ error: 'The meeting details are temporarily unavailable.' }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { token } = await context.params;
  const booking = readBookingManagementToken(token);
  if (!booking) return NextResponse.json({ error: 'This management link is invalid or expired.' }, { status: 404 });

  try {
    const secondary = booking.events.filter((event) => !event.notifyAttendee);
    const primary = booking.events.filter((event) => event.notifyAttendee);
    await Promise.all(secondary.map((event) => deleteDelegatedGoogleEvent(event)));
    await Promise.all(primary.map((event) => deleteDelegatedGoogleEvent(event)));
    const manageUrl = appUrl(`/manage/${token}`).toString();
    const rescheduleUrl = appUrl(`/?calendar=${encodeURIComponent(booking.slug)}&reschedule=${encodeURIComponent(token)}`).toString();
    try {
      await sendBrevoBookingEmail({
        kind: 'cancellation',
        recipientEmail: booking.clientEmail,
        recipientName: booking.clientName,
        params: {
          FIRST_NAME: booking.clientName.trim().split(/\s+/)[0] || 'Partner',
          FIRSTNAME: booking.clientName.trim().split(/\s+/)[0] || 'Partner',
          INTERNAL_NAME: booking.providerName || 'REVREBEL',
          MEETING_TIME: booking.startIso,
          MEETING_LINK: '',
          CANCEL_LINK: manageUrl,
          RESCHEDULE_LINK: rescheduleUrl,
          OUTLOOK_CAL: '',
          GOOGLE_CAL: '',
        },
      });
      return NextResponse.json({ success: true, emailSent: true });
    } catch (emailError) {
      console.error('[booking-management] Meeting cancelled, but cancellation email failed.', emailError);
      return NextResponse.json({ success: true, emailSent: false });
    }
  } catch (error) {
    console.error('[booking-management] Unable to cancel event.', error);
    return NextResponse.json({ error: 'The meeting could not be cancelled. Please try again.' }, { status: 503 });
  }
}
