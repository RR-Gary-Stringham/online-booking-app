import { NextRequest, NextResponse } from 'next/server';
import { zonedDateTimeToUtc } from '@/src/lib/date';
import { insertDelegatedGoogleEvent } from '@/src/lib/google-service-account';
import { appUrl } from '@/src/lib/app-url';
import { createBookingManagementToken } from '@/src/lib/booking-management-token';
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

    return NextResponse.json({
      success: true,
      eventId: primaryEvent.id,
      eventUrl: primaryEvent.htmlLink,
      meetingUrl: primaryEvent.hangoutLink,
      manageUrl,
      cancelUrl: `${manageUrl}#cancel`,
    });
  } catch (error) {
    if (error instanceof WebflowConfigurationError) {
      return NextResponse.json({ error: 'Booking storage is not configured.' }, { status: 503 });
    }
    console.error('[booking] Unable to create Google Calendar event.', error);
    return NextResponse.json({ error: 'The meeting could not be added to Google Calendar.' }, { status: 500 });
  }
}
