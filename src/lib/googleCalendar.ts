import { Booking, MeetingType } from '../types';

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
}

// Fetch live google calendar events
export const fetchGoogleEvents = async (accessToken: string, timeMin: string): Promise<CalendarEvent[]> => {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=100`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Google Calendar request failed (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    return data.items || [];
  } catch (error) {
    console.error('Failed to retrieve live Google Calendar events:', error);
    return [];
  }
};

// Create a new calendar event with optional Google Meet generation
export const insertGoogleEvent = async (
  accessToken: string,
  eventData: {
    summary: string;
    description: string;
    startTimeIso: string; // ISO String including timezone
    endTimeIso: string;
    timezone: string;
    clientEmail: string;
    clientName: string;
  }
) => {
  try {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none';
    
    const body = {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.startTimeIso,
        timeZone: eventData.timezone,
      },
      end: {
        dateTime: eventData.endTimeIso,
        timeZone: eventData.timezone,
      },
      attendees: [
        { email: eventData.clientEmail, displayName: eventData.clientName }
      ],
      conferenceData: {
        createRequest: {
          requestId: `booking-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errResponse = await res.text();
      throw new Error(`Failed to insert calendar event (${res.status}): ${errResponse}`);
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to register event to Google Calendar:', error);
    throw error;
  }
};
