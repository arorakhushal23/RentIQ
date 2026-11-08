/**
 * Email Service for RentIQ
 *
 * Handles transactional emails using Nodemailer with SMTP configuration.
 * Adheres strictly to security guidelines:
 * - SMTP credentials read exclusively from environment variables
 * - No credentials hardcoded
 * - Reset tokens/links never logged to stdout in production
 * - Development-only test mailbox for local environments
 */

const nodemailer = require('nodemailer');

// Development-only store for testing email delivery without real SMTP
const devMailbox = new Map();

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

/**
 * Creates Nodemailer transporter based on environment configuration
 */
function createTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
        return nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass }
        });
    }

    // In development without external SMTP, return null to use mock/dev sink
    return null;
}

/**
 * Render responsive HTML email template for password reset
 */
function renderResetEmailHtml({ userName, resetUrl }) {
    const displayName = userName || 'Valued Customer';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your RentIQ Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f7fb;
      color: #1e293b;
    }
    .wrapper {
      max-width: 580px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 32px 40px;
      text-align: center;
    }
    .logo {
      font-size: 30px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -1px;
      margin: 0;
    }
    .logo span {
      color: #3b82f6;
    }
    .content {
      padding: 40px;
      line-height: 1.6;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 16px;
    }
    p {
      font-size: 15px;
      color: #475569;
      margin: 0 0 20px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .notice {
      background-color: #f8fafc;
      border-left: 4px solid #3b82f6;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13.5px;
      color: #64748b;
      margin-bottom: 24px;
    }
    .warning {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13.5px;
      color: #b45309;
      margin-bottom: 24px;
    }
    .fallback {
      font-size: 12.5px;
      color: #94a3b8;
      word-break: break-all;
    }
    .footer {
      background: #f8fafc;
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 12.5px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">Rent<span>IQ</span></div>
    </div>
    <div class="content">
      <h1>Password Reset Request</h1>
      <p>Hello ${displayName},</p>
      <p>We received a request to reset the password for your RentIQ account. Click the secure button below to choose a new password:</p>

      <div class="btn-container">
        <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
      </div>

      <div class="notice">
        <strong>Time-sensitive link:</strong> This password reset link is valid for <strong>15 minutes</strong> and can only be used once.
      </div>

      <div class="warning">
        <strong>Security Notice:</strong> If you did not request this password reset, no action is needed. Your current password remains safe and unchanged.
      </div>

      <p class="fallback">
        Button not working? Copy and paste this URL into your browser:<br>
        <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} RentIQ Technologies. All rights reserved.<br>
      This is an automated system notification. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail({ toEmail, userName, resetUrl, rawToken }) {
    const fromAddress = process.env.SMTP_FROM || '"RentIQ Security" <no-reply@rentiq.com>';
    const subject = 'RentIQ — Password Reset Request';
    const html = renderResetEmailHtml({ userName, resetUrl });
    const text = `Hello ${userName || 'User'},\n\nWe received a request to reset the password for your RentIQ account.\n\nUse the following link within 15 minutes to reset your password:\n${resetUrl}\n\nIf you did not request this reset, please ignore this email.\n\n— RentIQ Team`;

    const transporter = createTransporter();

    if (transporter) {
        // Real SMTP delivery
        const info = await transporter.sendMail({
            from: fromAddress,
            to: toEmail,
            subject,
            text,
            html
        });
        return { success: true, messageId: info.messageId, mode: 'smtp' };
    }

    // Local / Dev fallback when no SMTP configured
    const devRecord = {
        toEmail,
        userName,
        resetUrl,
        rawToken, // accessible in development test mode only
        sentAt: new Date()
    };
    devMailbox.set(toEmail.toLowerCase(), devRecord);

    if (!isProduction()) {
        console.log(`[RentIQ Email] Password reset email queued for ${toEmail} (SMTP not configured, captured in devMailbox)`);
    }

    return { success: true, mode: 'dev-mailbox' };
}

/**
 * Development-only accessor to test reset links without external mailbox
 * Strictly prohibited / returns null in production
 */
function getDevLatestResetLink(email) {
    if (isProduction()) {
        return null;
    }
    const record = devMailbox.get(email.toLowerCase());
    return record || null;
}

function clearDevMailbox() {
    devMailbox.clear();
}

module.exports = {
    sendPasswordResetEmail,
    getDevLatestResetLink,
    clearDevMailbox
};

