/**
 * E-Mail-Benachrichtigungen für PingR Admin
 * Nutzt nodemailer — konfigurierbar für Gmail, Outlook, eigenen SMTP
 */
import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  })
}

// Prüft ob SMTP konfiguriert ist
function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST)
}

export async function sendAdminAlert(subject: string, html: string): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || !isSmtpConfigured()) return

  try {
    const transporter = createTransport()
    await transporter.sendMail({
      from:    `"Nokki Security" <${process.env.SMTP_USER}>`,
      to:      adminEmail,
      subject: `[Nokki] ${subject}`,
      html,
    })
  } catch (err) {
    console.error('E-Mail-Versand fehlgeschlagen:', err)
  }
}

export async function sendCriticalAlert(data: {
  eventType:  string
  username:   string
  uin:        string
  email:      string
  content:    string
  legalBasis: string
  ip:         string
}): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#dc2626;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">🚨 Kritischer Sicherheitsverstoß erkannt</h2>
      </div>
      <div style="background:#1a1a2e;color:#f1f0f8;padding:24px;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#8b8aa8">Verstoß</td><td style="padding:8px 0;color:#f87171;font-weight:bold">${data.eventType.toUpperCase()}</td></tr>
          <tr><td style="padding:8px 0;color:#8b8aa8">Rechtsgrundlage</td><td style="padding:8px 0">${data.legalBasis}</td></tr>
          <tr><td style="padding:8px 0;color:#8b8aa8">Nutzer</td><td style="padding:8px 0">${data.username} (UIN: ${data.uin})</td></tr>
          <tr><td style="padding:8px 0;color:#8b8aa8">E-Mail</td><td style="padding:8px 0">${data.email}</td></tr>
          <tr><td style="padding:8px 0;color:#8b8aa8">IP-Adresse</td><td style="padding:8px 0;font-family:monospace">${data.ip}</td></tr>
          <tr><td style="padding:8px 0;color:#8b8aa8">Inhalt</td><td style="padding:8px 0;background:#0d0d14;padding:8px;border-radius:4px;font-family:monospace;color:#fca5a5">${data.content.substring(0, 200)}</td></tr>
          <tr><td style="padding:8px 0;color:#8b8aa8">Zeitpunkt</td><td style="padding:8px 0">${new Date().toISOString()}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#0d0d14;border-radius:8px">
          <p style="margin:0;color:#8b8aa8;font-size:14px">Admin-Panel öffnen:</p>
          <a href="${process.env.APP_URL || 'https://lumestack.de'}/admin"
             style="color:#60a5fa;text-decoration:none;font-size:14px">
            ${process.env.APP_URL || 'https://lumestack.de'}/admin
          </a>
        </div>
      </div>
    </div>
  `
  await sendAdminAlert(`🚨 ${data.eventType.toUpperCase()} — ${data.username}`, html)
}

export async function sendReportAlert(data: {
  reporterName: string
  reportedName: string
  reason:       string
  content:      string
}): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:600px">
      <div style="background:#ea580c;color:white;padding:20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">⚠️ Neue Nutzer-Meldung</h2>
      </div>
      <div style="background:#1a1a2e;color:#f1f0f8;padding:24px;border-radius:0 0 8px 8px">
        <p><strong>Gemeldet von:</strong> ${data.reporterName}</p>
        <p><strong>Gemeldet:</strong> ${data.reportedName}</p>
        <p><strong>Grund:</strong> ${data.reason}</p>
        <p><strong>Inhalt:</strong> <code style="background:#0d0d14;padding:4px 8px;border-radius:4px">${data.content.substring(0, 200)}</code></p>
        <a href="${process.env.APP_URL || 'https://lumestack.de'}/admin"
           style="display:inline-block;margin-top:16px;background:#4f6ef7;color:white;padding:10px 20px;border-radius:8px;text-decoration:none">
          Im Admin-Panel ansehen →
        </a>
      </div>
    </div>
  `
  await sendAdminAlert(`Neue Meldung: ${data.reason} — ${data.reportedName}`, html)
}

// ── NEU: E-Mail-Verifizierung ─────────────────────────────────────────────────
export async function sendVerificationEmail(
  email: string, username: string, token: string, uin?: string
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Mailer] SMTP nicht konfiguriert — Verify-Token für ${username}: ${token}`)
    }
    return false
  }

  const appUrl  = process.env.APP_URL || `https://lumestack.de`
  const link    = `${appUrl}/api/auth/verify-email?token=${token}`

  try {
    const transporter = createTransport()
    const uinBlock = uin ? `
      <div style="background:linear-gradient(135deg,rgba(180,83,9,0.12),rgba(245,158,11,0.08));border:1px solid rgba(245,158,11,0.25);border-radius:14px;padding:18px 22px;margin-bottom:26px;text-align:center">
        <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700">🎯 Deine persönliche Nokki-Nummer</p>
        <p style="margin:0 0 6px;color:#f59e0b;font-size:34px;font-weight:900;font-family:'Courier New',monospace;letter-spacing:4px">#${uin}</p>
        <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px">Andere Nutzer können dich mit dieser Nummer finden &amp; kontaktieren</p>
      </div>` : ''

    await transporter.sendMail({
      from:    `"Nokki" <${process.env.SMTP_USER}>`,
      to:      email,
      subject: 'Nokki – Willkommen! Bitte E-Mail bestätigen',
            html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Willkommen bei Nokki</title></head>
<body style="margin:0;padding:0;background:#08090f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:540px;margin:0 auto;padding:40px 20px">

  <!-- Header mit Gradient -->
  <div style="background:linear-gradient(135deg,#92400e 0%,#b45309 40%,#d97706 70%,#f59e0b 100%);border-radius:20px 20px 0 0;padding:36px 32px;text-align:center;position:relative;overflow:hidden">
    <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:rgba(255,255,255,0.05);border-radius:50%"></div>
    <div style="position:absolute;bottom:-20px;left:-20px;width:80px;height:80px;background:rgba(255,255,255,0.05);border-radius:50%"></div>
    <div style="font-size:52px;margin-bottom:10px;position:relative">💬</div>
    <h1 style="margin:0;color:white;font-size:30px;font-weight:900;letter-spacing:-0.03em;position:relative">Nokki</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:0.05em;position:relative">SICHER · SCHNELL · PERSÖNLICH</p>
  </div>

  <!-- Haupt-Content -->
  <div style="background:#0d0f18;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 20px 20px;padding:36px 32px">

    <!-- Persönliche Begrüßung -->
    <h2 style="margin:0 0 6px;color:#f9fafb;font-size:22px;font-weight:700">Hey ${username}! 👋</h2>
    <p style="margin:0 0 6px;color:#d97706;font-size:13px;font-weight:600">Herzlich willkommen in der Nokki-Community!</p>
    <p style="margin:0 0 28px;color:rgba(255,255,255,0.45);font-size:14px;line-height:1.7">
      Wir freuen uns riesig, dich dabei zu haben. Dein Konto wurde erfolgreich erstellt und wartet nur noch auf deine Bestätigung. Danach hast du Zugriff auf Direktnachrichten, Gruppen und weitere Funktionen.
    </p>

    <!-- UIN Box -->
    ${uinBlock}

    <!-- Was dich erwartet -->
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:18px 20px;margin-bottom:26px">
      <p style="margin:0 0 12px;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;font-weight:700">Was dich bei Nokki erwartet</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(255,255,255,0.65)"><span style="font-size:16px">🔒</span> TLS-geschützte Übertragung</div>
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(255,255,255,0.65)"><span style="font-size:16px">👥</span> Gruppen &amp; Direktnachrichten</div>
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(255,255,255,0.65)"><span style="font-size:16px">⏳</span> Zeitkapsel-Nachrichten</div>
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(255,255,255,0.65)"><span style="font-size:16px">🎵</span> Sprachnachrichten &amp; GIFs</div>
      </div>
    </div>

    <!-- Bestätigungs-Button -->
    <div style="text-align:center;margin-bottom:24px">
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#b45309,#f59e0b);color:white;padding:15px 40px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.02em;box-shadow:0 6px 24px rgba(245,158,11,0.35)">
        ✓ Jetzt E-Mail bestätigen →
      </a>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.25);font-size:11px">Klick auf den Button um loszulegen</p>
    </div>

    <!-- Fallback Link -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:12px 14px;margin-bottom:24px">
      <p style="margin:0 0 5px;color:rgba(255,255,255,0.25);font-size:11px">🔗 Link funktioniert nicht? Kopiere ihn manuell:</p>
      <p style="margin:0;word-break:break-all;font-family:'Courier New',monospace;font-size:11px;color:#d97706;line-height:1.5">${link}</p>
    </div>

    <!-- Hinweis -->
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:20px">
      <p style="color:rgba(255,255,255,0.25);font-size:12px;margin:0;line-height:1.7">
        ⏱ Dieser Link ist <strong style="color:rgba(255,255,255,0.4)">24 Stunden</strong> gültig.<br>
        Falls du dich nicht bei Nokki registriert hast, ignoriere diese E-Mail einfach — deine Adresse wird nicht ohne Bestätigung verwendet.
      </p>
    </div>

    <!-- Footer -->
    <div style="margin-top:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.15);font-size:11px;margin:0">
        Nokki Instant Messenger &nbsp;·&nbsp;
        <a href="https://lumestack.de" style="color:rgba(255,255,255,0.2);text-decoration:none">lumestack.de</a>
      </p>
    </div>

  </div>
</div>
</body></html>`,
    })
    console.log(`[Mailer] Verification email sent to ${email}`)
    return true
  } catch (err) {
    console.error('[Mailer] Verification send error:', err)
    return false
  }
}

// ── NEU: Passwort-Reset per E-Mail ────────────────────────────────────────────
export async function sendPasswordResetEmail(
  email: string, username: string, code: string
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') console.log(`[Mailer] SMTP nicht konfiguriert — Reset-Code für ${username}: ${code}`)
    return false
  }

  try {
    const transporter = createTransport()
    await transporter.sendMail({
      from:    `"Nokki" <${process.env.SMTP_USER}>`,
      to:      email,
      subject: 'Nokki – Passwort zurücksetzen',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d0d14;color:#f1f0f8;padding:32px;border-radius:16px">
          <h1 style="font-size:28px;margin:0 0 28px">💬 Nokki</h1>
          <h2 style="font-size:18px;margin:0 0 12px">Passwort zurücksetzen</h2>
          <p style="color:#c4c3d8;margin:0 0 16px">Hallo ${username}, dein Reset-Code lautet:</p>
          <div style="background:#1a1a2e;padding:20px;border-radius:12px;text-align:center;font-size:36px;font-weight:800;letter-spacing:10px;font-family:monospace;color:#4f6ef7;margin:0 0 20px">
            ${code}
          </div>
          <p style="color:#8b8aa8;font-size:12px;margin:0">
            Dieser Code ist 15 Minuten gültig.<br>
            Falls du kein Reset angefragt hast, ignoriere diese E-Mail.
          </p>
        </div>
      `,
    })
    return true
  } catch (err) {
    console.error('[Mailer] Password reset send error:', err)
    return false
  }
}

// ── Login-Alert: neues Gerät oder neue IP ────────────────────────────────────
export async function sendLoginAlert(data: {
  email:     string
  username:  string
  ip:        string
  device:    string
  os:        string
  browser:   string
  time:      Date
}): Promise<boolean> {
  if (!isSmtpConfigured()) return false

  try {
    const transporter = createTransport()
    await transporter.sendMail({
      from:    `"Nokki Security" <${process.env.SMTP_USER}>`,
      to:      data.email,
      subject: 'Nokki – Neuer Login erkannt',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d0d14;color:#f1f0f8;padding:32px;border-radius:16px">
          <h1 style="font-size:24px;margin:0 0 4px">💬 Nokki</h1>
          <p style="color:#8b8aa8;margin:0 0 24px;font-size:13px">Sicherheitsbenachrichtigung</p>
          <div style="background:#1a1a2e;border-radius:12px;padding:16px;margin-bottom:20px">
            <p style="color:#fde68a;font-weight:600;margin:0 0 12px">⚠️ Neuer Login in dein Konto</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr><td style="color:#8b8aa8;padding:5px 0">Nutzer</td><td style="padding:5px 0">${data.username}</td></tr>
              <tr><td style="color:#8b8aa8;padding:5px 0">IP-Adresse</td><td style="padding:5px 0;font-family:monospace">${data.ip}</td></tr>
              <tr><td style="color:#8b8aa8;padding:5px 0">Gerät</td><td style="padding:5px 0">${data.device} · ${data.os}</td></tr>
              <tr><td style="color:#8b8aa8;padding:5px 0">Browser</td><td style="padding:5px 0">${data.browser}</td></tr>
              <tr><td style="color:#8b8aa8;padding:5px 0">Zeit</td><td style="padding:5px 0">${data.time.toLocaleString('de-DE')}</td></tr>
            </table>
          </div>
          <p style="color:#8b8aa8;font-size:12px">Falls du das warst, kannst du diese E-Mail ignorieren.<br>
          Falls nicht, ändere sofort dein Passwort.</p>
        </div>
      `,
    })
    return true
  } catch (err) {
    console.error('[Mailer] Login alert error:', err)
    return false
  }
}

export async function sendDeveloperVerificationEmail(
  email: string, username: string, token: string
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') console.log(`[Mailer] Developer-Verify-Token für ${username}: ${token}`)
    return false
  }
  const appUrl = (process.env.APP_URL || 'https://lumestack.de').replace(/\/$/, '')
  const link = `${appUrl}/api/dev/auth/verify-email?token=${encodeURIComponent(token)}`
  try {
    await createTransport().sendMail({
      from: `"Nokki Developer" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Nokki Developer – E-Mail bestätigen',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0d0f18;color:#f1f0f8;padding:32px;border-radius:16px"><h1 style="color:#e8b86d">Nokki Developer</h1><p>Hallo ${username}, bestätige bitte deine E-Mail-Adresse.</p><p><a href="${link}" style="display:inline-block;background:#b46a0e;color:white;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">E-Mail bestätigen</a></p><p style="color:#8b8aa8;font-size:12px">Der Link ist 24 Stunden gültig. Falls du diesen Account nicht erstellt hast, ignoriere die Nachricht.</p></div>`,
    })
    return true
  } catch (error) {
    console.error('[Mailer] Developer verification error:', error)
    return false
  }
}

export async function sendDeveloperPasswordResetEmail(
  email: string, username: string, token: string
): Promise<boolean> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') console.log(`[Mailer] Developer-Reset-Token für ${username}: ${token}`)
    return false
  }
  const appUrl = (process.env.APP_URL || 'https://lumestack.de').replace(/\/$/, '')
  const link = `${appUrl}/dev-reset-password?token=${encodeURIComponent(token)}`
  try {
    await createTransport().sendMail({
      from: `"Nokki Developer" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Nokki Developer – Passwort zurücksetzen',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0d0f18;color:#f1f0f8;padding:32px;border-radius:16px"><h1 style="color:#e8b86d">Nokki Developer</h1><p>Hallo ${username}, über diesen Link kannst du dein Passwort zurücksetzen.</p><p><a href="${link}" style="display:inline-block;background:#b46a0e;color:white;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Neues Passwort festlegen</a></p><p style="color:#8b8aa8;font-size:12px">Der Link ist 30 Minuten gültig und kann nur einmal verwendet werden. Falls du ihn nicht angefordert hast, ignoriere die Nachricht.</p></div>`,
    })
    return true
  } catch (error) {
    console.error('[Mailer] Developer password reset error:', error)
    return false
  }
}
