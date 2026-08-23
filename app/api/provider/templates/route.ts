import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCalendarTemplate,
  listBookingPages,
  saveCalendarTemplate,
  slugify,
  WebflowConfigurationError,
} from '@/src/lib/webflow-server';
import type { CalendarTemplateInput } from '@/src/lib/webflow-server';
import { refreshProviderCookie, requireProviderSession } from '@/src/lib/provider-auth-server';

export const dynamic = 'force-dynamic';

function cleanString(value: unknown, maxLength = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function templateInput(body: Record<string, unknown>): CalendarTemplateInput | null {
  const name = cleanString(body.name, 256);
  const slug = slugify(cleanString(body.slug, 256) || name);
  const templateName = cleanString(body.templateName, 256) || name;
  const durations = Array.isArray(body.meetingDurations)
    ? [...new Set(body.meetingDurations
      .map(Number)
      .filter((value) => Number.isInteger(value) && value >= 5 && value <= 480))]
    : [];
  if (!name || !slug || durations.length === 0) return null;

  return {
    id: cleanString(body.id, 64) || undefined,
    name,
    slug,
    templateName,
    eyebrow: cleanString(body.eyebrow, 256),
    headline: cleanString(body.headline, 256),
    subheadline: cleanString(body.subheadline, 256),
    description: cleanString(body.description),
    isUserTemplate: body.isUserTemplate === true,
    firstName: cleanString(body.firstName, 128),
    lastName: cleanString(body.lastName, 128),
    googleCalendarId: cleanString(body.googleCalendarId, 1024),
    meetingDurations: durations,
    assignedUserIds: Array.isArray(body.assignedUserIds)
      ? body.assignedUserIds.map((id) => cleanString(id, 64)).filter(Boolean)
      : [],
    useTheme: body.useTheme === true,
    themeOption: cleanString(body.themeOption, 64),
    themeBackground: cleanString(body.themeBackground, 32),
    themeForeground: cleanString(body.themeForeground, 32),
  };
}

async function authorization(request: NextRequest) {
  const result = await requireProviderSession(request);
  if (!result) throw new Error('unauthorized');
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorization(request);
    const templates = await listBookingPages(false);
    return refreshProviderCookie(NextResponse.json({ templates }), auth.session, auth.storedSession);
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      return NextResponse.json({ error: 'An authorized REVREBEL account is required.' }, { status: 401 });
    }
    if (error instanceof WebflowConfigurationError) {
      return NextResponse.json({ error: 'Webflow template storage is not configured.' }, { status: 503 });
    }
    console.error('[webflow] Unable to load calendar templates.', error);
    return NextResponse.json({ error: 'Calendar templates could not be loaded.' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorization(request);
    const input = templateInput(await request.json() as Record<string, unknown>);
    if (!input) return NextResponse.json({ error: 'A name, slug, and at least one valid duration are required.' }, { status: 400 });
    await saveCalendarTemplate(input);
    const templates = await listBookingPages(false);
    return refreshProviderCookie(NextResponse.json({ templates }), auth.session, auth.storedSession);
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      return NextResponse.json({ error: 'An authorized REVREBEL account is required.' }, { status: 401 });
    }
    if (error instanceof WebflowConfigurationError) {
      return NextResponse.json({ error: 'Webflow template storage is not configured.' }, { status: 503 });
    }
    console.error('[webflow] Unable to save calendar template.', error);
    return NextResponse.json({ error: 'The calendar template could not be saved.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authorization(request);
    const id = cleanString(request.nextUrl.searchParams.get('id'), 64);
    if (!id) return NextResponse.json({ error: 'A template ID is required.' }, { status: 400 });
    await deleteCalendarTemplate(id);
    const templates = await listBookingPages(false);
    return refreshProviderCookie(NextResponse.json({ templates }), auth.session, auth.storedSession);
  } catch (error) {
    if (error instanceof Error && error.message === 'unauthorized') {
      return NextResponse.json({ error: 'An authorized REVREBEL account is required.' }, { status: 401 });
    }
    if (error instanceof WebflowConfigurationError) {
      return NextResponse.json({ error: 'Webflow template storage is not configured.' }, { status: 503 });
    }
    console.error('[webflow] Unable to delete calendar template.', error);
    return NextResponse.json({ error: 'The calendar template could not be deleted.' }, { status: 502 });
  }
}
