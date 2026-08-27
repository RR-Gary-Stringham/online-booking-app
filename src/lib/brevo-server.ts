import 'server-only';

export type BookingEmailKind = 'confirmation' | 'change' | 'cancellation';

const DEFAULT_TEMPLATE_IDS: Record<BookingEmailKind, number> = {
  confirmation: 9,
  cancellation: 10,
  change: 11,
};

const TEMPLATE_ENV_NAMES: Record<BookingEmailKind, string> = {
  confirmation: 'BREVO_BOOKING_CONFIRMATION_TEMPLATE_ID',
  cancellation: 'BREVO_BOOKING_CANCELLATION_TEMPLATE_ID',
  change: 'BREVO_BOOKING_CHANGE_TEMPLATE_ID',
};

export interface BrevoBookingParams {
  FIRST_NAME: string;
  FIRSTNAME: string;
  INTERNAL_NAME: string;
  MEETING_TIME: string;
  MEETING_LINK: string;
  CANCEL_LINK: string;
  RESCHEDULE_LINK: string;
  OUTLOOK_CAL: string;
  GOOGLE_CAL: string;
}

export class BrevoConfigurationError extends Error {}

export async function sendBrevoBookingEmail(input: {
  kind: BookingEmailKind;
  recipientEmail: string;
  recipientName: string;
  params: BrevoBookingParams;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new BrevoConfigurationError('BREVO_API_KEY is not configured.');
  const configuredId = process.env[TEMPLATE_ENV_NAMES[input.kind]];
  const templateId = configuredId ? Number(configuredId) : DEFAULT_TEMPLATE_IDS[input.kind];
  if (!Number.isInteger(templateId) || templateId <= 0) {
    throw new BrevoConfigurationError(`${TEMPLATE_ENV_NAMES[input.kind]} must be a positive template ID.`);
  }

  console.info('[brevo] Sending booking email.', {
    kind: input.kind,
    templateId,
    parameters: Object.fromEntries(
      Object.entries(input.params).map(([name, value]) => [name, Boolean(value)]),
    ),
  });

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      to: [{ email: input.recipientEmail, name: input.recipientName }],
      templateId,
      params: input.params,
    }),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({})) as { message?: string; messageId?: string };
  if (!response.ok) throw new Error(result.message || `Brevo rejected template ${templateId}.`);
  console.info('[brevo] Booking email accepted.', {
    kind: input.kind,
    templateId,
    messageId: result.messageId || null,
  });
  return result;
}
