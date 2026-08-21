export interface WeeklyWorkingDay {
  day: string;
  enabled: boolean;
  startTime: string; // "09:00"
  endTime: string; // "17:00"
}

export interface MeetingType {
  id: string;
  name: string;
  duration: number; // in minutes
  description: string;
  color: string; // tailwind color class e.g., "blue_theme"
  enabled: boolean;
}

export interface Booking {
  id: string;
  meetingTypeId: string;
  clientName: string;
  clientEmail: string;
  clientNotes: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string; // ISO string
  clientTimezone?: string;
  providerTimezone?: string;
}

export interface ProviderSettings {
  name: string;
  email: string;
  businessName: string;
  welcomeMessage: string;
  timezone: string;
  colorTheme: string; // "indigo" | "emerald" | "amber" | "rose" | "teal" | "slate"
  brevoApiKey?: string;
  brevoSenderEmail?: string;
  brevoSenderName?: string;
}
