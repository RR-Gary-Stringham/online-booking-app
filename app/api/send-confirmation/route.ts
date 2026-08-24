import { NextResponse } from 'next/server';
import { ConfirmationEmailInput, renderConfirmationEmail } from '@/src/lib/email';

const requiredTextFields: Array<keyof ConfirmationEmailInput> = [
  'clientEmail',
  'clientName',
  'meetingType',
  'dateTime',
  'providerName',
  'referenceId',
];

export async function POST(request: Request) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Transactional email is not configured.' },
      { status: 503 },
    );
  }

  let input: ConfirmationEmailInput;
  try {
    input = await request.json() as ConfirmationEmailInput;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const hasMissingField = requiredTextFields.some((field) => (
    typeof input[field] !== 'string' || !String(input[field]).trim()
  ));
  if (hasMissingField || !Number.isFinite(input.meetingDuration)) {
    return NextResponse.json(
      { success: false, error: 'Required confirmation fields are missing.' },
      { status: 400 },
    );
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'notifications@revrebel.io';
  const senderName = process.env.BREVO_SENDER_NAME || 'REVREBEL';
  const templateId = Number(process.env.BREVO_BOOKING_CONFIRMATION_TEMPLATE_ID);
  const firstName = input.clientName.trim().split(/\s+/)[0] || 'Partner';
  const templateParams = {
    FIRST_NAME: firstName,
    INTERNAL_NAME: input.providerName || 'REVREBEL',
    MEETING_TIME: input.meetingTime || input.dateTime,
    MEETING_LINK: input.meetingLink || '',
    CANCEL_LINK: input.cancelUrl || input.manageUrl || '',
    RESCHEDULE_LINK: input.rescheduleUrl || input.manageUrl || '',
    OUTLOOK_CAL: input.outlookCalUrl || '',
    GOOGLE_CAL: input.googleCalUrl || '',
  };
  const message = Number.isInteger(templateId) && templateId > 0
    ? {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: input.clientEmail, name: input.clientName }],
        templateId,
        params: templateParams,
      }
    : {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: input.clientEmail, name: input.clientName }],
        subject: `${input.meetingType} confirmed — ${input.clientName}`,
        htmlContent: renderConfirmationEmail(input),
        params: templateParams,
      };
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const result = await response.json().catch(() => ({})) as { message?: string; messageId?: string };
  if (!response.ok) {
    return NextResponse.json(
      { success: false, error: result.message || 'Transactional email was rejected.' },
      { status: response.status },
    );
  }

  return NextResponse.json({ success: true, messageId: result.messageId });
}
