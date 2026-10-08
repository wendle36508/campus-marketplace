// Sends verification emails. Pick a provider with EMAIL_PROVIDER:
//   console  - prints the code to the server log (default, no setup)
//   resend   - https://resend.com, needs RESEND_API_KEY and a verified sender domain
//   smtp     - any SMTP server (Gmail app password, SendGrid, Postmark, SES...)
const config = require('../config');

function buildEmail({ code, magicUrl, schoolName }) {
  const subject = `${code} is your ${config.appName} code`;
  const text = [
    `Your ${config.appName} verification code is ${code}`,
    '',
    `Or tap this link to sign in: ${magicUrl}`,
    '',
    `The code expires in 15 minutes. If you didn't request it, you can ignore this email.`,
    `${config.appName} is only open to verified ${schoolName} students.`,
  ].join('\n');
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:440px;margin:auto;padding:24px;color:#14201b">
    <h2 style="margin:0 0 8px">${config.appName}</h2>
    <p>Your verification code is</p>
    <p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:8px 0 20px">${code}</p>
    <p><a href="${magicUrl}" style="display:inline-block;background:#006644;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Sign in with one tap</a></p>
    <p style="color:#5f6b66;font-size:13px">This code expires in 15 minutes. If you didn't request it, ignore this email.<br>
    ${config.appName} is only open to verified ${schoolName} students.</p>
  </div>`;
  return { subject, text, html };
}

async function sendVerificationEmail({ to, code, magicUrl, schoolName }) {
  const msg = buildEmail({ code, magicUrl, schoolName });
  const provider = config.email.provider;

  if (provider === 'resend') {
    if (!config.email.resendApiKey) throw new Error('RESEND_API_KEY is not set');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.email.from, to: [to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    return;
  }

  if (provider === 'smtp') {
    const nodemailer = require('nodemailer');
    const s = config.email.smtp;
    const transport = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: s.user ? { user: s.user, pass: s.pass } : undefined,
    });
    await transport.sendMail({ from: config.email.from, to, subject: msg.subject, text: msg.text, html: msg.html });
    return;
  }

  // console (dev)
  console.log(
    `\n┌─ Verification email (dev mode, not actually sent) ─────────\n` +
      `│ To:    ${to}\n│ Code:  ${code}\n│ Link:  ${magicUrl}\n` +
      `└────────────────────────────────────────────────────────────\n`
  );
}

module.exports = { sendVerificationEmail };
