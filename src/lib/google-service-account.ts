import { createSign } from 'node:crypto';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export class GoogleServiceAccountConfigurationError extends Error {
  constructor(name: string) {
    super(`Required Google service-account configuration is missing: ${name}.`);
    this.name = 'GoogleServiceAccountConfigurationError';
  }
}

function requireServiceAccountEnv(
  name:
    | 'GOOGLE_SERVICE_ACCOUNT_CLIENT_ID'
    | 'GOOGLE_SERVICE_ACCOUNT_EMAIL'
    | 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
) {
  const value = process.env[name]?.trim();
  if (!value) throw new GoogleServiceAccountConfigurationError(name);
  return value;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function serviceAccountPrivateKey() {
  return requireServiceAccountEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');
}

interface DelegatedToken {
  accessToken: string;
  expiresAt: number;
}

const delegatedTokenCache = new Map<string, DelegatedToken>();

export function assertGoogleServiceAccountConfiguration() {
  requireServiceAccountEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_ID');
  requireServiceAccountEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  serviceAccountPrivateKey();
}

export async function getDelegatedGoogleAccessToken(subject: string) {
  const normalizedSubject = subject.trim().toLowerCase();
  if (!normalizedSubject.endsWith('@revrebel.io')) {
    throw new Error('Delegated Google access is restricted to REVREBEL accounts.');
  }

  const cached = delegatedTokenCache.get(normalizedSubject);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;

  assertGoogleServiceAccountConfiguration();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: requireServiceAccountEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    sub: normalizedSubject,
    scope: GOOGLE_CALENDAR_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const unsignedAssertion = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedAssertion);
  signer.end();
  const assertion = `${unsignedAssertion}.${signer.sign(serviceAccountPrivateKey(), 'base64url')}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Delegated Google authorization failed with ${response.status}.`);
  }

  const token = await response.json() as { access_token: string; expires_in: number };
  delegatedTokenCache.set(normalizedSubject, {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  });
  return token.access_token;
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  timeZone?: string;
}

export async function listDelegatedGoogleCalendars(subject: string) {
  const accessToken = await getDelegatedGoogleAccessToken(subject);
  const calendars: GoogleCalendarListEntry[] = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ maxResults: '250', showHidden: 'false' });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Google calendar discovery failed with ${response.status}.`);
    const result = await response.json() as {
      items?: Array<{
        id?: string;
        summary?: string;
        primary?: boolean;
        accessRole?: string;
        timeZone?: string;
      }>;
      nextPageToken?: string;
    };
    calendars.push(...(result.items ?? [])
      .filter((item): item is typeof item & { id: string } => Boolean(item.id))
      .map((item) => ({
        id: item.id,
        summary: item.summary || item.id,
        primary: item.primary === true,
        accessRole: item.accessRole || 'none',
        timeZone: item.timeZone,
      })));
    pageToken = result.nextPageToken || '';
  } while (pageToken);

  return calendars.filter((calendar) => ['owner', 'writer'].includes(calendar.accessRole));
}

export async function createDelegatedGoogleCalendar(subject: string, summary: string, timeZone = 'America/Los_Angeles') {
  const accessToken = await getDelegatedGoogleAccessToken(subject);
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary, timeZone }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google calendar creation failed with ${response.status}.`);
  return response.json() as Promise<{ id: string; summary: string; timeZone?: string }>;
}

export async function insertDelegatedGoogleEvent(input: {
  subject: string;
  calendarId: string;
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  attendee?: { email: string; displayName: string };
  createConference?: boolean;
}) {
  const accessToken = await getDelegatedGoogleAccessToken(input.subject);
  const params = new URLSearchParams({
    sendUpdates: input.attendee ? 'all' : 'none',
    conferenceDataVersion: input.createConference ? '1' : '0',
  });
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events?${params}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startIso, timeZone: input.timeZone },
        end: { dateTime: input.endIso, timeZone: input.timeZone },
        attendees: input.attendee ? [input.attendee] : undefined,
        conferenceData: input.createConference ? {
          createRequest: {
            requestId: `revrebel-${crypto.randomUUID()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        } : undefined,
      }),
      cache: 'no-store',
    },
  );
  if (!response.ok) throw new Error(`Google event creation failed with ${response.status}.`);
  return response.json() as Promise<{ id: string; htmlLink?: string; hangoutLink?: string }>;
}

export async function getDelegatedGoogleEvent(input: { subject: string; calendarId: string; eventId: string }) {
  const accessToken = await getDelegatedGoogleAccessToken(input.subject);
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
  );
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error(`Google event lookup failed with ${response.status}.`);
  return response.json() as Promise<{ status?: string; htmlLink?: string }>;
}

export async function deleteDelegatedGoogleEvent(input: {
  subject: string;
  calendarId: string;
  eventId: string;
  notifyAttendee?: boolean;
}) {
  const accessToken = await getDelegatedGoogleAccessToken(input.subject);
  const params = new URLSearchParams({ sendUpdates: input.notifyAttendee ? 'all' : 'none' });
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}?${params}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
  );
  if (response.status === 404 || response.status === 410) return;
  if (!response.ok) throw new Error(`Google event cancellation failed with ${response.status}.`);
}
