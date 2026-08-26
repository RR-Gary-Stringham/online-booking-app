import { NextRequest, NextResponse } from 'next/server';
import { zonedDateTimeToUtc } from '@/src/lib/date';
import { deleteDelegatedGoogleEvent, insertDelegatedGoogleEvent } from '@/src/lib/google-service-account';
import { appUrl } from '@/src/lib/app-url';
import { createBookingManagementToken, readBookingManagementToken } from '@/src/lib/booking-management-token';
import { listBookingPages, WebflowConfigurationError } from '@/src/lib/webflow-server';

export const dynamic = 'force-dynamic';

function stringValue(value: unknown, maxLength = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const slug = stringValue(body.calendarSlug, 256).toLowerCase();
    const clientName = stringValue(body.clientName, 256);
    const clientEmail = stringValue(body.clientEmail, 320).toLowerCase();
    const clientNotes = stringValue(body.clientNotes, 5000);
    const date = stringValue(body.date, 10);
    const time = stringValue(body.time, 5);
    const timeZone = stringValue(body.providerTimezone, 128);
    const duration = Number(body.duration);
    const rescheduleToken = stringValue(body.rescheduleToken, 10000);

    if (!/^[a-z0-9-]+$/.test(slug) || !clientName || !clientEmail.includes('@') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) ||
      !Number.isInteger(duration)) {
      return NextResponse.json({ error: 'The booking request is incomplete.' }, { status: 400 });
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    } catch {
      return NextResponse.json({ error: 'The booking timezone is invalid.' }, { status: 400 });
    }

    const pages = await listBookingPages(true);
    const page = pages.find((candidate) => candidate.slug === slug);
    if (!page || !page.meetingDurations.includes(duration)) {
      return NextResponse.json({ error: 'That meeting option is unavailable.' }, { status: 404 });
    }
    const previousBooking = rescheduleToken ? readBookingManagementToken(rescheduleToken) : null;
    if (rescheduleToken && (
      !previousBooking ||
      previousBooking.clientEmail.toLowerCase() !== clientEmail ||
      previousBooking.slug !== slug
    )) {
      return NextResponse.json({ error: 'The reschedule link is invalid or expired.' }, { status: 400 });
    }

    const start = zonedDateTimeToUtc(date, time, timeZone);
    const end = new Date(start.getTime() + duration * 60_000);
    if (start.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'That meeting time has already passed.' }, { status: 409 });
    }

    const assignedCalendarIds = page.assignedUsers.map((user) => user.googleCalendarId).filter(Boolean);
    const destinationCalendarId = page.googleCalendarId || assignedCalendarIds[0];
    if (!destinationCalendarId) {
      return NextResponse.json({ error: 'This meeting template has no Google Calendar assigned.' }, { status: 503 });
    }
    const delegationSubject = page.isUserTemplate
      ? page.googleCalendarId
      : assignedCalendarIds[0] || 'helpdesk@revrebel.io';
    const eventSummary = `${page.templateName || page.name} — ${clientName}`;
    const description = [clientNotes, `Booked through REVREBEL (${slug}).`].filter(Boolean).join('\n\n');
    const providerName = [page.firstName, page.lastName].filter(Boolean).join(' ') || page.templateName || page.name || 'REVREBEL';

    // Consume the previous event before creating its replacement. Google Calendar's
    // successful primary-event deletion is the single-use lock for this stateless token.
    if (previousBooking) {
      const secondary = previousBooking.events.filter((event) => !event.notifyAttendee);
      const primary = previousBooking.events.filter((event) => event.notifyAttendee);
      await Promise.all(secondary.map((event) => deleteDelegatedGoogleEvent(event)));
      const primaryDeletionResults = await Promise.all(primary.map((event) => (
        deleteDelegatedGoogleEvent({ ...event, notifyAttendee: false })
      )));
      if (primaryDeletionResults.length === 0 || !primaryDeletionResults.some(Boolean)) {
        return NextResponse.json(
          { error: 'This reschedule link has already been used.' },
          { status: 409 },
        );
      }
    }

    const primaryEvent = await insertDelegatedGoogleEvent({
      subject: delegationSubject,
      calendarId: destinationCalendarId,
      summary: eventSummary,
      description,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      timeZone,
      attendee: { email: clientEmail, displayName: clientName },
      createConference: true,
    });

    const blockCalendars = [...new Set(assignedCalendarIds)].filter((calendarId) => calendarId !== destinationCalendarId);
    const blockEvents = await Promise.all(blockCalendars.map(async (calendarId) => ({
      calendarId,
      event: await insertDelegatedGoogleEvent({
      subject: calendarId,
      calendarId,
      summary: eventSummary,
      description,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      timeZone,
      }),
    })));

    const managementToken = createBookingManagementToken({
      version: 1,
      slug,
      clientName,
      clientEmail,
      providerName,
      summary: eventSummary,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      timeZone,
      events: [
        { subject: delegationSubject, calendarId: destinationCalendarId, eventId: primaryEvent.id, notifyAttendee: true },
        ...blockEvents.map(({ calendarId, event }) => ({
          subject: calendarId,
          calendarId,
          eventId: event.id,
          notifyAttendee: false,
        })),
      ],
      expiresAt: Math.max(end.getTime() + 30 * 24 * 60 * 60_000, Date.now() + 90 * 24 * 60 * 60_000),
    });
    const manageUrl = appUrl(`/manage/${managementToken}`).toString();
    const rescheduleUrl = appUrl(`/?calendar=${encodeURIComponent(slug)}&reschedule=${encodeURIComponent(managementToken)}`).toString();
    const compactUtc = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace('.000', '');
    const googleCalUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalUrl.searchParams.set('action', 'TEMPLATE');
    googleCalUrl.searchParams.set('text', eventSummary);
    googleCalUrl.searchParams.set('dates', `${compactUtc(start)}/${compactUtc(end)}`);
    googleCalUrl.searchParams.set('details', description);
    const outlookCalUrl = new URL('https://outlook.office.com/calendar/0/deeplink/compose');
    outlookCalUrl.searchParams.set('subject', eventSummary);
    outlookCalUrl.searchParams.set('startdt', start.toISOString());
    outlookCalUrl.searchParams.set('enddt', end.toISOString());
    outlookCalUrl.searchParams.set('body', description);

    return NextResponse.json({
      success: true,
      eventId: primaryEvent.id,
      eventUrl: primaryEvent.htmlLink,
      meetingUrl: primaryEvent.hangoutLink,
      manageUrl,
      cancelUrl: `${manageUrl}#cancel`,
      rescheduleUrl,
      startIso: start.toISOString(),
      outlookCalUrl: outlookCalUrl.toString(),
      googleCalUrl: googleCalUrl.toString(),
      emailKind: previousBooking ? 'change' : 'confirmation',
    });
  } catch (error) {
    if (error instanceof WebflowConfigurationError) {
      return NextResponse.json({ error: 'Booking storage is not configured.' }, { status: 503 });
    }
    console.error('[booking] Unable to create Google Calendar event.', error);
    return NextResponse.json({ error: 'The meeting could not be added to Google Calendar.' }, { status: 500 });
  }
}
