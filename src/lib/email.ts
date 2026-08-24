export interface ConfirmationEmailInput {
  clientEmail: string;
  clientName: string;
  meetingType: string;
  dateTime: string;
  providerName: string;
  meetingDuration: number;
  referenceId: string;
  customNotes?: string;
  manageUrl?: string;
  cancelUrl?: string;
  rescheduleUrl?: string;
  meetingTime?: string;
  meetingLink?: string;
  outlookCalUrl?: string;
  googleCalUrl?: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);

export const renderConfirmationEmail = (input: ConfirmationEmailInput) => {
  const providerName = escapeHtml(input.providerName);
  const clientName = escapeHtml(input.clientName);
  const meetingType = escapeHtml(input.meetingType);
  const dateTime = escapeHtml(input.dateTime);
  const referenceId = escapeHtml(input.referenceId);
  const customNotes = input.customNotes ? escapeHtml(input.customNotes) : '';
  const manageUrl = input.manageUrl ? escapeHtml(input.manageUrl) : '';
  const cancelUrl = input.cancelUrl ? escapeHtml(input.cancelUrl) : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Meeting Confirmed</title>
  </head>
  <body style="margin:0;background:#eff5f6;color:#163666;font-family:Roboto,Arial,sans-serif">
    <div style="padding:40px 20px">
      <div style="max-width:620px;margin:0 auto;background:#fafafa;border:3px solid #163666">
        <div style="padding:28px 34px;border-bottom:2px solid #163666">
          <strong style="font-family:Arial Narrow,Arial,sans-serif;font-size:18px;text-transform:uppercase">${providerName}</strong>
          <div style="font-size:11px;margin-top:3px">Chief Rebel</div>
        </div>
        <div style="padding:42px 34px">
          <h1 style="margin:0 0 24px;font-family:Arial Narrow,Arial,sans-serif;font-size:46px;line-height:.9;text-transform:uppercase">Meeting<br>Confirmed</h1>
          <p style="font-size:14px;line-height:1.55">Hi ${clientName}, your ${meetingType} is officially locked in.</p>
          <div style="margin:26px 0;padding:20px;border:2px solid #163666;background:#fff">
            <p style="margin:0 0 8px"><strong>Date and time:</strong> ${dateTime}</p>
            <p style="margin:0 0 8px"><strong>Duration:</strong> ${input.meetingDuration} minutes</p>
            <p style="margin:0"><strong>Reference:</strong> ${referenceId}</p>
          </div>
          ${customNotes ? `<p style="font-size:13px;line-height:1.55"><strong>Notes:</strong> ${customNotes}</p>` : ''}
          ${manageUrl ? `<div style="margin-top:30px">
            <a href="${manageUrl}" style="display:inline-block;padding:16px 18px;border:3px solid #163666;color:#163666;font-family:Arial Narrow,Arial,sans-serif;font-weight:700;letter-spacing:.05em;text-decoration:none;text-transform:uppercase">Manage Meeting</a>
            ${cancelUrl ? `<p style="margin:16px 0 0;font-size:12px"><a href="${cancelUrl}" style="color:#163666">Cancel this meeting</a></p>` : ''}
          </div>` : ''}
        </div>
      </div>
    </div>
  </body>
</html>`;
};
