import { WeeklyWorkingDay, MeetingType, Booking, ProviderSettings } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'booking_widget_settings_v1',
  BOOKINGS: 'booking_widget_bookings_v1',
};

const DEFAULT_SETTINGS: ProviderSettings = {
  name: 'Gary',
  email: 'gary@revrebel.io',
  businessName: 'Rev Rebel Strategy',
  welcomeMessage: 'Welcome! Browse my real-time availability below and schedule a 1:1 strategy session with me in minutes. Once booked, we\'ll automatically generate your calendar link.',
  timezone: 'America/New_York',
  colorTheme: 'revrebel',
  brevoApiKey: '',
  brevoSenderEmail: 'notifications@revrebel.io',
  brevoSenderName: 'Rev Rebel Strategy',
};

const DEFAULT_WORKING_HOURS: WeeklyWorkingDay[] = [
  { day: 'Monday', enabled: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Tuesday', enabled: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Wednesday', enabled: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Thursday', enabled: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Friday', enabled: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Saturday', enabled: false, startTime: '10:00', endTime: '15:00' },
  { day: 'Sunday', enabled: false, startTime: '10:00', endTime: '15:00' },
];

const DEFAULT_MEETING_TYPES: MeetingType[] = [
  {
    id: 'mt-1',
    name: 'Quick Consultation',
    duration: 15,
    description: 'Great for asking quick questions, reviewing brief proposals, or introductory agency syncs.',
    color: 'indigo',
    enabled: true,
  },
  {
    id: 'mt-2',
    name: 'Deep Dive Strategy Session',
    duration: 30,
    description: 'A structured meeting to break down target objectives, analyze pain points, and outline high-level operational workflows.',
    color: 'emerald',
    enabled: true,
  },
  {
    id: 'mt-3',
    name: 'Strategic Growth Review',
    duration: 60,
    description: 'Comprehensive project review, milestone planning, and revenue/growth engineering deep-dives.',
    color: 'amber',
    enabled: true,
  },
  {
    id: 'mt-4',
    name: 'Extended Strategy Session',
    duration: 90,
    description: 'An extended working session for complex planning, collaborative reviews, and in-depth strategic development.',
    color: 'dark-blue',
    enabled: true,
  },
];

// Seed initial bookings for a live dashboard feel (2026-06-08 is current date)
const getInitialBookings = (): Booking[] => {
  return [
    {
      id: 'b-1',
      meetingTypeId: 'mt-1',
      clientName: 'Sarah Jenkins',
      clientEmail: 'sarah@innovate.co',
      clientNotes: 'Would like to go over our Q3 strategy outline and discuss engagement scope.',
      date: '2026-06-09',
      time: '10:00',
      status: 'confirmed',
      createdAt: '2026-06-08T09:12:00Z',
    },
    {
      id: 'b-2',
      meetingTypeId: 'mt-2',
      clientName: 'Marcus Chen',
      clientEmail: 'marcus@vanguard.dev',
      clientNotes: 'Exploring migration of our operations backend. Looking to understand timeline and team setup.',
      date: '2026-06-09',
      time: '14:30',
      status: 'pending',
      createdAt: '2026-06-08T08:30:00Z',
    },
    {
      id: 'b-3',
      meetingTypeId: 'mt-3',
      clientName: 'Elena Rostova',
      clientEmail: 'elena.r@growthlabs.io',
      clientNotes: 'Monthly agency sync. I\'ll bring the latest conversion rate optimization reports.',
      date: '2026-06-10',
      time: '11:00',
      status: 'confirmed',
      createdAt: '2026-06-07T14:45:00Z',
    },
  ];
};

export interface FullWidgetData {
  settings: ProviderSettings;
  workingHours: WeeklyWorkingDay[];
  meetingTypes: MeetingType[];
  bookings: Booking[];
}

export const loadWidgetData = (): FullWidgetData => {
  try {
    const settingsRaw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const bookingsRaw = localStorage.getItem(STORAGE_KEYS.BOOKINGS);

    let parsedSettings: any = {};
    if (settingsRaw) {
      parsedSettings = JSON.parse(settingsRaw);
    }

    const settings: ProviderSettings = {
      ...DEFAULT_SETTINGS,
      ...(parsedSettings.settings || {}),
    };

    const workingHours: WeeklyWorkingDay[] = 
      parsedSettings.workingHours || DEFAULT_WORKING_HOURS;

    const meetingTypes: MeetingType[] = 
      parsedSettings.meetingTypes || DEFAULT_MEETING_TYPES;

    const bookings: Booking[] = bookingsRaw 
      ? JSON.parse(bookingsRaw) 
      : getInitialBookings();

    return { settings, workingHours, meetingTypes, bookings };
  } catch (error) {
    console.error('Failed to load storage data:', error);
    return {
      settings: DEFAULT_SETTINGS,
      workingHours: DEFAULT_WORKING_HOURS,
      meetingTypes: DEFAULT_MEETING_TYPES,
      bookings: getInitialBookings(),
    };
  }
};

export const saveWidgetData = (data: FullWidgetData): void => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({
        settings: data.settings,
        workingHours: data.workingHours,
        meetingTypes: data.meetingTypes,
      })
    );
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(data.bookings));
  } catch (error) {
    console.error('Failed to save storage data:', error);
  }
};
