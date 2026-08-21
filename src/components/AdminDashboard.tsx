import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, Settings, Save, CheckCircle, XCircle, Trash2, Plus, Info, Copy, ClipboardCheck, ToggleLeft, ToggleRight, Edit, ArrowDown, ExternalLink, Mail, Workflow, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WeeklyWorkingDay, MeetingType, Booking, ProviderSettings } from '../types';
import { supportedTimeZones } from '../lib/date';

interface AdminDashboardProps {
  settings: ProviderSettings;
  workingHours: WeeklyWorkingDay[];
  meetingTypes: MeetingType[];
  bookings: Booking[];
  onUpdateSettings: (settings: ProviderSettings) => void;
  onUpdateWorkingHours: (hours: WeeklyWorkingDay[]) => void;
  onUpdateMeetingTypes: (types: MeetingType[]) => void;
  onUpdateBookings: (bookings: Booking[]) => void;
  googleToken?: string | null;
  googleUser?: any | null;
  onGoogleSignIn?: () => Promise<void>;
  onGoogleLogout?: () => void;
  publicAppUrl?: string;
}

export default function AdminDashboard({
  settings,
  workingHours,
  meetingTypes,
  bookings,
  onUpdateSettings,
  onUpdateWorkingHours,
  onUpdateMeetingTypes,
  onUpdateBookings,
  googleToken = null,
  googleUser = null,
  onGoogleSignIn,
  onGoogleLogout,
  publicAppUrl,
}: AdminDashboardProps) {
  // Navigation tabs: 'bookings' | 'schedule' | 'types' | 'embed_config' | 'brevo_settings' | 'workspace_addon' | 'google_calendar'
  const [activeTab, setActiveTab] = useState<'bookings' | 'schedule' | 'types' | 'embed_config' | 'brevo_settings' | 'workspace_addon' | 'google_calendar'>('bookings');

  // Apps Script copying states
  const [copiedGs, setCopiedGs] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);

  // Embed code parameters
  const [embedWidth, setEmbedWidth] = useState('100%');
  const [embedHeight, setEmbedHeight] = useState('650');
  const [embedShadow, setEmbedShadow] = useState(true);
  const [copied, setCopied] = useState(false);

  // Settings form states
  const [providerName, setProviderName] = useState(settings.name);
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [welcomeMessage, setWelcomeMessage] = useState(settings.welcomeMessage);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [colorTheme, setColorTheme] = useState(settings.colorTheme);

  // Brevo SMTP integration states
  const [brevoApiKey, setBrevoApiKey] = useState(settings.brevoApiKey || '');
  const [brevoSenderEmail, setBrevoSenderEmail] = useState(settings.brevoSenderEmail || '');
  const [brevoSenderName, setBrevoSenderName] = useState(settings.brevoSenderName || '');
  const [testEmail, setTestEmail] = useState(settings.email || 'gary@revrebel.io');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);
  const timeZoneOptions = useMemo(() => {
    const zones = supportedTimeZones();
    return zones.includes(timezone) ? zones : [timezone, ...zones];
  }, [timezone]);

  // New meeting type form states
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDuration, setNewTypeDuration] = useState(30);
  const [newTypeDesc, setNewTypeDesc] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('dark-blue');

  // Local copy of schedule
  const [localHours, setLocalHours] = useState<WeeklyWorkingDay[]>([...workingHours]);

  // Determine App URL for embedding
  const absoluteEmbedUrl = useMemo(() => {
    const configuredUrl = publicAppUrl?.trim().replace(/\/$/, '');
    if (configuredUrl) return `${configuredUrl}?embed=true`;

    const appPath = window.location.pathname.startsWith('/app')
      ? '/app'
      : window.location.pathname.replace(/\/$/, '');
    return `${window.location.origin}${appPath}?embed=true`;
  }, [publicAppUrl]);

  const embedCodeSnippet = useMemo(() => {
    const shadowStyle = embedShadow ? 'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);' : '';
    return `<iframe src="${absoluteEmbedUrl}" width="${embedWidth}" height="${embedHeight}" style="border: 1px solid #f1f5f9; border-radius: 20px; ${shadowStyle}"></iframe>`;
  }, [absoluteEmbedUrl, embedWidth, embedHeight, embedShadow]);

  // Bookings stats
  const statsBookings = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    return { total, pending, confirmed };
  }, [bookings]);

  // Save Settings handler
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      name: providerName,
      email: settings.email,
      businessName,
      welcomeMessage,
      timezone,
      colorTheme,
      brevoApiKey,
      brevoSenderEmail,
      brevoSenderName,
    });
    setIsSavedSuccessfully(true);
    setTimeout(() => setIsSavedSuccessfully(false), 3000);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brevoApiKey) {
      setTestStatus('error');
      setTestError('Please specify a Brevo API key before triggering a test.');
      return;
    }
    setTestStatus('loading');
    setTestError('');
    try {
      const response = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: testEmail,
          clientName: 'Test Recipient',
          meetingType: 'Strategic Growth Review',
          dateTime: 'Monday, June 15, 2026 at 12:30 PM (EST)',
          providerName,
          meetingDuration: 60,
          referenceId: 'b-9999999',
          brevoApiKey,
          brevoSenderEmail,
          brevoSenderName,
          customNotes: 'Testing Brevo branded notifications.'
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        setTestStatus('error');
        setTestError(resData.error || 'SMTP dispatch failure');
      } else {
        setTestStatus('success');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestError(err.message || 'Server connection failure.');
    }
  };

  const copyToClipboard = (text: string, type: 'gs' | 'html' | 'manifest') => {
    navigator.clipboard.writeText(text);
    if (type === 'gs') {
      setCopiedGs(true);
      setTimeout(() => setCopiedGs(false), 2000);
    } else if (type === 'html') {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } else if (type === 'manifest') {
      setCopiedManifest(true);
      setTimeout(() => setCopiedManifest(false), 2000);
    }
  };

  // Modify individual day working state
  const handleDayToggle = (idx: number) => {
    const updated = [...localHours];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    setLocalHours(updated);
  };

  const handleHourChange = (idx: number, field: 'startTime' | 'endTime', value: string) => {
    const updated = [...localHours];
    updated[idx] = { ...updated[idx], [field]: value };
    setLocalHours(updated);
  };

  const saveWorkingHours = () => {
    onUpdateWorkingHours(localHours);
  };

  // Status Change handlers
  const handleUpdateBookingStatus = (id: string, status: 'confirmed' | 'cancelled') => {
    const updated = bookings.map((b) => (b.id === id ? { ...b, status } : b));
    onUpdateBookings(updated);
  };

  const handleDeleteBooking = (id: string) => {
    if (confirm('Are you sure you want to remove this scheduled booking?')) {
      const updated = bookings.filter((b) => b.id !== id);
      onUpdateBookings(updated);
    }
  };

  // Meeting Format handlings
  const handleToggleMeetingType = (id: string) => {
    const updated = meetingTypes.map((mt) => (mt.id === id ? { ...mt, enabled: !mt.enabled } : mt));
    onUpdateMeetingTypes(updated);
  };

  const handleAddMeetingType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    const newType: MeetingType = {
      id: 'mt-' + Date.now(),
      name: newTypeName,
      duration: Number(newTypeDuration),
      description: newTypeDesc,
      color: newTypeColor,
      enabled: true,
    };

    onUpdateMeetingTypes([...meetingTypes, newType]);
    
    // Clear Form
    setNewTypeName('');
    setNewTypeDuration(30);
    setNewTypeDesc('');
    setNewTypeColor('indigo');
    setShowAddType(false);
  };

  const handleDeleteMeetingType = (id: string) => {
    if (confirm('Delete this meeting format? This cannot be undone.')) {
      onUpdateMeetingTypes(meetingTypes.filter((mt) => mt.id !== id));
    }
  };

  // Clipboard copying
  const copyEmbedSnippet = () => {
    navigator.clipboard.writeText(embedCodeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeThemeColorClasses = useMemo(() => {
    switch (settings.colorTheme) {
      case 'dark-blue':
      case 'revrebel':
      case 'slate':
        return 'text-dark-blue bg-dark-blue-fade border-dark-blue/20 focus:ring-dark-blue';
      case 'dark-green':
      case 'teal':
        return 'text-dark-green bg-dark-green-fade border-dark-green/20 focus:ring-dark-green';
      case 'green':
      case 'emerald':
        return 'text-green bg-green-fade border-green/20 focus:ring-green';
      case 'light-green':
        return 'text-light-green bg-light-green-fade border-light-green/20 focus:ring-light-green';
      case 'light-blue':
      case 'indigo':
        return 'text-light-blue bg-light-blue-fade border-light-blue/20 focus:ring-light-blue';
      case 'yellow':
      case 'amber':
        return 'text-yellow bg-yellow-fade border-yellow/20 focus:ring-yellow';
      case 'orange':
      case 'rose':
        return 'text-orange bg-orange-fade border-orange/20 focus:ring-orange';
      case 'purple':
        return 'text-purple bg-purple-fade border-purple/20 focus:ring-purple';
      default:
        return 'text-dark-blue bg-dark-blue-fade border-dark-blue/20 focus:ring-dark-blue';
    }
  }, [settings.colorTheme]);

  return (
    <div className="admin-workspace w-full bg-white rounded-3xl border border-dark-blue shadow-xl overflow-hidden min-h-[580px] grid grid-cols-1 lg:grid-cols-12">
      
      {/* Side navigational rail */}
      <div className="lg:col-span-3 bg-slate-50 border-r border-slate-100 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold shadow-md bg-slate-800`}>
              WS
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 font-display">Provider Control</h4>
              <span className="text-xs text-slate-400 font-medium">gary@revrebel.io</span>
            </div>
          </div>

          <div className="mt-8 space-y-1.5">
            <button
              id="tab-bookings"
              onClick={() => { setActiveTab('bookings'); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-display transition flex items-center justify-between ${activeTab === 'bookings' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <div className="flex items-center gap-2">
                <CalendarIcon size={14} />
                <span>Client Bookings</span>
              </div>
              {statsBookings.pending > 0 && (
                <span className="w-5 h-5 rounded-full bg-purple text-purple-inverse font-bold flex items-center justify-center text-[10px] shadow-xs animate-pulse">
                  {statsBookings.pending}
                </span>
              )}
            </button>

            <button
              id="tab-schedule"
              onClick={() => { setActiveTab('schedule'); setLocalHours([...workingHours]); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-display transition flex items-center gap-2 ${activeTab === 'schedule' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Clock size={14} />
              <span>Weekly Schedule</span>
            </button>

            <button
              id="tab-google-calendar"
              onClick={() => { setActiveTab('google_calendar'); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-display transition flex items-center gap-2 ${activeTab === 'google_calendar' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <RefreshCw size={14} className={googleToken ? "text-green" : ""} />
              <span>Google Calendar Sync</span>
              {googleToken && (
                <span className="w-1.5 h-1.5 rounded-full bg-green ml-auto" />
              )}
            </button>

            <button
              id="tab-types"
              onClick={() => { setActiveTab('types'); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-display transition flex items-center gap-2 ${activeTab === 'types' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Plus size={14} />
              <span>Meeting Formats</span>
            </button>

            <button
              id="tab-embed"
              onClick={() => { setActiveTab('embed_config'); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-display transition flex items-center gap-2 ${activeTab === 'embed_config' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Info size={14} />
              <span>Widget Embed Tool</span>
            </button>

            <button
              id="tab-brevo"
              onClick={() => { setActiveTab('brevo_settings'); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-display transition flex items-center gap-2 ${activeTab === 'brevo_settings' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Mail size={14} />
              <span>Branded Emails (Brevo)</span>
            </button>

            <button
              id="tab-workspace"
              onClick={() => { setActiveTab('workspace_addon'); }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold font-display transition flex items-center gap-2 ${activeTab === 'workspace_addon' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Workflow size={14} />
              <span>Workspace Add-on</span>
            </button>
          </div>
        </div>

        {/* Footer info strip */}
        <div className="mt-8 pt-4 border-t border-slate-200">
          <div className="flex items-baseline justify-between text-[11px] font-mono text-slate-400">
            <span>Status</span>
            <span className={googleToken ? "text-green font-bold flex items-center gap-1" : "font-bold flex items-center gap-1"}>
              {googleToken ? '● Authorized' : '● Local only'}
            </span>
          </div>
        </div>
      </div>

      {/* Main workspace container */}
      <div className="lg:col-span-9 p-6 md:p-8">
        
        {/* Tab content conditional rendering */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: BOOKING RECORDS LIST */}
          {activeTab === 'bookings' && (
            <motion.div
              key="bookings-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-display font-bold text-slate-800">Scheduled Appointments</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Manage bookings created through this widget.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center min-w-20">
                    <span className="block text-slate-400 text-[10px] font-semibold uppercase font-mono">Bookings</span>
                    <span className="text-md font-bold text-slate-700 font-display">{statsBookings.total}</span>
                  </div>
                  <div className="bg-purple rounded-xl p-2.5 text-center min-w-20">
                    <span className="block text-purple-inverse/85 text-[10px] font-semibold uppercase font-mono">Pending</span>
                    <span className="text-md font-bold text-purple-inverse font-display">{statsBookings.pending}</span>
                  </div>
                </div>
              </div>

              {bookings.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400">
                  <CalendarIcon className="mx-auto text-slate-300 md:mb-2" size={32} />
                  <span className="block">No scheduled bookings yet.</span>
                  <span className="block text-[11px] mt-1">Google Calendar events do not populate this list.</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-mono border-b border-slate-100">
                        <th className="py-3 px-4 font-semibold">Client</th>
                        <th className="py-3 px-4 font-semibold">Date & Time</th>
                        <th className="py-3 px-4 font-semibold">Format</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {bookings.map((b) => {
                        const mType = meetingTypes.find((mt) => mt.id === b.meetingTypeId);
                        return (
                           <React.Fragment key={b.id}>
                            <tr className={`hover:bg-slate-50/50 transition duration-150 ${b.status === 'cancelled' ? 'opacity-60 bg-slate-50/20' : ''}`}>
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-800">{b.clientName}</div>
                                <div className="text-slate-400 text-[11px] font-mono mt-0.5">{b.clientEmail}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-medium text-slate-700">{b.date}</div>
                                <div className="text-slate-400 text-[11px] font-mono mt-0.5">{b.time} ({mType?.duration || 0}m)</div>
                              </td>
                              <td className="py-3.5 px-4 font-medium text-slate-600">
                                {mType?.name || 'Deleted consult Format'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  b.status === 'confirmed' ? 'bg-green text-green-inverse' :
                                  b.status === 'cancelled' ? 'bg-red text-red-inverse' :
                                  'bg-purple text-purple-inverse'
                                }`}>
                                  {b.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {b.status === 'pending' && (
                                    <button
                                      id={`btn-approve-${b.id}`}
                                      onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                                      className="p-1 hover:bg-green-fade text-green hover:opacity-85 rounded-lg transition"
                                      title="Approve Booking"
                                    >
                                      <CheckCircle size={16} />
                                    </button>
                                  )}
                                  {b.status !== 'cancelled' && (
                                    <button
                                      id={`btn-cancel-${b.id}`}
                                      onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                                      className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition"
                                      title="Cancel Booking"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  )}
                                  <button
                                    id={`btn-delete-${b.id}`}
                                    onClick={() => handleDeleteBooking(b.id)}
                                    className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition"
                                    title="Delete Record"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {b.clientNotes && (
                              <tr className="bg-slate-50/30">
                                <td colSpan={5} className="py-2 px-4 pb-3 border-t-0 border-b border-slate-100 text-slate-500 text-[11px] leading-relaxed italic">
                                  <span className="font-semibold text-slate-400 not-italic uppercase font-mono text-[9px] mr-1">Notes:</span> 
                                  "{b.clientNotes}"
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: WEEKLY SCHEDULE SETUP */}
          {activeTab === 'schedule' && (
            <motion.div
              key="schedule-config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-display font-bold text-slate-800">Weekly Working Hours</h3>
                <p className="text-xs text-slate-400 mt-0.5">Specify when you are active to take consulting calls.</p>
              </div>

              <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                {localHours.map((wh, idx) => (
                  <div
                    key={wh.day}
                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${wh.enabled ? 'bg-white border-slate-150 shadow-xs' : 'bg-slate-50/50 border-slate-100 opacity-70'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        id={`check-day-${wh.day}`}
                        type="checkbox"
                        checked={wh.enabled}
                        onChange={() => handleDayToggle(idx)}
                        className={`w-4.5 h-4.5 rounded border-slate-300 focus:ring-slate-400 text-slate-800`}
                      />
                      <span className="text-xs font-bold text-slate-700 min-w-24 block">
                        {wh.day}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase font-mono">From</span>
                      <select
                        id={`select-start-${wh.day}`}
                        disabled={!wh.enabled}
                        value={wh.startTime}
                        onChange={(e) => handleHourChange(idx, 'startTime', e.target.value)}
                        className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {Array.from({ length: 24 }).map((_, h) => {
                          const hourStr = String(h).padStart(2, '0') + ':00';
                          return <option key={hourStr} value={hourStr}>{hourStr}</option>;
                        })}
                      </select>

                      <span className="text-[10px] font-semibold text-slate-400 uppercase font-mono">To</span>
                      <select
                        id={`select-end-${wh.day}`}
                        disabled={!wh.enabled}
                        value={wh.endTime}
                        onChange={(e) => handleHourChange(idx, 'endTime', e.target.value)}
                        className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 px-2.5 py-1.5 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {Array.from({ length: 24 }).map((_, h) => {
                          const hourStr = String(h).padStart(2, '0') + ':00';
                          return <option key={hourStr} value={hourStr}>{hourStr}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  id="btn-save-hours"
                  onClick={saveWorkingHours}
                  className="px-5 py-2.5 rounded-xl font-medium text-xs bg-primary text-primary-foreground shadow-md hover:opacity-90 transition-all flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>Save Scheduler Changes</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB 3: MEETING TYPES SCHEMES */}
          {activeTab === 'types' && (
            <motion.div
              key="meeting-types"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-display font-bold text-slate-800">Meeting Formats</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Customize format structures accessible by customers.</p>
                </div>

                <button
                  id="btn-show-add-type"
                  onClick={() => setShowAddType(!showAddType)}
                  className="px-4 py-2 border border-slate-150 text-slate-700 hover:bg-slate-50 shadow-xs rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>{showAddType ? 'Cancel' : 'Create format'}</span>
                </button>
              </div>

              {showAddType && (
                <motion.form
                  onSubmit={handleAddMeetingType}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-5 border border-slate-150 rounded-2xl bg-slate-50/50 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Format Name</label>
                      <input
                        id="new-type-name"
                        type="text"
                        required
                        className="w-full px-4 py-2 text-xs font-semibold border border-slate-150 bg-white rounded-xl focus:ring-4 focus:ring-slate-400/5 focus:outline-none"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="Discovery Intake Session"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Duration (Minutes)</label>
                      <select
                        id="new-type-duration"
                        className="w-full px-4 py-2 text-xs font-medium border border-slate-150 bg-white rounded-xl focus:ring-4 focus:ring-slate-400/5 focus:outline-none cursor-pointer"
                        value={newTypeDuration}
                        onChange={(e) => setNewTypeDuration(Number(e.target.value))}
                      >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes</option>
                        <option value={90}>90 Minutes</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                    <textarea
                      id="new-type-desc"
                      rows={2}
                      className="w-full px-4 py-2 text-xs border border-slate-150 bg-white rounded-xl focus:ring-4 focus:ring-slate-400/5 focus:outline-none"
                      value={newTypeDesc}
                      onChange={(e) => setNewTypeDesc(e.target.value)}
                      placeholder="Brief bullet points on objectives or expectations..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Format Theme Color</label>
                      <div className="flex gap-2">
                        {[
                          { key: 'dark-blue', name: 'Dark Blue', varName: 'var(--color-dark-blue)' },
                          { key: 'green', name: 'Green', varName: 'var(--color-green)' },
                          { key: 'light-blue', name: 'Light Blue', varName: 'var(--color-light-blue)' },
                          { key: 'yellow', name: 'Yellow', varName: 'var(--color-yellow)' },
                          { key: 'orange', name: 'Orange', varName: 'var(--color-orange)' },
                          { key: 'purple', name: 'Purple', varName: 'var(--color-purple)' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            id={`color-btn-${c.key}`}
                            type="button"
                            onClick={() => setNewTypeColor(c.key)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${newTypeColor === c.key ? 'border-slate-800 scale-110 shadow-xs' : 'border-transparent opacity-80'}`}
                            style={{ backgroundColor: c.varName }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        id="btn-save-new-type"
                        type="submit"
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-xs flex items-center gap-1"
                      >
                        <Save size={12} />
                        <span>Add meeting Format</span>
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}

              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {meetingTypes.map((mt) => (
                  <div
                    key={mt.id}
                    className="p-4 rounded-2xl border border-slate-150 bg-white transition flex items-center justify-between gap-4 shadow-3xs"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1.5 w-3 h-3 rounded-full`}
                        style={{
                          backgroundColor:
                            mt.color === 'dark-blue' ? 'var(--color-dark-blue)' :
                            mt.color === 'dark-green' ? 'var(--color-dark-green)' :
                            mt.color === 'green' ? 'var(--color-green)' :
                            mt.color === 'light-green' ? 'var(--color-light-green)' :
                            mt.color === 'light-blue' ? 'var(--color-light-blue)' :
                            mt.color === 'yellow' ? 'var(--color-yellow)' :
                            mt.color === 'orange' ? 'var(--color-orange)' :
                            mt.color === 'purple' ? 'var(--color-purple)' :
                            mt.color === 'indigo' ? '#4f46e5' :
                            mt.color === 'emerald' ? '#059669' :
                            mt.color === 'amber' ? '#d97706' :
                            mt.color === 'rose' ? '#e11d48' :
                            mt.color === 'teal' ? '#0d9488' :
                            'var(--color-dark-blue)'
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{mt.name}</span>
                          <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{mt.duration} mins</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-lg leading-relaxed">{mt.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        id={`btn-toggle-mt-${mt.id}`}
                        onClick={() => handleToggleMeetingType(mt.id)}
                        className={`p-1 text-slate-400 hover:text-slate-600 transition`}
                      >
                        {mt.enabled ? (
                          <ToggleRight size={24} className="text-slate-800" />
                        ) : (
                          <ToggleLeft size={24} />
                        )}
                      </button>

                      <button
                        id={`btn-del-mt-${mt.id}`}
                        onClick={() => handleDeleteMeetingType(mt.id)}
                        className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 4: EMBED CONFIGURATOR & SNIPPET TOOL */}
          {activeTab === 'embed_config' && (
            <motion.div
              key="embed-config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-display font-bold text-slate-800">Widget Customization & Embed Code</h3>
                <p className="text-xs text-slate-400 mt-0.5">Edit styling brand settings and grab your dynamic website iframe snippet.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Customizer sidebar */}
                <div className="md:col-span-5 space-y-4">
                  <div className="p-5 border border-slate-150 rounded-2xl bg-slate-50/50 space-y-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Aesthetics & Core parameters</span>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Consultant Name</label>
                      <input
                        id="provider-name-input"
                        type="text"
                        className="w-full px-3 py-2 text-xs font-semibold border border-slate-150 rounded-xl focus:outline-none"
                        value={providerName}
                        onChange={(e) => setProviderName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Business / Subtitle</label>
                      <input
                        id="business-name-input"
                        type="text"
                        className="w-full px-3 py-2 text-xs font-semibold border border-slate-150 rounded-xl focus:outline-none"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Provider Time Zone</label>
                      <select
                        id="provider-timezone-input"
                        className="w-full px-3 py-2 text-xs font-semibold border border-slate-150 rounded-xl focus:outline-none bg-white"
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                      >
                        {timeZoneOptions.map((timeZone) => (
                          <option key={timeZone} value={timeZone}>{timeZone.replaceAll('_', ' ')}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Color theme accent</label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { key: 'dark-blue', name: 'Dark Blue', varName: 'var(--color-dark-blue)' },
                          { key: 'dark-green', name: 'Dark Green', varName: 'var(--color-dark-green)' },
                          { key: 'green', name: 'Green', varName: 'var(--color-green)' },
                          { key: 'light-green', name: 'Light Green', varName: 'var(--color-light-green)' },
                          { key: 'light-blue', name: 'Light Blue', varName: 'var(--color-light-blue)' },
                          { key: 'yellow', name: 'Yellow', varName: 'var(--color-yellow)' },
                          { key: 'orange', name: 'Orange', varName: 'var(--color-orange)' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            id={`theme-btn-${item.key}`}
                            type="button"
                            onClick={() => setColorTheme(item.key)}
                            style={{ backgroundColor: item.varName }}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${colorTheme === item.key ? 'border-slate-800 scale-110 shadow-xs' : 'border-transparent opacity-80'}`}
                            title={item.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-end">
                      <button
                        id="btn-save-settings"
                        onClick={handleSaveSettings}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 hover:shadow-sm transition-all"
                      >
                        Publish layout settings
                      </button>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-150 rounded-xl space-y-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Dimensions config</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Width</label>
                        <input
                          id="embed-width-input"
                          type="text"
                          className="w-full px-3 py-1.5 text-xs font-serif text-slate-700 bg-slate-50 border border-slate-150 rounded-lg outline-none"
                          value={embedWidth}
                          onChange={(e) => setEmbedWidth(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Height (px)</label>
                        <input
                          id="embed-height-input"
                          type="text"
                          className="w-full px-3 py-1.5 text-xs font-serif text-slate-700 bg-slate-50 border border-slate-150 rounded-lg outline-none"
                          value={embedHeight}
                          onChange={(e) => setEmbedHeight(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Snip viewer */}
                <div className="md:col-span-7 space-y-4">
                  <div className="bg-dark-blue rounded-2xl p-5 text-white/95 border border-slate-950 shadow-inner">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                        HTML Iframe Snippet
                      </span>
                      
                      <button
                        id="btn-copy-embed"
                        onClick={copyEmbedSnippet}
                        className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition duration-150 py-1 px-2.5 rounded-lg hover:bg-white/5"
                      >
                        {copied ? (
                          <>
                            <ClipboardCheck size={14} className="text-green" />
                            <span className="text-green">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy HTML</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="text-[10px] font-mono leading-relaxed bg-black/60 p-4 rounded-xl text-indigo-200 overflow-x-auto whitespace-pre-wrap select-all">
                      {embedCodeSnippet}
                    </pre>

                    <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] leading-relaxed text-slate-400 flex items-start gap-2">
                      <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        Perfect alignment for Wordpress, Framer, Webflow, or custom React codebases. Drop the script into any section container.
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                    <span className="text-xs font-semibold text-slate-600 block mb-1">Direct Live Preview Link</span>
                    <p className="text-[11px] text-slate-400">Clients can access your booking screen direct at:</p>
                    <div className="mt-2 flex items-center justify-between gap-1 bg-white border border-slate-150 p-2.5 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">{absoluteEmbedUrl}</span>
                      <a
                        href={absoluteEmbedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-slate-500 hover:text-slate-800 p-1 hover:bg-slate-50 rounded-lg transition"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 5: BREVO EMAIL INTEGRATION */}
          {activeTab === 'brevo_settings' && (
            <motion.div
              key="brevo-settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-display font-bold text-slate-800">Branded Client Communications</h3>
                <p className="text-xs text-slate-400 mt-0.5">Integrate Brevo SMTP to bypass standard Google updates and send custom-designed strategies.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Credentials Panel */}
                <form onSubmit={handleSaveSettings} className="lg:col-span-7 p-6 border border-slate-150 bg-white rounded-2xl shadow-3xs space-y-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Brevo API Access Parameters</span>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Brevo API Key (v3)</label>
                    <input
                      id="brevo-api-key-input"
                      type="password"
                      placeholder="xkeysib-..."
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-150 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800/10"
                      value={brevoApiKey}
                      onChange={(e) => setBrevoApiKey(e.target.value)}
                    />
                    <span className="block text-[9px] text-slate-400 mt-1">Found in your Brevo Dashboard under SMTP & API secrets.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sender Email</label>
                      <input
                        id="brevo-sender-email-input"
                        type="email"
                        placeholder="notifications@revrebel.io"
                        className="w-full px-3 py-2 text-xs font-semibold border border-slate-150 rounded-xl focus:outline-none"
                        value={brevoSenderEmail}
                        onChange={(e) => setBrevoSenderEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sender Name</label>
                      <input
                        id="brevo-sender-name-input"
                        type="text"
                        placeholder="REVREBEL Strategy"
                        className="w-full px-3 py-2 text-xs font-semibold border border-slate-150 rounded-xl focus:outline-none"
                        value={brevoSenderName}
                        onChange={(e) => setBrevoSenderName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      {isSavedSuccessfully && (
                        <span className="text-[10px] text-green font-bold flex items-center gap-1">
                          <CheckCircle size={12} /> Parameters Saved!
                        </span>
                      )}
                    </div>
                    <button
                      id="btn-save-brevo"
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center gap-1 shadow-3xs"
                    >
                      <Save size={12} />
                      <span>Save Credentials</span>
                    </button>
                  </div>
                </form>

                {/* Tester and Status Panel */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-5 border border-slate-150 bg-slate-50/50 rounded-2xl space-y-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1">Testing & Deployment Terminal</span>
                    
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Confirm configurations by sending a mockup Strategy Session reservation template to any external address.
                    </p>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Test Email</label>
                      <div className="flex gap-2">
                        <input
                          id="test-email-target-input"
                          type="email"
                          className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-150 rounded-xl outline-none"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                        />
                        <button
                          id="btn-trigger-test"
                          disabled={testStatus === 'loading'}
                          onClick={handleSendTestEmail}
                          className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 transition"
                        >
                          {testStatus === 'loading' ? 'Sending...' : 'Send Test'}
                        </button>
                      </div>
                    </div>

                    {/* Status Console Response */}
                    {testStatus === 'success' && (
                      <div className="p-3 bg-green-fade border border-green/20 text-green rounded-xl text-[11px] font-medium leading-relaxed">
                        <strong>Test Email Synced!</strong> Transactional branded confirmation was successfully sent. Please inspect the inbox.
                      </div>
                    )}

                    {testStatus === 'error' && (
                      <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-[11px] font-medium leading-relaxed">
                        <strong>Relay Error:</strong> {testError}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border border-slate-200 bg-white rounded-xl text-slate-500 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Workspace Architecture</span>
                    <p className="text-[10px] leading-relaxed">
                      By disabling Google Calendar updates (`sendUpdates=none`), the platform delegates CRM notifications entirely to Brevo, making your Webflow embedded scheduling Widget independent yet securely backed by GSuite OAuth.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 6: GOOGLE WORKSPACE ADD-ON & APPS SCRIPT DEVELOPER PANEL */}
          {activeTab === 'workspace_addon' && (
            <motion.div
              key="workspace-addon"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-display font-bold text-slate-800">Google Workspace Add-on Integration</h3>
                <p className="text-xs text-slate-400 mt-0.5">Deploy this scheduler and dashboard directly into Google Sheets, Docs, Gmail, and Google Calendar sidebars.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* File Generator Tabs and Code Previews */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-6 border border-slate-150 bg-white rounded-2xl shadow-3xs space-y-5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Google Apps Script Snippet Engine</span>
                      <p className="text-[11px] text-slate-500 mt-1">Copy these files into your Google Apps Script workspace to load the client scheduler and admin dashboard natively.</p>
                    </div>

                    {/* Code Block 1: Code.gs */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 font-mono">File 1: Code.gs (App Launch Engine)</span>
                        <button
                          id="btn-copy-gs"
                          type="button"
                          onClick={() => copyToClipboard(`// Google Apps Script integration to mount REVREBEL Strategy directly in Google Workspace.
// Paste this inside your Extensions > Apps Script editor.

function onOpen() {
  const ui = DocumentApp.getUi(); // Or SpreadsheetApp.getUi() for Google Sheets, SlidesApp.getUi() for Google Slides
  ui.createMenu('${providerName} Strategy')
    .addItem('Book Strategic Session', 'openSchedulerSidebar')
    .addItem('Manage Bookings (Admin)', 'openAdminDialog')
    .addToUi();
}

function openSchedulerSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Strategic Meeting Scheduler')
    .setWidth(320);
  DocumentApp.getUi().showSidebar(html);
}

function openAdminDialog() {
  const html = HtmlService.createHtmlOutputFromFile('AdminSidebar')
    .setTitle('Strategic Manager Dashboard')
    .setWidth(1000)
    .setHeight(700);
  DocumentApp.getUi().showModalDialog(html, '${providerName} Controls');
}`, 'gs')}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 px-2.5 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 transition border-none cursor-pointer"
                        >
                          {copiedGs ? (
                            <>
                              <ClipboardCheck size={12} className="text-green" />
                              <span className="text-green">Copied Code.gs!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy Code.gs</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-[9.5px] font-mono leading-relaxed bg-slate-900 text-slate-200 p-4 rounded-xl overflow-x-auto max-h-[160px] whitespace-pre select-all">
{`// Google Apps Script integration to mount REVREBEL Strategy directly in Google Workspace.

function onOpen() {
  const ui = DocumentApp.getUi(); // Or SpreadsheetApp.getUi() for Sheets
  ui.createMenu('${providerName} Strategy')
    .addItem('Book Strategic Session', 'openSchedulerSidebar')
    .addItem('Manage Bookings (Admin)', 'openAdminDialog')
    .addToUi();
}

function openSchedulerSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Strategic Meeting Scheduler')
    .setWidth(320);
  DocumentApp.getUi().showSidebar(html);
}

function openAdminDialog() {
  const html = HtmlService.createHtmlOutputFromFile('AdminSidebar')
    .setTitle('Strategic Manager Dashboard')
    .setWidth(1000)
    .setHeight(700);
  DocumentApp.getUi().showModalDialog(html, '${providerName} Controls');
}`}
                      </pre>
                    </div>

                    {/* Code Block 2: Sidebar.html */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 font-mono">File 2: Sidebar.html (Client Widget Wrapper)</span>
                        <button
                          id="btn-copy-html"
                          type="button"
                          onClick={() => copyToClipboard(`<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <style>
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #fafafa; }
      iframe { border: none; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <iframe src="${absoluteEmbedUrl}"></iframe>
  </body>
</html>`, 'html')}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 px-2.5 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 transition border-none cursor-pointer"
                        >
                          {copiedHtml ? (
                            <>
                              <ClipboardCheck size={12} className="text-green" />
                              <span className="text-green">Copied Sidebar.html!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy Sidebar.html</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-[9.5px] font-mono leading-relaxed bg-slate-900 text-slate-200 p-4 rounded-xl overflow-x-auto max-h-[130px] whitespace-pre select-all">
{`<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <style>
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #fafafa; }
      iframe { border: none; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <iframe src="${absoluteEmbedUrl}"></iframe>
  </body>
</html>`}
                      </pre>
                    </div>

                    {/* Code Block 3: appsscript.json */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600 font-mono">File 3: appsscript.json (Configuration Manifest)</span>
                        <button
                          id="btn-copy-manifest"
                          type="button"
                          onClick={() => copyToClipboard(`{
  "timeZone": "${settings.timezone}",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}`, 'manifest')}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 px-2.5 rounded-lg bg-indigo-50/50 hover:bg-indigo-50 transition border-none cursor-pointer"
                        >
                          {copiedManifest ? (
                            <>
                              <ClipboardCheck size={12} className="text-green" />
                              <span className="text-green">Copied appsscript.json!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy appsscript.json</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-[9.5px] font-mono leading-relaxed bg-slate-900 text-slate-200 p-4 rounded-xl overflow-x-auto whitespace-pre select-all">
{`{
  "timeZone": "${settings.timezone}",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}`}
                      </pre>
                    </div>

                  </div>
                </div>

                {/* Steps and Guide Column */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-5 border border-slate-150 bg-slate-50/50 rounded-2xl space-y-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Workspace Add-on Setup Guide</span>
                    
                    <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">1</span>
                        <p>
                          Open any Google Sheet, Google Document, or Google Slides presentation in your workspace, then click on <strong>Extensions &gt; Apps Script</strong>.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                        <p>
                          Replace the content of the default <code>Code.gs</code> file with <strong>File 1 (Code.gs)</strong> above, and save.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                        <p>
                          Click the <strong>+ (Add a file)</strong> icon next to Files in the Apps Script sidebar, select <strong>HTML</strong>, name it <code>Sidebar</code>, and paste the content of <strong>File 2 (Sidebar.html)</strong>. Save the file.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">4</span>
                        <p>
                          Do the same to create another HTML file named <code>AdminSidebar</code>. Paste the sidebar content, but replace the iframe URL to load the Admin Dashboard if you wish to manage bookings within Google Docs/Sheets!
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">5</span>
                        <p>
                          Refresh your Google Doc or Spreadsheet. You'll see a brand new top menu named <strong>{providerName} Strategy</strong> from which you can launch the sidebars and modals instantly.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 bg-white rounded-xl text-slate-500 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">OAuth Verification Note</span>
                    <p className="text-[10px] leading-relaxed">
                      Since the client widget runs inside a secure iframe, users can authenticate using Google OAuth safely. Your Firebase Auth is configured to support domain verification, matching your deployment hosts perfectly.
                    </p>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 7: GOOGLE CALENDAR SYNCHRONIZATION */}
          {activeTab === 'google_calendar' && (
            <motion.div
              key="google-calendar-sync"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-display font-bold text-slate-800">Google Calendar Synchronization</h3>
                <p className="text-xs text-slate-400 mt-0.5">Connect your professional Google Calendar to synchronize your availability and block busy slots automatically.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Connection Status Card */}
                <div className="lg:col-span-6">
                  <div className="p-6 border border-slate-150 bg-white rounded-2xl shadow-3xs space-y-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Connection Status</span>

                    {googleToken ? (
                      <div className="space-y-5">
                        <div className="flex items-center gap-4 p-4 bg-green-fade border border-green/20 rounded-xl">
                          {googleUser?.photoURL ? (
                            <img
                              src={googleUser.photoURL}
                              alt={googleUser.displayName || 'Google User'}
                              className="w-12 h-12 rounded-full object-cover shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-green flex items-center justify-center text-sm text-white font-bold uppercase shadow-sm">
                              {googleUser?.displayName ? googleUser.displayName[0] : 'G'}
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{googleUser?.displayName || 'Google Account Connected'}</h4>
                            <p className="text-xs text-slate-400 font-mono">{googleUser?.email || 'Connected'}</p>
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green mt-1 uppercase font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                              Calendar Authorized
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                          Your Google account is authorized. Live public availability and shared booking records still require server-side token and booking storage.
                        </p>

                        {onGoogleLogout && (
                          <button
                            id="btn-disconnect-calendar"
                            type="button"
                            onClick={onGoogleLogout}
                            className="w-full text-center py-2.5 px-4 bg-red-fade text-red rounded-xl text-xs font-bold transition border border-red/20 cursor-pointer hover:opacity-85"
                          >
                            Disconnect Google Calendar
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-150 rounded-xl">
                          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                            <CalendarIcon size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-600">No Calendar Connected</h4>
                            <p className="text-xs text-slate-400">Offline mode active</p>
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-1 uppercase font-mono">
                              ● Offline
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                          Authorize the provider calendar now. Live availability and event creation become active after shared server storage is connected.
                        </p>

                        {onGoogleSignIn && (
                          <button
                            id="btn-connect-calendar"
                            type="button"
                            onClick={onGoogleSignIn}
                            className="w-full text-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs border-none cursor-pointer flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={14} className="animate-spin-slow" />
                            <span>Connect Google Calendar</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Features & Help Column */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="p-5 border border-slate-150 bg-slate-50/50 rounded-2xl space-y-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Synchronization Features</span>

                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-semibold shrink-0">1</div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-700">Dynamic Blockout Engine</h5>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Planned: read primary-calendar busy periods server-side and remove conflicting public slots.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-semibold shrink-0">2</div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-700">Instant Invites & Notifications</h5>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Planned: create the calendar event and send an invitation after a booking is confirmed.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-semibold shrink-0">3</div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-700">Seamless OAuth Security</h5>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Uses secure Google credentials managed by Google Identity Services directly. No server retains your Google password.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-150 bg-white rounded-xl text-slate-450">
                    <p className="text-[10px] leading-relaxed">
                      <strong>Multi-timezone alignment:</strong> Bookings are placed onto your calendar matching the provider timezone (<code>{settings.timezone}</code>) and automatically adjusted to the client's local timezone.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
