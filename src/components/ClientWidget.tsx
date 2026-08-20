import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, User, Mail, MessageSquare, CheckCircle, ArrowLeft, Globe, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WeeklyWorkingDay, MeetingType, Booking, ProviderSettings } from '../types';
import { CalendarEvent } from '../lib/googleCalendar';

interface ClientWidgetProps {
  settings: ProviderSettings;
  workingHours: WeeklyWorkingDay[];
  meetingTypes: MeetingType[];
  bookings: Booking[];
  onAddBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'status'>) => void;
  isEmbedPreview?: boolean;
  googleToken?: string | null;
  googleEvents?: CalendarEvent[];
  onGoogleSignIn?: () => Promise<void>;
  onGoogleLogout?: () => void;
  googleUser?: any | null;
}

export default function ClientWidget({
  settings,
  workingHours,
  meetingTypes,
  bookings,
  onAddBooking,
  isEmbedPreview = false,
  googleToken = null,
  googleEvents = [],
  onGoogleSignIn,
  onGoogleLogout,
  googleUser = null,
}: ClientWidgetProps) {
  // Current client flow step: 'booking' | 'success'
  const [step, setStep] = useState<'booking' | 'success'>('booking');
  const [selectedType, setSelectedType] = useState<MeetingType | null>(null);
  
  // Date selection states
  const [selectedDateStr, setSelectedDateStr] = useState<string>(''); // YYYY-MM-DD
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(''); // HH:MM
  const [windowOffset, setWindowOffset] = useState<number>(0); // Paginate sliding 14-day date bar

  // Customer form state
  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentBookingId, setRecentBookingId] = useState('');

  // Active meeting types
  const activeMeetingTypes = useMemo(() => {
    return meetingTypes.filter((mt) => mt.enabled);
  }, [meetingTypes]);

  // Modern horizontal 14-day list computation starting from today (June 8, 2026)
  const baseToday = useMemo(() => new Date(2026, 5, 8), []); // June 8th, 2026

  const rowDays = useMemo(() => {
    const days: {
      date: Date;
      dateStr: string;
      dayLabel: string;
      dateLabel: string;
      isWorkingDay: boolean;
      isWeekend: boolean;
      fullDateStr: string;
    }[] = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(baseToday);
      d.setDate(baseToday.getDate() + windowOffset + i);
      
      const year = d.getFullYear();
      const month = d.getMonth();
      const dateNum = d.getDate();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
      
      const weekdayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayNameShort = weekdayNamesShort[d.getDay()];
      
      const weekdayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayNameFull = weekdayNamesFull[d.getDay()];
      
      // Look up if has working hours
      const workDayConfig = workingHours.find((wh) => wh.day === dayNameFull);
      const isWorkingDay = workDayConfig ? workDayConfig.enabled : false;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      
      days.push({
        date: d,
        dateStr,
        dayLabel: dayNameShort,
        dateLabel: String(dateNum),
        isWorkingDay: isWorkingDay && !isWeekend, // Only show working weekdays
        isWeekend,
        fullDateStr: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      });
    }
    return days;
  }, [windowOffset, workingHours, baseToday]);

  // Month-Year heading label based on selected view window
  const monthYearLabel = useMemo(() => {
    if (rowDays.length === 0) return '';
    const firstDay = rowDays[0].date;
    const lastDay = rowDays[rowDays.length - 1].date;
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    if (firstDay.getMonth() === lastDay.getMonth()) {
      return firstDay.toLocaleDateString('en-US', options);
    } else {
      return `${firstDay.toLocaleDateString('en-US', { month: 'short' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }
  }, [rowDays]);

  // Navigation callbacks for the sliding window
  const handleRowPrev = () => {
    setWindowOffset((prev) => Math.max(0, prev - 7));
  };

  const handleRowNext = () => {
    setWindowOffset((prev) => prev + 7);
  };

  // Determine working hours interval & calculate valid time slots
  const availableSlotsForSelectedDate = useMemo(() => {
    if (!selectedDateStr || !selectedType) return [];

    const parts = selectedDateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const dateNum = parseInt(parts[2], 10);
    const d = new Date(year, month, dateNum);

    const daysMapped = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeekStr = daysMapped[d.getDay()];

    const dayConfig = workingHours.find((wh) => wh.day === dayOfWeekStr);
    if (!dayConfig || !dayConfig.enabled) return [];

    const [startHour, startMin] = dayConfig.startTime.split(':').map(Number);
    const [endHour, endMin] = dayConfig.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const slotInterval = selectedType.duration;
    const slots: { time: string; isBooked: boolean; isPast: boolean }[] = [];

    for (let min = startMinutes; min + slotInterval <= endMinutes; min += slotInterval) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      // Check if booked locally
      let isBooked = bookings.some((b) => 
        b.date === selectedDateStr && 
        b.time === timeStr && 
        b.status !== 'cancelled'
      );

      // Overlap checking with Google Calendar
      const slotDateObj = new Date(year, month, dateNum, h, m);
      const slotEndDateObj = new Date(slotDateObj.getTime() + slotInterval * 60 * 1000);

      if (!isBooked && googleEvents && googleEvents.length > 0) {
        isBooked = googleEvents.some((ge) => {
          if (!ge.start?.dateTime || !ge.end?.dateTime) {
            if (ge.start?.date) {
              return ge.start.date === selectedDateStr;
            }
            return false;
          }
          const geStart = new Date(ge.start.dateTime);
          const geEnd = new Date(ge.end.dateTime);
          return slotDateObj < geEnd && slotEndDateObj > geStart;
        });
      }

      // Check if slot is in the past (Current simulation datetime: 2026-06-08 10:55)
      let isPast = false;
      const systemToday = new Date(2026, 5, 8, 10, 55);
      if (slotDateObj < systemToday) {
        isPast = true;
      }

      slots.push({
        time: timeStr,
        isBooked,
        isPast,
      });
    }

    return slots;
  }, [selectedDateStr, selectedType, workingHours, bookings, googleEvents]);

  // Format 24h time format (e.g. "13:30") to custom elegant 12h format ("01:30 PM")
  const formatTime12h = (time24: string) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const selectMeetingType = (type: MeetingType) => {
    setSelectedType(type);
    setSelectedDateStr('');
    setSelectedTimeSlot('');
  };

  const handleSelectDate = (dateStr: string, isWorking: boolean) => {
    if (!isWorking) return;
    setSelectedDateStr(dateStr);
    setSelectedTimeSlot('');
  };

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; email?: string } = {};

    if (!clientFirstName.trim() || !clientLastName.trim()) newErrors.name = 'Please enter your first and last name.';
    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      newErrors.email = 'Please enter a valid business email.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    setTimeout(() => {
      const generatedId = 'b-' + Math.floor(Math.random() * 10000000);
      const clientName = `${clientFirstName.trim()} ${clientLastName.trim()}`;
      const bookingNotes = [
        clientPhone.trim() ? `Phone: ${clientPhone.trim()}` : '',
        clientCompany.trim() ? `Hotel or Company: ${clientCompany.trim()}` : '',
        clientNotes.trim() ? `Additional Information: ${clientNotes.trim()}` : '',
      ].filter(Boolean).join('\n');
      setRecentBookingId(generatedId);
      onAddBooking({
        meetingTypeId: selectedType!.id,
        clientName,
        clientEmail,
        clientNotes: bookingNotes,
        date: selectedDateStr,
        time: selectedTimeSlot,
      });
      setIsSubmitting(false);
      setStep('success');
    }, 1500);
  };

  const resetFlow = () => {
    setStep('booking');
    setSelectedType(null);
    setSelectedDateStr('');
    setSelectedTimeSlot('');
    setClientFirstName('');
    setClientLastName('');
    setClientEmail('');
    setClientPhone('');
    setClientCompany('');
    setClientNotes('');
    setErrors({});
  };

  // Turn "2026-06-08" to "June 8, 2026"
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDateStr) return '';
    const dateObj = new Date(selectedDateStr + 'T00:00:00');
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDateStr]);

  // Computed first and last name display (google representation if authenticated or fallback "Gary Rebel")
  const displayName = useMemo(() => {
    if (googleUser?.displayName) {
      return googleUser.displayName;
    }
    if (settings.name === 'Gary') {
      return 'Gary Rebel';
    }
    return settings.name;
  }, [googleUser, settings.name]);

  const primaryColorVar = useMemo(() => {
    switch (settings.colorTheme) {
      case 'dark-blue':
      case 'revrebel':
      case 'slate':
        return 'var(--color-dark-blue)';
      case 'dark-green':
      case 'teal':
        return 'var(--color-dark-green)';
      case 'green':
      case 'emerald':
        return 'var(--color-green)';
      case 'light-green':
        return 'var(--color-light-green)';
      case 'light-blue':
      case 'indigo':
        return 'var(--color-light-blue)';
      case 'yellow':
      case 'amber':
        return 'var(--color-yellow)';
      case 'orange':
      case 'rose':
        return 'var(--color-orange)';
      case 'purple':
        return 'var(--color-purple)';
      default:
        return 'var(--color-dark-blue)';
    }
  }, [settings.colorTheme]);

  const primaryForegroundVar = useMemo(() => {
    switch (settings.colorTheme) {
      case 'dark-blue':
      case 'revrebel':
      case 'slate':
        return 'var(--color-dark-blue-inverse)';
      case 'dark-green':
      case 'teal':
        return 'var(--color-dark-green-inverse)';
      case 'green':
      case 'emerald':
        return 'var(--color-green-inverse)';
      case 'light-green':
        return 'var(--color-light-green-inverse)';
      case 'light-blue':
      case 'indigo':
        return 'var(--color-light-blue-inverse)';
      case 'yellow':
      case 'amber':
        return 'var(--color-yellow-inverse)';
      case 'orange':
      case 'rose':
        return 'var(--color-orange-inverse)';
      case 'purple':
        return 'var(--color-purple-inverse)';
      default:
        return 'var(--color-dark-blue-inverse)';
    }
  }, [settings.colorTheme]);

  return (
    <main
      style={{
        '--primary': primaryColorVar,
        '--primary-foreground': primaryForegroundVar
      } as React.CSSProperties}
      className={`booking-widget w-full max-w-5xl mx-auto overflow-hidden transition-all duration-500 ease-fluid relative ${step === 'success' ? 'is-confirmation-view' : ''} ${isEmbedPreview ? 'md:max-w-none' : ''}`}
    >
      {/* Fine inner bezel outline */}
      <div className="absolute inset-0 border border-white pointer-events-none rounded-[56px] m-[1px]"></div>
      
      <div className="p-6 md:p-10 relative z-10">
        
        {/* ARCHITECTURAL HEADER */}
        <header className="booking-widget-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-200/80 mb-8 font-brand">
          <div className="flex items-center gap-4">
            {googleUser?.photoURL ? (
              <img
                src={googleUser.photoURL}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="avatar-initials w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shadow-sm uppercase">
                {displayName ? displayName.split(' ').map((n) => n[0]).join('') : 'R'}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-display font-bold uppercase tracking-wider text-stone-900 leading-none">{displayName}</h1>
              <p className="provider-title text-[10px] mt-1">Chief Rebel</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Passive Calendar Sync Indicator */}
            {googleToken && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-fade text-green border border-green/20 rounded-full text-[10px] uppercase tracking-wider font-semibold font-eyebrow">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                Live Availability Synced
              </span>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 'booking' ? (
            <motion.div
              key="booking-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              
              {/* STEP 1: MEETING TYPE SELECTION (TOP) */}
              <section className="mb-8">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold mb-3.5 font-brand">
                  01. Select a Meeting Option
                </h2>
                
                {activeMeetingTypes.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-stone-400 text-xs">
                    No active consult formats configured.
                  </div>
                ) : (
                  <div className="meeting-options-grid grid grid-cols-2 md:grid-cols-4 gap-3">
                    {activeMeetingTypes.map((mt) => {
                      const isSelected = selectedType?.id === mt.id;
                      return (
                        <button
                          key={mt.id}
                          id={`btn-mt-${mt.id}`}
                          onClick={() => selectMeetingType(mt)}
                          className={`duration-btn py-4 px-3 border rounded-2xl text-xs font-semibold tracking-wide transition-all duration-300 ease-fluid text-center relative overflow-hidden group cursor-pointer
                            ${isSelected
                              ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-md shadow-[var(--primary)]/10 font-bold'
                              : 'border-slate-200 bg-white text-stone-850 hover:border-[var(--primary)]/50 hover:bg-stone-50/50'
                            }`}
                        >
                          <span className="meeting-duration block">{mt.duration}</span>
                          <span className="meeting-duration-label block">Minute Meeting</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* STEP 2: DATE SELECT (Horizontal sliding window) */}
              {selectedType && (
                <motion.section
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold font-brand">
                      02. Select Date
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-800 uppercase font-display tracking-widest">
                        {monthYearLabel}
                      </span>
                      <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
                        <button
                          onClick={handleRowPrev}
                          disabled={windowOffset === 0}
                          className="p-1 hover:bg-white hover:shadow-xs rounded text-stone-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          <svg className="date-nav-arrow date-nav-arrow-previous" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M50.86 78.01l36.41-26.06c.66-.48 1.04-1.24 1.05-2.05 0-.01 0-.01 0-.01 -.01-.82-.4-1.58-1.06-2.05L50.84 21.95c-.77-.55-1.78-.62-2.62-.19 -.84.42-1.37 1.29-1.37 2.23v12.18l-32.71-.01c-1.39 0-2.52 1.12-2.52 2.51l0 22.54c-.01 1.38 1.12 2.51 2.51 2.51h32.7V75.9c0 .94.53 1.8 1.36 2.23 .83.43 1.84.35 2.61-.2Z" />
                          </svg>
                        </button>
                        <button
                          onClick={handleRowNext}
                          className="p-1 hover:bg-white hover:shadow-xs rounded text-stone-600 transition cursor-pointer"
                        >
                          <svg className="date-nav-arrow" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M50.86 78.01l36.41-26.06c.66-.48 1.04-1.24 1.05-2.05 0-.01 0-.01 0-.01 -.01-.82-.4-1.58-1.06-2.05L50.84 21.95c-.77-.55-1.78-.62-2.62-.19 -.84.42-1.37 1.29-1.37 2.23v12.18l-32.71-.01c-1.39 0-2.52 1.12-2.52 2.51l0 22.54c-.01 1.38 1.12 2.51 2.51 2.51h32.7V75.9c0 .94.53 1.8 1.36 2.23 .83.43 1.84.35 2.61-.2Z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Responsive Date Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-14 gap-2.5 md:gap-2">
                    {rowDays.map((d) => {
                      const isSelected = selectedDateStr === d.dateStr;
                      const isToday = d.dateStr === '2026-06-08';
                      const displayDateLabel = String(d.dateLabel).padStart(2, '0');

                      // If weekend (Sat, Sun), show blended dotted background
                      if (d.isWeekend) {
                        return (
                          <div
                            key={d.dateStr}
                            className="unavailable-date-tile weekend-date-tile bg-stone-100/40 border border-dotted border-stone-200 flex flex-col items-center justify-center opacity-50 select-none cursor-not-allowed"
                          >
                            <span className="unavailable-date-weekday text-stone-500">{d.dayLabel}</span>
                            <span className="unavailable-date-number text-stone-500">{displayDateLabel}</span>
                          </div>
                        );
                      }

                      // If weekday but non-working, show crimson styled unavailable days
                      if (!d.isWorkingDay) {
                        return (
                          <div
                            key={d.dateStr}
                            className="unavailable-date-tile nonworking-date-tile border border-red-200 bg-red-50/50 flex flex-col items-center justify-center opacity-70 select-none cursor-not-allowed"
                          >
                            <span className="unavailable-date-weekday text-red-500/70">{d.dayLabel}</span>
                            <span className="unavailable-date-number text-red-500/80 line-through decoration-1">{displayDateLabel}</span>
                          </div>
                        );
                      }

                      // Available day buttons
                      return (
                        <button
                          key={d.dateStr}
                          id={`cal-day-${d.dateStr}`}
                          onClick={() => handleSelectDate(d.dateStr, d.isWorkingDay)}
                          className={`available-date-tile aspect-square border flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ease-fluid cursor-pointer relative group
                            ${isSelected
                              ? 'is-selected bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)] font-bold'
                              : 'border-slate-200 bg-white text-stone-850 hover:border-[var(--primary)]/50 hover:bg-stone-50/30'
                            }`}
                        >
                          <span className="available-date-weekday">
                            {d.dayLabel}
                          </span>
                          <span className="available-date-number">{displayDateLabel}</span>
                          {isToday && (
                            <span className={`date-status-dot w-1 h-1 rounded-full ${isSelected ? 'bg-[var(--primary-foreground)]' : 'bg-[var(--color-green)]'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.section>
              )}

              {/* STEP 3: AVAILABLE HOURS */}
              {selectedType && selectedDateStr && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-8 overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold font-brand">
                      03. Select Hour
                    </h2>
                    <span className="text-[1.25rem] font-bold text-[var(--color-green)] uppercase tracking-wider font-display">
                      {formattedSelectedDate}
                    </span>
                  </div>

                  {availableSlotsForSelectedDate.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-red-200 bg-red-50/15 rounded-2xl text-red-500 text-xs">
                      All hours fully booked. Please scroll or paginate dates above.
                    </div>
                  ) : (
                    <div className="time-slots-grid grid grid-cols-2 md:grid-cols-5 gap-3">
                      {availableSlotsForSelectedDate.map((slot) => {
                        const isSelected = selectedTimeSlot === slot.time;
                        
                        if (slot.isBooked || slot.isPast) {
                          return (
                            <div
                              key={slot.time}
                              className="unavailable-time-tile py-3 text-center cursor-not-allowed select-none opacity-60"
                            >
                              {formatTime12h(slot.time)}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={slot.time}
                            id={`slot-btn-${slot.time}`}
                            disabled={slot.isBooked || slot.isPast}
                            onClick={() => setSelectedTimeSlot(slot.time)}
                            className={`available-time-tile py-3 border text-center cursor-pointer transition-all duration-300 ease-fluid
                              ${isSelected
                                ? 'is-selected bg-[var(--primary)] border-[var(--primary)] text-[var(--primary-foreground)]'
                                : 'border-slate-200 bg-white text-stone-850 hover:border-[var(--primary)]/55 hover:bg-stone-50/50'
                              }`}
                          >
                            {formatTime12h(slot.time)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.section>
              )}

              {/* STEP 4: CAPTURE DETAILS */}
              {selectedType && selectedDateStr && selectedTimeSlot && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pt-6 border-t border-slate-200/80 overflow-hidden"
                >
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold mb-5 font-brand">
                    04. Complete Reservation
                  </h2>

                  <form onSubmit={handleSubmitBooking} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1.5 font-eyebrow">
                        First Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Biggs"
                        value={clientFirstName}
                        onChange={(e) => setClientFirstName(e.target.value)}
                        className={`w-full bg-stone-50/50 border rounded-xl px-4 py-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 transition-all duration-300 ease-fluid font-sans text-stone-900 font-medium ${errors.name ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-[var(--primary)]'}`}
                      />
                      {errors.name && <p className="text-xs text-red-500 mt-1 font-medium">{errors.name}</p>}
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1.5 font-eyebrow">
                        Last Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Darklighter"
                        value={clientLastName}
                        onChange={(e) => setClientLastName(e.target.value)}
                        className={`w-full bg-stone-50/50 border rounded-xl px-4 py-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 transition-all duration-300 ease-fluid font-sans text-stone-900 font-medium ${errors.name ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-[var(--primary)]'}`}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1.5 font-eyebrow">
                        Email
                      </label>
                      <input type="email" required placeholder="biggs.darklighter@revrebel.io" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={`w-full bg-stone-50/50 border rounded-xl px-4 py-3.5 text-xs focus:outline-none transition-all duration-300 ease-fluid ${errors.email ? 'border-red-300' : 'border-slate-200'}`} />
                      {errors.email && <p className="text-xs text-red-500 mt-1 font-medium">{errors.email}</p>}
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1.5 font-eyebrow">Phone</label>
                      <input type="tel" placeholder="(312) 123-4567" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="w-full bg-stone-50/50 border border-slate-200 px-4 py-3.5 text-xs focus:outline-none transition-all duration-300 ease-fluid" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1.5 font-eyebrow">Hotel or Company Name</label>
                      <input type="text" placeholder="Red Squadron" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} className="w-full bg-stone-50/50 border border-slate-200 px-4 py-3.5 text-xs focus:outline-none transition-all duration-300 ease-fluid" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[9px] uppercase tracking-widest text-stone-500 font-bold mb-1.5 font-eyebrow">Additional Information</label>
                      <textarea
                        placeholder="Additional Information"
                        rows={3}
                        value={clientNotes}
                        onChange={(e) => setClientNotes(e.target.value)}
                        className="w-full bg-stone-50/50 border border-slate-200 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 rounded-xl px-4 py-3.5 text-xs focus:outline-none transition-all duration-300 ease-fluid resize-none font-sans text-stone-900 font-medium"
                      />
                    </div>

                    <div className="md:col-span-2 pt-4 flex justify-end border-t border-slate-100 mt-4">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rr-button cursor-pointer animate-none"
                      >
                        <span>{isSubmitting ? 'Securing Session...' : 'Secure Session'}</span>
                        <span className="rr-button-icon flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M50.86 78.01l36.41-26.06c.66-.48 1.04-1.24 1.05-2.05 0-.01 0-.01 0-.01 -.01-.82-.4-1.58-1.06-2.05L50.84 21.95c-.77-.55-1.78-.62-2.62-.19 -.84.42-1.37 1.29-1.37 2.23v12.18l-32.71-.01c-1.39 0-2.52 1.12-2.52 2.51l0 22.54c-.01 1.38 1.12 2.51 2.51 2.51h32.7V75.9c0 .94.53 1.8 1.36 2.23 .83.43 1.84.35 2.61-.2Z" />
                          </svg>
                        </span>
                      </button>
                    </div>

                  </form>
                </motion.section>
              )}

              <footer className="text-[10px] text-stone-400 font-medium font-eyebrow mt-12 flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-2">
                <span>Timezone: <strong>{settings.timezone}</strong></span>
              </footer>

            </motion.div>
          ) : (
            <motion.div
              key="success-flow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="confirmation-layout font-brand w-full"
            >
              <div className="confirmation-copy">
                <h1 className="confirmation-title">
                  <span>Meeting</span>
                  <span>Confirmed</span>
                </h1>
                <p className="confirmation-message">
                  <strong>Get ready to dig into the good stuff — insights, strategy, and possibly a metaphor or two about space travel or spreadsheets. Your time with us is confirmed and we’ll bring the brains, bandwidth, and a finely tuned playlist of solutions.</strong>
                </p>
              </div>

              <div className="confirmation-details">
                <p className="confirmation-intro">
                  Your meeting with {displayName} is officially locked in for<br />
                  {formattedSelectedDate} at {formatTime12h(selectedTimeSlot)} ({settings.timezone}).
                </p>
                <button
                  onClick={resetFlow}
                  className="rr-button-outline cursor-pointer"
                >
                  Schedule Another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}
