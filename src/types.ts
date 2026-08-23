export interface WeeklyWorkingDay {
  day: string;
  enabled: boolean;
  startTime: string; // "09:00"
  endTime: string; // "17:00"
}

export interface MeetingType {
  id: string;
  name: string;
  slug?: string;
  duration: number; // in minutes
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  description: string;
  assignedUsers?: string[];
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
  firstName?: string;
  lastName?: string;
  email: string;
  businessName: string;
  welcomeMessage: string;
  timezone: string;
  colorTheme: string; // "indigo" | "emerald" | "amber" | "rose" | "teal" | "slate"
  brevoApiKey?: string;
  brevoSenderEmail?: string;
  brevoSenderName?: string;
  profileImageUrl?: string;
  isUserTemplate?: boolean;
}

export interface BookingPageContent {
  name: string;
  slug: string;
  meetingTemplate: string;
  firstName: string;
  lastName: string;
  templateName: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  description: string;
  isUserTemplate: boolean;
  userImageUrl?: string;
  meetingDurations: number[];
  useTheme: boolean;
  themeOption: string;
  themeBackground: string;
  themeForeground: string;
}

export interface BookingPageAssignedUser {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  templateName: string;
  googleCalendarId: string;
}

export interface CalendarTemplate extends BookingPageContent {
  id: string;
  googleCalendarId: string;
  assignedUserIds: string[];
  assignedUsers: BookingPageAssignedUser[];
}
