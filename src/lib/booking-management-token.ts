import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface ManagedCalendarEvent {
  subject: string;
  calendarId: string;
  eventId: string;
  notifyAttendee: boolean;
}

export interface BookingManagementPayload {
  version: 1;
  slug: string;
  clientName: string;
  clientEmail: string;
  summary: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  events: ManagedCalendarEvent[];
  expiresAt: number;
}

function encryptionKey() {
  const source = process.env.TOKEN_ENCRYPTION_KEY;
  if (!source) throw new Error('TOKEN_ENCRYPTION_KEY is required for booking management links.');
  return createHash('sha256').update(`booking-management:${source}`).digest();
}

export function createBookingManagementToken(payload: BookingManagementPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function readBookingManagementToken(token: string) {
  try {
    const packed = Buffer.from(token, 'base64url');
    if (packed.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([
      decipher.update(packed.subarray(28)),
      decipher.final(),
    ]).toString('utf8')) as BookingManagementPayload;
    if (payload.version !== 1 || payload.expiresAt <= Date.now() || !Array.isArray(payload.events)) return null;
    return payload;
  } catch {
    return null;
  }
}
