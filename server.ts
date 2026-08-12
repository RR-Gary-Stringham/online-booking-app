import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Send beautifully branded confirmation email via Brevo
  app.post('/api/send-confirmation', async (req, res) => {
    const {
      clientEmail,
      clientName,
      meetingType,
      dateTime,
      providerName,
      meetingDuration,
      referenceId,
      brevoApiKey,
      brevoSenderEmail,
      brevoSenderName,
      customNotes
    } = req.body;

    // Use customized settings parameters or default to environment variables
    const apiKey = brevoApiKey || process.env.BREVO_API_KEY;
    const senderEmail = brevoSenderEmail || process.env.BREVO_SENDER_EMAIL || 'notifications@revrebel.io';
    const senderName = brevoSenderName || process.env.BREVO_SENDER_NAME || 'Rev Rebel Strategy';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Brevo SMTP Secret API Key is not configured. Please supply it in the Provider Workspace under Branded Email Settings.'
      });
    }

    if (!clientEmail) {
      return res.status(400).json({
        success: false,
        error: 'Client email target is missing'
      });
    }

    try {
      // Premium Branded Responsive Email Template using fine typography, colors, and layout rhythm
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Meeting is Confirmed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #fafafa;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #fafafa;
      padding: 48px 24px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 28px;
      border: 1px solid #f1f1f1;
      box-shadow: 0 20px 40px rgba(0,0,0,0.02);
      overflow: hidden;
    }
    .header {
      background-color: #0c1523;
      padding: 44px 36px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: "Barlow", sans-serif;
    }
    .header p {
      margin: 10px 0 0 0;
      font-size: 11px;
      color: #8c9cb2;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-weight: 600;
    }
    .content {
      padding: 44px 36px;
    }
    .greeting {
      font-size: 17px;
      font-weight: 700;
      color: #0c1523;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .message {
      font-size: 14px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 32px;
    }
    .details-card {
      background-color: #fcfcfc;
      border: 1px solid #f4f4f4;
      border-radius: 18px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #f4f4f4;
    }
    .detail-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .detail-row:first-child {
      padding-top: 0;
    }
    .detail-label {
      font-size: 11px;
      font-weight: 700;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .detail-value {
      font-size: 13px;
      font-weight: 600;
      color: #0c1523;
      text-align: right;
    }
    .btn-container {
      text-align: center;
      margin-top: 8px;
      margin-bottom: 8px;
    }
    .btn {
      display: inline-block;
      background-color: #0c1523;
      color: #ffffff !important;
      text-decoration: none;
      padding: 13px 28px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 14px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      box-shadow: 0 4px 6px rgba(12, 21, 35, 0.15);
    }
    .footer {
      background-color: #fafafa;
      padding: 28px 36px;
      text-align: center;
      border-top: 1px solid #f1f1f1;
      font-size: 11px;
      color: #888888;
      line-height: 1.6;
    }
    .footer a {
      color: #0c1523;
      text-decoration: underline;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Reservation Confirmed</h1>
        <p>${providerName} Sync System</p>
      </div>
      <div class="content">
        <h2 class="greeting">Hi ${clientName},</h2>
        <p class="message">
          Your reservation is officially confirmed. A Calendar meeting has been directly scheduled with Google. Below are the precise details regarding your upcoming consultation. We look forward to connecting with you.
        </p>
        
        <div class="details-card">
          <div class="detail-row">
            <span class="detail-label">Consultant</span>
            <span class="detail-value">${providerName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Service Type</span>
            <span class="detail-value">${meetingType}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Duration</span>
            <span class="detail-value">${meetingDuration} Minutes</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date & Time</span>
            <span class="detail-value">${dateTime}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Reference ID</span>
            <span class="detail-value" style="font-family: monospace; font-size: 11px; letter-spacing: 0.05em;">${referenceId}</span>
          </div>
        </div>

        ${customNotes ? `
          <div style="margin-bottom: 32px;">
            <h4 style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; color: #888888; letter-spacing: 0.08em; font-weight: 700;">Your Message / Notes</h4>
            <blockquote style="margin: 0; padding: 14px 18px; border-left: 3px solid #0c1523; background-color: #fbfbfb; font-size: 13px; color: #444444; font-style: italic; border-radius: 0 14px 14px 0; line-height: 1.5;">
              "${customNotes}"
            </blockquote>
          </div>
        ` : ''}

        <div class="btn-container">
          <a href="${process.env.APP_URL || 'https://revrebel.io'}" class="btn" target="_blank">Connect Rev Rebel</a>
        </div>
      </div>
      
      <div class="footer">
        <p>&copy; 2026 Rev Rebel Strategy. All rights reserved.</p>
        <p>This message is synced and managed automatically on behalf of ${providerName}. If you have any questions or require rescheduling, kindly get in touch.</p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      // Dispatch to Brevo's SMTP API
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: clientEmail, name: clientName }],
          subject: `${meetingType} Confirmed — ${clientName}`,
          htmlContent: htmlContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Brevo API Response Error details:', errorData);
        return res.status(response.status).json({
          success: false,
          error: errorData.message || 'Brevo server rejected request.'
        });
      }

      const resData = await response.json();
      return res.json({ success: true, messageId: resData.messageId });
    } catch (error: any) {
      console.error('Brevo communication crash:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // Hot Module Replacement (HMR) and Vite configuration setups
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening of port ${PORT}`);
  });
}

startServer();
