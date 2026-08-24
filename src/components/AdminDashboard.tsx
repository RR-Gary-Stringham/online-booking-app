import React, { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Settings, Save, CheckCircle, XCircle, Trash2, Plus, Info, Copy, ClipboardCheck, ToggleLeft, ToggleRight, Edit, ArrowDown, ExternalLink, Mail, Workflow, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WeeklyWorkingDay, MeetingType, Booking, ProviderSettings } from '../types';
import type { CalendarTemplate } from '../types';
import { supportedTimeZones } from '../lib/date';
import RRGoogleIcon from './RRGoogleIcon';

async function readApiResponse<T extends { error?: string }>(response: Response, fallbackMessage: string): Promise<T> {
  const responseText = await response.text();
  let result: T;
  try {
    result = (responseText ? JSON.parse(responseText) : {}) as T;
  } catch {
    throw new Error(
      `${fallbackMessage} The server returned ${response.status} ${response.statusText || 'an invalid response'} instead of JSON. Verify that APP_URL includes /app.`,
    );
  }
  if (!response.ok) throw new Error(result.error || fallbackMessage);
  return result;
}

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
  publicAppUrl: string;
  onBackToBooking?: () => void;
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
  onBackToBooking,
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
  const [profileImageUrl, setProfileImageUrl] = useState(settings.profileImageUrl || '');
  const [imageUploadStatus, setImageUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [imageUploadError, setImageUploadError] = useState('');

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

  useEffect(() => {
    if (googleUser?.displayName) setProviderName(googleUser.displayName);
  }, [googleUser]);

  // New meeting type form states
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeSlug, setNewTypeSlug] = useState('');
  const [newTypeEyebrow, setNewTypeEyebrow] = useState('');
  const [newTypeHeadline, setNewTypeHeadline] = useState('');
  const [newTypeSubheadline, setNewTypeSubheadline] = useState('');
  const [newTypeDesc, setNewTypeDesc] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('primary');
  const [editingMeetingTypeId, setEditingMeetingTypeId] = useState<string | null>(null);
  const [calendarTemplates, setCalendarTemplates] = useState<CalendarTemplate[]>([]);
  const [googleCalendars, setGoogleCalendars] = useState<Array<{ id: string; summary: string; primary: boolean; timeZone?: string }>>([]);
  const [newTypeDurations, setNewTypeDurations] = useState<number[]>([30]);
  const [newTypeAssignedUserIds, setNewTypeAssignedUserIds] = useState<string[]>([]);
  const [newTypeGoogleCalendarId, setNewTypeGoogleCalendarId] = useState('');
  const [templateSyncStatus, setTemplateSyncStatus] = useState<'idle' | 'loading' | 'saving' | 'error'>('idle');
  const [templateSyncError, setTemplateSyncError] = useState('');
  const [templateImageStatus, setTemplateImageStatus] = useState<'idle' | 'uploading' | 'error'>('idle');

  // Local copy of schedule
  const [localHours, setLocalHours] = useState<WeeklyWorkingDay[]>([...workingHours]);

  // Determine App URL for embedding
  const absoluteEmbedUrl = useMemo(() => {
    return `${publicAppUrl.replace(/\/$/, '')}?embed=true`;
  }, [publicAppUrl]);

  useEffect(() => {
    if (activeTab !== 'types' || !googleToken) return;
    const controller = new AbortController();
    setTemplateSyncStatus('loading');
    setTemplateSyncError('');
    Promise.all([
      fetch(`${publicAppUrl.replace(/\/$/, '')}/api/provider/templates`, { cache: 'no-store', signal: controller.signal }),
      fetch(`${publicAppUrl.replace(/\/$/, '')}/api/provider/calendars`, { cache: 'no-store', signal: controller.signal }),
    ])
      .then(async ([templatesResponse, calendarsResponse]) => {
        const [templatesResult, calendarsResult] = await Promise.all([
          readApiResponse<{ templates?: CalendarTemplate[]; error?: string }>(templatesResponse, 'Templates could not be loaded.'),
          readApiResponse<{ calendars?: Array<{ id: string; summary: string; primary: boolean; timeZone?: string }>; error?: string }>(calendarsResponse, 'Google calendars could not be loaded.'),
        ]);
        setCalendarTemplates(templatesResult.templates ?? []);
        setGoogleCalendars(calendarsResult.calendars ?? []);
        setTemplateSyncStatus('idle');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setTemplateSyncStatus('error');
        setTemplateSyncError(error instanceof Error ? error.message : 'Templates could not be loaded.');
      });
    return () => controller.abort();
  }, [activeTab, googleToken, publicAppUrl]);

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
    const nameParts = providerName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    onUpdateSettings({
      name: providerName,
      firstName,
      lastName,
      email: settings.email,
      businessName,
      welcomeMessage,
      timezone,
      colorTheme,
      brevoApiKey,
      brevoSenderEmail,
      brevoSenderName,
      profileImageUrl,
    });
    setIsSavedSuccessfully(true);
    setTimeout(() => setIsSavedSuccessfully(false), 3000);
  };

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUploadStatus('uploading');
    setImageUploadError('');

    try {
      if (file.size > 4 * 1024 * 1024) {
        throw new Error('The image must be smaller than 4MB.');
      }
      const body = new FormData();
      body.append('image', file);
      const response = await fetch(`${publicAppUrl.replace(/\/$/, '')}/api/provider/profile-image`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const responseText = await response.text();
      let result: { url?: string; error?: string } = {};
      try {
        result = responseText ? JSON.parse(responseText) as { url?: string; error?: string } : {};
      } catch {
        throw new Error(
          `The upload endpoint returned ${response.status} ${response.statusText || 'an invalid response'}. Verify that APP_URL includes the application path (/app).`,
        );
      }
      if (!response.ok || !result.url) throw new Error(result.error || 'The image could not be uploaded.');

      setProfileImageUrl(result.url);
      onUpdateSettings({ ...settings, profileImageUrl: result.url });
      setImageUploadStatus('success');
    } catch (error) {
      setImageUploadStatus('error');
      setImageUploadError(error instanceof Error ? error.message : 'The image could not be uploaded.');
    } finally {
      event.target.value = '';
    }
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
      const response = await fetch(`${publicAppUrl.replace(/\/$/, '')}/api/send-confirmation`, {
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

  const meetingTypeSlug = (value: string) => value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const resetMeetingTypeForm = () => {
    setNewTypeName('');
    setNewTypeSlug('');
    setNewTypeDurations([30]);
    setNewTypeEyebrow('');
    setNewTypeHeadline('');
    setNewTypeSubheadline('');
    setNewTypeDesc('');
    setNewTypeAssignedUserIds([]);
    setNewTypeGoogleCalendarId('');
    setNewTypeColor('primary');
    setEditingMeetingTypeId(null);
    setShowAddType(false);
  };

  const handleSaveMeetingType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim() || newTypeDurations.length === 0) return;
    setTemplateSyncStatus('saving');
    setTemplateSyncError('');
    try {
      const current = calendarTemplates.find((template) => template.id === editingMeetingTypeId);
      const themeByKey: Record<string, { option: string; background: string; foreground: string }> = {
        primary: { option: 'de19b1a787631a7fa7465ac0ce660669', background: '#163666', foreground: '#b2d3de' },
        cyan: { option: '92b1e0fb7ba8cb271be2977f9680e91a', background: '#00a6b6', foreground: '#faca78' },
        powder: { option: '65f7ca05d8d4bb4f63c4769d2207e4ce', background: '#b2d3de', foreground: '#163666' },
        yellow: { option: '54ead04968b81d364d6fc2c89eae383d', background: '#faca78', foreground: '#e05047' },
        orange: { option: 'cdffc34f624175663ffab0393cd115d5', background: '#f37d59', foreground: '#163666' },
        purple: { option: '018ee43bb3cc33642df6a915a42dabfa', background: '#8e456a', foreground: '#f37d59' },
        frost: { option: '56d54fcab5d4345689bd2ed4f91c86b2', background: '#eff5f6', foreground: '#163666' },
      };
      const theme = themeByKey[newTypeColor] || themeByKey.primary;
      const response = await fetch(`${publicAppUrl.replace(/\/$/, '')}/api/provider/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMeetingTypeId || undefined,
          name: newTypeName.trim(),
          slug: meetingTypeSlug(newTypeSlug || newTypeName),
          templateName: newTypeName.trim(),
          eyebrow: newTypeEyebrow,
          headline: newTypeHeadline,
          subheadline: newTypeSubheadline,
          description: newTypeDesc,
          isUserTemplate: current?.isUserTemplate ?? false,
          firstName: current?.firstName,
          lastName: current?.lastName,
          googleCalendarId: newTypeGoogleCalendarId,
          meetingDurations: newTypeDurations,
          assignedUserIds: newTypeAssignedUserIds,
          useTheme: true,
          themeOption: theme.option,
          themeBackground: theme.background,
          themeForeground: theme.foreground,
        }),
      });
      const result = await readApiResponse<{ templates?: CalendarTemplate[]; createdCalendar?: { id: string; summary: string; timeZone?: string }; error?: string }>(response, 'Template could not be saved.');
      setCalendarTemplates(result.templates ?? []);
      if (result.createdCalendar) {
        const createdCalendar = result.createdCalendar;
        setGoogleCalendars((currentCalendars) => currentCalendars.some((calendar) => calendar.id === createdCalendar.id)
          ? currentCalendars
          : [...currentCalendars, { ...createdCalendar, primary: false }]);
      }
      setTemplateSyncStatus('idle');
      resetMeetingTypeForm();
    } catch (error) {
      setTemplateSyncStatus('error');
      setTemplateSyncError(error instanceof Error ? error.message : 'Template could not be saved.');
    }
  };

  const handleEditMeetingType = (template: CalendarTemplate) => {
    setEditingMeetingTypeId(template.id);
    setNewTypeName(template.templateName || template.name);
    setNewTypeSlug(template.slug);
    setNewTypeDurations(template.meetingDurations.length ? template.meetingDurations : [30]);
    setNewTypeEyebrow(template.eyebrow);
    setNewTypeHeadline(template.headline);
    setNewTypeSubheadline(template.subheadline);
    setNewTypeDesc(template.description);
    setNewTypeAssignedUserIds(template.assignedUserIds);
    setNewTypeGoogleCalendarId(template.googleCalendarId);
    const colorKey = Object.entries({ primary: '#163666', cyan: '#00a6b6', powder: '#b2d3de', yellow: '#faca78', orange: '#f37d59', purple: '#8e456a', frost: '#eff5f6' })
      .find(([, value]) => value.toLowerCase() === template.themeBackground.toLowerCase())?.[0];
    setNewTypeColor(colorKey || 'primary');
    setShowAddType(true);
  };

  const handleTemplateImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editingMeetingTypeId) return;
    setTemplateImageStatus('uploading');
    setTemplateSyncError('');
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('The image must be smaller than 4MB.');
      const body = new FormData();
      body.append('image', file);
      body.append('templateId', editingMeetingTypeId);
      const response = await fetch(`${publicAppUrl.replace(/\/$/, '')}/api/provider/profile-image`, {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const result = await readApiResponse<{ url?: string; error?: string }>(response, 'Template image could not be uploaded.');
      setCalendarTemplates((templates) => templates.map((template) => template.id === editingMeetingTypeId ? { ...template, userImageUrl: result.url } : template));
      setTemplateImageStatus('idle');
    } catch (error) {
      setTemplateImageStatus('error');
      setTemplateSyncError(error instanceof Error ? error.message : 'Template image could not be uploaded.');
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteMeetingType = async (id: string) => {
    if (confirm('Delete this meeting format? This cannot be undone.')) {
      setTemplateSyncStatus('saving');
      setTemplateSyncError('');
      try {
        const response = await fetch(`${publicAppUrl.replace(/\/$/, '')}/api/provider/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const result = await readApiResponse<{ templates?: CalendarTemplate[]; error?: string }>(response, 'Template could not be deleted.');
        setCalendarTemplates(result.templates ?? []);
        setTemplateSyncStatus('idle');
      } catch (error) {
        setTemplateSyncStatus('error');
        setTemplateSyncError(error instanceof Error ? error.message : 'Template could not be deleted.');
      }
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
    <div className="admin-workspace relative w-full bg-white rounded-3xl border border-dark-blue shadow-xl overflow-hidden min-h-[580px] grid grid-cols-1 lg:grid-cols-12">
      
      {/* Side navigational rail */}
      <div className="lg:col-span-3 bg-slate-50 border-r border-slate-100 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            {googleUser?.photoURL ? (
              <img src={googleUser.photoURL} alt={googleUser.displayName || 'Provider'} className="w-10 h-10 rounded-full object-cover shadow-md" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[#b2d3de] font-display font-bold shadow-md bg-[#163666]">
                {(googleUser?.displayName || settings.name || 'Provider').split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h4 className="text-sm font-bold text-slate-800 font-display">{googleUser?.displayName || settings.name || 'Provider Control'}</h4>
              <span className="text-xs text-slate-400 font-medium">{googleUser?.email || settings.email}</span>
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
                  <div className="bg-[#00a6b6] border border-[#00a6b6] rounded-xl p-2.5 text-center min-w-20">
                    <span className="block text-[#faca78] text-[10px] font-semibold uppercase font-mono">Bookings</span>
                    <span className="rr-metric-value rr-metric-value-cyan text-md font-bold font-display">{statsBookings.total}</span>
                  </div>
                  <div className="bg-[#8e456a] rounded-xl p-2.5 text-center min-w-20">
                    <span className="block text-[#f37d59] text-[10px] font-semibold uppercase font-mono">Pending</span>
                    <span className="rr-metric-value rr-metric-value-purple text-md font-bold font-display">{statsBookings.pending}</span>
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
                  onClick={() => showAddType ? resetMeetingTypeForm() : setShowAddType(true)}
                  className="px-4 py-2 border border-slate-150 text-slate-700 hover:bg-slate-50 shadow-xs rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>{showAddType ? 'Cancel' : 'Create template'}</span>
                </button>
              </div>

              {showAddType && (
                <motion.form
                  onSubmit={handleSaveMeetingType}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-5 border border-slate-150 rounded-2xl bg-slate-50/50 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Template Slug</label>
                      <input
                        id="new-type-slug"
                        type="text"
                        required
                        className="w-full px-4 py-2 text-xs font-semibold border border-slate-150 bg-white rounded-xl focus:ring-4 focus:ring-slate-400/5 focus:outline-none"
                        value={newTypeSlug}
                        onChange={(e) => setNewTypeSlug(meetingTypeSlug(e.target.value))}
                        onFocus={() => {
                          if (!newTypeSlug) setNewTypeSlug(meetingTypeSlug(newTypeName));
                        }}
                        placeholder="partner-meeting"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Meeting Durations</label>
                      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-150 bg-white px-3 py-2">
                        {[15, 30, 45, 60, 90].map((duration) => (
                          <label key={duration} className="flex items-center gap-1 text-xs text-slate-600">
                            <input type="checkbox" checked={newTypeDurations.includes(duration)} onChange={() => setNewTypeDurations((current) => current.includes(duration) ? current.filter((value) => value !== duration) : [...current, duration].sort((a, b) => a - b))} />
                            {duration}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Eyebrow</label>
                      <input
                        id="new-type-eyebrow"
                        type="text"
                        className="w-full px-4 py-2 text-xs border border-slate-150 bg-white rounded-xl focus:ring-4 focus:ring-slate-400/5 focus:outline-none"
                        value={newTypeEyebrow}
                        onChange={(e) => setNewTypeEyebrow(e.target.value)}
                        placeholder="Select a Meeting Option"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Headline</label>
                      <input
                        id="new-type-headline"
                        type="text"
                        className="w-full px-4 py-2 text-xs border border-slate-150 bg-white rounded-xl focus:ring-4 focus:ring-slate-400/5 focus:outline-none"
                        value={newTypeHeadline}
                        onChange={(e) => setNewTypeHeadline(e.target.value)}
                        placeholder="Book a Meeting"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Subheadline</label>
                      <input
                        id="new-type-subheadline"
                        type="text"
                        className="w-full px-4 py-2 text-xs border border-slate-150 bg-white rounded-xl focus:ring-4 focus:ring-slate-400/5 focus:outline-none"
                        value={newTypeSubheadline}
                        onChange={(e) => setNewTypeSubheadline(e.target.value)}
                        placeholder="Choose a time that works for you."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Google Calendar</label>
                      <select className="w-full px-4 py-2 text-xs border border-slate-150 bg-white rounded-xl" value={newTypeGoogleCalendarId} onChange={(e) => setNewTypeGoogleCalendarId(e.target.value)}>
                        <option value="">Select a destination calendar</option>
                        {googleCalendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.summary}{calendar.primary ? ' (Primary)' : ''}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Assigned Users</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-150 bg-white p-3">
                      {calendarTemplates.filter((template) => template.isUserTemplate).map((user) => {
                        const editingTemplate = calendarTemplates.find((template) => template.id === editingMeetingTypeId);
                        const isOwnUserTemplate = editingTemplate?.isUserTemplate === true && (
                          user.id === editingTemplate.id ||
                          (!!googleUser?.email && user.googleCalendarId.toLowerCase() === googleUser.email.toLowerCase())
                        );
                        return (
                          <label key={user.id} className={`flex items-center gap-2 text-xs text-slate-600 ${isOwnUserTemplate ? 'font-semibold' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isOwnUserTemplate || newTypeAssignedUserIds.includes(user.id)}
                              disabled={isOwnUserTemplate}
                              onChange={() => setNewTypeAssignedUserIds((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])}
                            />
                            {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.templateName}
                            {isOwnUserTemplate && <span className="text-[10px] text-slate-400">Your calendar</span>}
                          </label>
                        );
                      })}
                      {!calendarTemplates.some((template) => template.isUserTemplate) && <span className="text-xs text-slate-400">No user templates are available yet.</span>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Description Text</label>
                    <textarea
                      id="new-type-desc"
                      rows={2}
                      className="w-full px-4 py-2 text-xs border border-slate-150 bg-white rounded-xl focus:ring-4 focus:ring-slate-400/5 focus:outline-none"
                      value={newTypeDesc}
                      onChange={(e) => setNewTypeDesc(e.target.value)}
                      placeholder="Brief bullet points on objectives or expectations..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Template Image</label>
                    {editingMeetingTypeId ? (
                      <div className="flex items-center gap-3">
                        {calendarTemplates.find((template) => template.id === editingMeetingTypeId)?.userImageUrl && (
                          <img
                            src={calendarTemplates.find((template) => template.id === editingMeetingTypeId)?.userImageUrl}
                            alt="Current template"
                            className="w-14 h-14 rounded-full object-cover border border-slate-150"
                          />
                        )}
                        <div className="space-y-2">
                          <label className={`rr-upload-image-button ${templateImageStatus === 'uploading' ? 'is-disabled' : ''}`}>
                            {templateImageStatus === 'uploading' ? 'Uploading…' : 'Upload Image'}
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleTemplateImageUpload} disabled={templateImageStatus === 'uploading'} />
                          </label>
                          <p className="text-[10px] text-slate-400">JPEG, PNG, WebP, or GIF. Maximum 4MB.</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Save the new template first, then edit it to upload an image.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Format Theme Color</label>
                      <div className="flex gap-2">
                        {[
                          { key: 'primary', name: 'Primary', varName: '#163666' },
                          { key: 'cyan', name: 'Cyan', varName: '#00a6b6' },
                          { key: 'powder', name: 'Powder', varName: '#b2d3de' },
                          { key: 'yellow', name: 'Yellow', varName: '#faca78' },
                          { key: 'orange', name: 'Orange', varName: '#f37d59' },
                          { key: 'purple', name: 'Purple', varName: '#8e456a' },
                          { key: 'frost', name: 'Frost', varName: '#eff5f6' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            id={`color-btn-${c.key}`}
                            type="button"
                            onClick={() => setNewTypeColor(c.key)}
                            aria-pressed={newTypeColor === c.key}
                            className={`relative w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${newTypeColor === c.key ? 'rr-theme-color-selected scale-110 shadow-xs opacity-100' : 'border-transparent opacity-75 hover:opacity-100'}`}
                            style={{ backgroundColor: c.varName }}
                            title={c.name}
                          >
                            {newTypeColor === c.key && <CheckCircle size={15} className="rr-theme-color-check" aria-hidden="true" />}
                            <span className="sr-only">{c.name}{newTypeColor === c.key ? ' selected' : ''}</span>
                          </button>
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
                        <span>{editingMeetingTypeId ? 'Save template' : 'Add template'}</span>
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}

              {templateSyncError && <p className="text-xs text-red">{templateSyncError}</p>}
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {calendarTemplates.map((mt) => (
                  <div
                    key={mt.id}
                    className="p-4 border border-slate-150 bg-white transition flex items-start justify-between gap-4 shadow-3xs"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1.5 w-3 h-3 rounded-full`}
                        style={{
                          backgroundColor:
                            mt.themeBackground || 'var(--color-dark-blue)'
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{mt.templateName || mt.name}</span>
                          <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{mt.meetingDurations.join(', ')} mins</span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 mt-1">/{mt.slug || meetingTypeSlug(mt.name)}</p>
                        {!!mt.headline && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{mt.headline}</p>}
                        {!!mt.assignedUsers.length && (
                          <p className="text-[10px] text-slate-400 mt-1">Assigned: {mt.assignedUsers.map((user) => [user.firstName, user.lastName].filter(Boolean).join(' ') || user.templateName).join(', ')}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        id={`btn-edit-mt-${mt.id}`}
                        onClick={() => handleEditMeetingType(mt)}
                        className="p-1 text-slate-500 hover:text-primary hover:bg-slate-50 rounded-lg transition"
                        title={`Edit ${mt.name}`}
                        aria-label={`Edit ${mt.name}`}
                      >
                        <Edit size={15} />
                      </button>

                      <button
                        id={`btn-del-mt-${mt.id}`}
                        onClick={() => handleDeleteMeetingType(mt.id)}
                        className="p-1 bg-red-50 text-red hover:bg-red hover:text-red-inverse rounded-lg transition"
                        title={`Delete ${mt.name}`}
                        aria-label={`Delete ${mt.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {templateSyncStatus === 'loading' && <p className="text-xs text-slate-400">Loading CMS templates and calendars…</p>}
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

                    <div className="provider-image-setting">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Provider Image</label>
                      <div className="flex items-center gap-4">
                        {(profileImageUrl || googleUser?.photoURL) ? (
                          <img
                            src={profileImageUrl || googleUser.photoURL}
                            alt={providerName || 'Provider'}
                            className="w-[100px] h-[100px] rounded-full object-cover border-2 border-[#163666]"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-[100px] h-[100px] rounded-full bg-[#163666] text-[#b2d3de] flex items-center justify-center font-display font-bold text-2xl uppercase">
                            {providerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('') || 'RR'}
                          </div>
                        )}
                        <div className="space-y-2">
                          <label className={`rr-upload-image-button ${imageUploadStatus === 'uploading' ? 'is-disabled' : ''}`}>
                            {imageUploadStatus === 'uploading' ? 'Uploading…' : 'Upload Image'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              disabled={imageUploadStatus === 'uploading'}
                              onChange={handleProfileImageUpload}
                            />
                          </label>
                          <p className="text-[10px] text-slate-400">JPEG, PNG, WebP, or GIF. Maximum 4MB.</p>
                          {imageUploadStatus === 'success' && <p className="text-[10px] text-green">Saved to Webflow.</p>}
                          {imageUploadError && <p className="text-[10px] text-red">{imageUploadError}</p>}
                        </div>
                      </div>
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
                          className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-slate-500 text-[#B2D3dE] hover:bg-[#eff5f6] disabled:opacity-50 transition"
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
                        <div className="flex items-center gap-4 p-4 bg-[#EFF5F6] border border-[#163666]/20 rounded-xl">
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
                            className="w-full text-center py-2.5 px-4 bg-[#e05047] text-[#b2d3de] rounded-xl text-xs font-bold transition border border-[#e05047] cursor-pointer hover:bg-[#e05047] hover:text-[#b2d3de]"
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
                        <div className="rr-calendar-feature-number w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0">01</div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-700">Dynamic Blockout Engine</h5>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Planned: read primary-calendar busy periods server-side and remove conflicting public slots.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="rr-calendar-feature-number w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0">02</div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-700">Instant Invites & Notifications</h5>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Planned: create the calendar event and send an invitation after a booking is confirmed.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="rr-calendar-feature-number w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0">03</div>
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

        {onBackToBooking && (
          <div className="rr-google-nav-wrap rr-google-nav-wrap-admin">
            <RRGoogleIcon label="Return to Booking Page" onClick={onBackToBooking} />
          </div>
        )}
      </div>

    </div>
  );
}
