'use client';

import React, { useState, useEffect } from 'react';
import ClientWidget from './components/ClientWidget';
import AdminDashboard from './components/AdminDashboard';
import { loadWidgetData, saveWidgetData, FullWidgetData } from './lib/storage';
import { Booking, MeetingType, ProviderSettings, WeeklyWorkingDay } from './types';
import type { BookingPageContent } from './types';
import { motion, AnimatePresence } from 'motion/react';
import type { CalendarEvent } from './lib/googleCalendar';

const appApiUrl = (publicAppUrl: string, path: string) =>
  `${publicAppUrl.replace(/\/$/, '')}${path}`;

export default function App({ publicAppUrl }: { publicAppUrl: string }) {
  // Check if iframe rendering mode
  const [isEmbedMode, setIsEmbedMode] = useState(false);
  const [calendarSlug, setCalendarSlug] = useState('');

  // App wide state loaded from helper
  const [data, setData] = useState<FullWidgetData | null>(null);
  const [isDataReady, setIsDataReady] = useState(false);

  // View mode inside parent wrapper: 'preview' (client booking) | 'admin' (provider controls)
  const [viewMode, setViewMode] = useState<'preview' | 'admin'>('preview');

  // Google Calendar Integration states
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<any | null>(null);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Read only non-sensitive connection metadata. OAuth tokens remain in an
  // encrypted, HTTP-only server cookie and are never exposed to this client.
  useEffect(() => {
    const workspaceRequested = new URLSearchParams(window.location.search).get('workspace') === 'true';
    setIsLoadingEvents(true);
    fetch(appApiUrl(publicAppUrl, '/api/auth/google/status'), { cache: 'no-store' })
      .then((response) => response.json())
      .then((status) => {
        setGoogleToken(status.connected ? 'server-session' : null);
        setGoogleUser(status.user ?? null);
        if (workspaceRequested) {
          if (status.connected) setViewMode('admin');
          else window.location.assign(appApiUrl(publicAppUrl, '/api/auth/google/connect'));
        }
      })
      .catch(() => {
        setGoogleToken(null);
        setGoogleUser(null);
      })
      .finally(() => setIsLoadingEvents(false));
  }, [publicAppUrl]);

  const handleGoogleSignIn = async () => {
    window.location.assign(appApiUrl(publicAppUrl, '/api/auth/google/connect'));
  };

  const handleGoogleLogout = async () => {
    await fetch(appApiUrl(publicAppUrl, '/api/auth/google/status'), { method: 'DELETE' });
    setGoogleToken(null);
    setGoogleUser(null);
    setGoogleEvents([]);
  };

  useEffect(() => {
    // Detect embed flag on mount
    const checkEmbed = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const embedMode = urlParams.get('embed') === 'true';
      setIsEmbedMode(embedMode);
      setCalendarSlug(urlParams.get('calendar')?.trim().toLowerCase() ?? '');
      if (embedMode) setViewMode('preview');
      else if (urlParams.get('google') === 'connected') setViewMode('admin');
    };
    
    checkEmbed();
    
    // Load local storage initial state
    const loaded = loadWidgetData();
    setData(loaded);
    setIsDataReady(true);
  }, []);

  useEffect(() => {
    if (!calendarSlug || !isDataReady) return;

    const controller = new AbortController();
    fetch(appApiUrl(publicAppUrl, `/api/booking-pages/${encodeURIComponent(calendarSlug)}`), {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Booking page lookup failed with ${response.status}.`);
        return response.json() as Promise<BookingPageContent>;
      })
      .then((page) => {
        const fullName = [page.firstName, page.lastName].filter(Boolean).join(' ');
        setData((current) => current ? {
          ...current,
          settings: {
            ...current.settings,
            name: fullName || (page.isUserTemplate ? current.settings.name : 'REVREBEL'),
            firstName: page.firstName || undefined,
            lastName: page.lastName || undefined,
            profileImageUrl: page.userImageUrl,
          },
        } : current);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('[booking-page] Unable to load CMS configuration.', error);
      });

    return () => controller.abort();
  }, [calendarSlug, isDataReady, publicAppUrl]);

  useEffect(() => {
    if (isEmbedMode || !googleUser?.displayName) return;
    const nameParts = googleUser.displayName.trim().split(/\s+/);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    setData((current) => current ? {
      ...current,
      settings: {
        ...current.settings,
        name: googleUser.displayName,
        firstName,
        lastName,
      },
    } : current);
  }, [googleUser, isEmbedMode]);

  useEffect(() => {
    if (!isEmbedMode || window.parent === window) return;

    const reportHeight = () => {
      window.parent.postMessage(
        {
          type: 'rr-booking-resize',
          height: document.documentElement.scrollHeight,
        },
        '*',
      );
    };

    const resizeObserver = new ResizeObserver(reportHeight);
    resizeObserver.observe(document.body);
    reportHeight();

    return () => resizeObserver.disconnect();
  }, [isEmbedMode, data, viewMode]);

  // Sync methods back to storage
  const handleUpdateSettings = (newSettings: ProviderSettings) => {
    if (!data) return;
    const updated = { ...data, settings: newSettings };
    setData(updated);
    saveWidgetData(updated);
  };

  const handleUpdateWorkingHours = (newHours: WeeklyWorkingDay[]) => {
    if (!data) return;
    const updated = { ...data, workingHours: newHours };
    setData(updated);
    saveWidgetData(updated);
  };

  const handleUpdateMeetingTypes = (newTypes: MeetingType[]) => {
    if (!data) return;
    const updated = { ...data, meetingTypes: newTypes };
    setData(updated);
    saveWidgetData(updated);
  };

  const handleUpdateBookings = (newBookings: Booking[]) => {
    if (!data) return;
    const updated = { ...data, bookings: newBookings };
    setData(updated);
    saveWidgetData(updated);
  };

  const handleAddBooking = async (newBookingData: Omit<Booking, 'id' | 'createdAt' | 'status'>) => {
    if (!data) return;
    const bookingId = 'b-' + Math.floor(Math.random() * 10000000);
    const newBooking: Booking = {
      ...newBookingData,
      id: bookingId,
      status: 'confirmed', // Auto confirm for easy simulation
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...data,
      bookings: [newBooking, ...data.bookings],
    };
    setData(updated);
    saveWidgetData(updated);

    // Dispatch beautiful branded notifications in real-time if Brevo API is configured
    if (data.settings.brevoApiKey) {
      try {
        const meetingType = data.meetingTypes.find((t) => t.id === newBookingData.meetingTypeId);
        const durationMinutes = meetingType ? meetingType.duration : 15;
        
        // Build robust human-readable date representation
        const [yearStr, monthStr, dateStr] = newBookingData.date.split('-');
        const dateObjInstance = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dateStr, 10));
        const formattedDate = dateObjInstance.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        // Parse robust human-readable time representation in 12h formats
        const [hStr, mStr] = newBookingData.time.split(':');
        const h = parseInt(hStr, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        const formattedTime = `${h12}:${mStr} ${ampm}`;

        await fetch(appApiUrl(publicAppUrl, '/api/send-confirmation'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientEmail: newBookingData.clientEmail,
            clientName: newBookingData.clientName,
            meetingType: meetingType ? meetingType.name : 'Consultation',
            dateTime: `${formattedDate} at ${formattedTime}`,
            providerName: data.settings.name,
            meetingDuration: durationMinutes,
            referenceId: bookingId,
            brevoSenderEmail: data.settings.brevoSenderEmail,
            brevoSenderName: data.settings.brevoSenderName,
            customNotes: newBookingData.clientNotes,
          })
        });
      } catch (err) {
        console.error("Failed to dispatch Brevo transactional email:", err);
      }
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-slate-800 animate-spin" />
        <span className="text-xs font-semibold text-slate-400 mt-3 font-mono">Initializing Scheduler...</span>
      </div>
    );
  }

  if (isEmbedMode) {
    return (
      <ClientWidget
        settings={data.settings}
        workingHours={data.workingHours}
        meetingTypes={data.meetingTypes}
        bookings={data.bookings}
        onAddBooking={handleAddBooking}
        googleEvents={googleEvents}
        googleUser={null}
        isEmbedPreview={true}
        providerWorkspaceUrl={appApiUrl(publicAppUrl, '?workspace=true')}
      />
    );
  }

  return (
    <div className="app-shell bg-slate-50/50 min-h-screen font-sans selection:bg-slate-800 selection:text-white flex items-center">
      <main className="w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {viewMode === 'preview' ? (
            <motion.div
              key="widget-preview"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.15 }}
            >
              <ClientWidget
                settings={data.settings}
                workingHours={data.workingHours}
                meetingTypes={data.meetingTypes}
                bookings={data.bookings}
                onAddBooking={handleAddBooking}
                googleEvents={googleEvents}
                googleUser={googleUser}
                isEmbedPreview={false}
                onOpenProviderWorkspace={() => {
                  if (googleToken) setViewMode('admin');
                  else void handleGoogleSignIn();
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="workspace-dashboard"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.15 }}
            >
              <AdminDashboard
                settings={data.settings}
                workingHours={data.workingHours}
                meetingTypes={data.meetingTypes}
                bookings={data.bookings}
                onUpdateSettings={handleUpdateSettings}
                onUpdateWorkingHours={handleUpdateWorkingHours}
                onUpdateMeetingTypes={handleUpdateMeetingTypes}
                onUpdateBookings={handleUpdateBookings}
                googleToken={googleToken}
                googleUser={googleUser}
                onGoogleSignIn={handleGoogleSignIn}
                onGoogleLogout={handleGoogleLogout}
                publicAppUrl={publicAppUrl}
                onBackToBooking={() => setViewMode('preview')}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
