'use client';

import { useEffect, useState } from 'react';

interface BookingDetails {
  clientName: string;
  summary: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  slug: string;
  cancelled: boolean;
}

export default function ManageBooking({ token, publicAppUrl }: { token: string; publicAppUrl: string }) {
  const endpoint = `${publicAppUrl.replace(/\/$/, '')}/api/bookings/manage/${encodeURIComponent(token)}`;
  const [details, setDetails] = useState<BookingDetails | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(endpoint, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'This meeting could not be loaded.');
        setDetails(result);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'This meeting could not be loaded.'));
  }, [endpoint]);

  const cancelMeeting = async () => {
    if (!window.confirm('Cancel this meeting for everyone?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The meeting could not be cancelled.');
      setDetails((current) => current ? { ...current, cancelled: true } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The meeting could not be cancelled.');
    } finally {
      setBusy(false);
    }
  };

  const rescheduleUrl = details
    ? `${publicAppUrl}?calendar=${encodeURIComponent(details.slug)}`
    : publicAppUrl;
  const formattedDate = details ? new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: details.timeZone,
  }).format(new Date(details.startIso)) : '';

  return (
    <main className="min-h-screen bg-[#eff5f6] p-5 text-[#163666] flex items-center justify-center">
      <section className="w-full max-w-3xl bg-[#fafafa] border-[3px] border-[#163666] p-8 md:p-12">
        <p className="font-bold uppercase tracking-widest text-xs mb-4">REVREBEL Booking Calendar</p>
        <h1 className="font-heading font-bold uppercase text-5xl md:text-7xl leading-[.9] mb-8">Manage<br />Meeting</h1>
        {!details && !error && <p>Loading your meeting…</p>}
        {error && <p className="border-2 border-[#e05047] p-4">{error}</p>}
        {details && (
          <>
            <div className="border-2 border-[#163666] bg-white p-5 mb-7 font-sans">
              <p className="font-bold mb-2">{details.summary}</p>
              <p>{formattedDate}</p>
              <p className="text-sm mt-1">{details.timeZone}</p>
              {details.cancelled && <p className="font-bold uppercase mt-4 text-[#e05047]">Meeting cancelled</p>}
            </div>
            {!details.cancelled && (
              <div className="flex flex-wrap gap-4">
                <button type="button" onClick={cancelMeeting} disabled={busy} className="button bg-[#e05047] border-[#e05047] text-[#b2d3de] disabled:opacity-50">
                  {busy ? 'Cancelling…' : 'Cancel Meeting'}
                </button>
                <a href={rescheduleUrl} className="button-outline">Choose a New Time</a>
              </div>
            )}
            {details.cancelled && <a href={rescheduleUrl} className="button-outline">Schedule Another</a>}
          </>
        )}
      </section>
    </main>
  );
}
