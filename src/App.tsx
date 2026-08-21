'use client';

import React, { useState, useEffect } from 'react';
import ClientWidget from './components/ClientWidget';
import AdminDashboard from './components/AdminDashboard';
import { loadWidgetData, saveWidgetData, FullWidgetData } from './lib/storage';
import { Booking, MeetingType, ProviderSettings, WeeklyWorkingDay } from './types';
import { Globe, ShieldAlert, Sparkles, Layout, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CalendarEvent } from './lib/googleCalendar';

const appApiPath = (path: string) =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/app')
    ? `/app${path}`
    : path;

export default function App() {
  // Check if iframe rendering mode
  const [isEmbedMode, setIsEmbedMode] = useState(false);

  // App wide state loaded from helper
  const [data, setData] = useState<FullWidgetData | null>(null);

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
    setIsLoadingEvents(true);
    fetch(appApiPath('/api/auth/google/status'), { cache: 'no-store' })
      .then((response) => response.json())
      .then((status) => {
        setGoogleToken(status.connected ? 'server-session' : null);
        setGoogleUser(status.user ?? null);
      })
      .catch(() => {
        setGoogleToken(null);
        setGoogleUser(null);
      })
      .finally(() => setIsLoadingEvents(false));
  }, []);

  const handleGoogleSignIn = async () => {
    window.location.assign(appApiPath('/api/auth/google/connect'));
  };

  const handleGoogleLogout = async () => {
    await fetch(appApiPath('/api/auth/google/status'), { method: 'DELETE' });
    setGoogleToken(null);
    setGoogleUser(null);
    setGoogleEvents([]);
  };

  useEffect(() => {
    // Detect embed flag on mount
    const checkEmbed = () => {
      const urlParams = new URLSearchParams(window.location.search);
      setIsEmbedMode(urlParams.get('embed') === 'true');
    };
    
    checkEmbed();
    
    // Load local storage initial state
    const loaded = loadWidgetData();
    setData(loaded);
  }, []);

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

        await fetch('/api/send-confirmation', {
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

  // If inside embed mode, return strict unpadded client-facing component
  if (isEmbedMode) {
    return (
      <div className="bg-transparent font-sans min-h-screen flex items-center justify-center p-1">
        <ClientWidget
          settings={data.settings}
          workingHours={data.workingHours}
          meetingTypes={data.meetingTypes}
          bookings={data.bookings}
          onAddBooking={handleAddBooking}
          isEmbedPreview={true}
          googleToken={googleToken}
          googleEvents={googleEvents}
          onGoogleSignIn={handleGoogleSignIn}
          onGoogleLogout={handleGoogleLogout}
          googleUser={googleUser}
        />
      </div>
    );
  }

  return (
    <div className="app-shell bg-slate-50/50 min-h-screen font-sans selection:bg-slate-800 selection:text-white flex flex-col justify-between">
      
      {/* Dynamic Selector Header */}
      <header className="bg-white border-b border-slate-100 py-3.5 px-6 shadow-xs sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Logo Brand info */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={17} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 tracking-tight font-display">Meeting Booking Widget</h1>
              <span className="text-[10px] text-slate-400 font-medium font-mono uppercase">Developer Playground</span>
            </div>
          </div>

          {/* Selector Toggles */}
          <div className="flex items-center gap-1.5 bg-slate-100/75 p-1 rounded-2xl border border-slate-200/50 shrink-0">
            <button
              id="switch-to-preview"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all font-display ${viewMode === 'preview' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Layout size={13} />
              <span>Live Widget View</span>
            </button>
            <button
              id="switch-to-admin"
              onClick={() => setViewMode('admin')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all font-display ${viewMode === 'admin' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <SettingsIcon size={13} />
              <span>Provider Workspace</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Sandbox Interactive Playground Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center gap-6">
        
        {/* Inline Simulation Alerts */}
        <div className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-3xs">
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5 sm:mt-0">
              <Globe size={15} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 leading-normal">
                {viewMode === 'preview' 
                  ? 'Client Booking Simulator: test how clients see your slots and make reservations.' 
                  : 'Provider Workspace Simulator: manage working days, modify durations, and configure embed parameters.'
                }
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Mock schedule synchronized dynamically with browser local persistence.</p>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 bg-slate-50 border border-slate-100 py-1.5 px-2.5 rounded-lg">
            <span>Client:</span>
            <b className="text-slate-700">{data.settings.name} (Rev Rebel)</b>
          </div>
        </div>

        {/* View switching render */}
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
                googleToken={googleToken}
                googleEvents={googleEvents}
                onGoogleSignIn={handleGoogleSignIn}
                onGoogleLogout={handleGoogleLogout}
                googleUser={googleUser}
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
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Humble Footer Branding */}
      <footer className="py-6 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-[11px] text-slate-400 font-medium">
            Meeting Booking Widget • Designed for high fidelity website embeds.
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            System local time: <span className="text-slate-600 font-semibold">2026-06-08 10:55 UTC</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
