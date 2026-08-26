import { NextResponse } from 'next/server';
import { ConfirmationEmailInput } from '@/src/lib/email';
import { BrevoConfigurationError, sendBrevoBookingEmail } from '@/src/lib/brevo-server';

const requiredTextFields: Array<keyof ConfirmationEmailInput> = [
  'clientEmail',
  'clientName',
  'meetingType',
  'dateTime',
  'providerName',
  'referenceId',
];

export async function POST(request: Request) {
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

  const firstName = input.clientName.trim().split(/\s+/)[0] || 'Partner';
  const templateParams = {
    FIRST_NAME: firstName,
    FIRSTNAME: firstName,
    INTERNAL_NAME: input.providerName || 'REVREBEL',
    MEETING_TIME: input.meetingTime || input.dateTime,
    MEETING_LINK: input.meetingLink || '',
    CANCEL_LINK: input.cancelUrl || input.manageUrl || '',
    RESCHEDULE_LINK: input.rescheduleUrl || input.manageUrl || '',
    OUTLOOK_CAL: input.outlookCalUrl || '',
    GOOGLE_CAL: input.googleCalUrl || '',
  };
  try {
    const result = await sendBrevoBookingEmail({
      kind: input.emailKind === 'change' ? 'change' : 'confirmation',
      recipientEmail: input.clientEmail,
      recipientName: input.clientName,
      params: templateParams,
    });
    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('[brevo] Unable to send booking email.', error);
    return NextResponse.json(
      { success: false, error: error instanceof BrevoConfigurationError
        ? 'Transactional email is not configured.'
        : 'Transactional email was rejected.' },
      { status: error instanceof BrevoConfigurationError ? 503 : 502 },
    );
  }
}
