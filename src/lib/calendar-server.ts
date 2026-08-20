export interface BusyPeriod {
  start: string;
  end: string;
}

interface FreeBusyResponse {
  calendars?: Record<string, { busy?: BusyPeriod[] }>;
}

export async function fetchCalendarBusyPeriods({
  accessToken,
  calendarId = 'primary',
  timeMin,
  timeMax,
  timeZone,
}: {
  accessToken: string;
  calendarId?: string;
  timeMin: string;
  timeMax: string;
  timeZone: string;
}): Promise<BusyPeriod[]> {
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone,
      items: [{ id: calendarId }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Calendar FreeBusy request failed with ${response.status}.`);
  }

  const result = await response.json() as FreeBusyResponse;
  return result.calendars?.[calendarId]?.busy ?? [];
}
