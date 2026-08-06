import React, { useState } from 'react';

const DevWiki: React.FC = () => {
  const [activeSection, setActiveSection] = useState('quickstart');

  const sections = [
    { id: 'quickstart', title: '?? Quick Start', icon: '??' },
    { id: 'authentication', title: '?? Authentifizierung', icon: '??' },
    { id: 'bots', title: '?? Bots erstellen', icon: '??' },
    { id: 'installation', title: '?? Bot Installation', icon: '??' },
    { id: 'integration', title: '?? Bot Integration', icon: '??' },
    { id: 'development', title: '?? Bot Development', icon: '??' },
    { id: 'api', title: '?? API Reference', icon: '??' },
    { id: 'webhooks', title: '?? Webhooks', icon: '??' },
    { id: 'examples', title: '?? Code Examples', icon: '??' },
    { id: 'best-practices', title: '? Best Practices', icon: '?' },
    { id: 'troubleshooting', title: '?? Troubleshooting', icon: '??' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#08090f', color: '#f1f0f8' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px', background: '#0d0f18', borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: '24px 16px', overflowY: 'auto', maxHeight: '100vh'
      }}>
        <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #b46a0e, #e8b86d)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>??</div>
          <span>Nokki <span style={{ color: '#8b8aa8', fontWeight: 500 }}>Wiki</span></span>
        </div>

        <nav>
          <a href="/dev-dashboard" style={{
            display: 'block', padding: '10px 12px', borderRadius: '8px', marginBottom: '4px',
            color: '#8b8aa8', textDecoration: 'none', fontSize: '14px'
          }}>? Zurück zum Dashboard</a>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '16px 0' }}></div>

          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                display: 'block', width: '100%', padding: '10px 12px', borderRadius: '8px',
                marginBottom: '4px', background: activeSection === section.id ? 'rgba(232,184,109,0.1)' : 'transparent',
                color: activeSection === section.id ? '#e8b86d' : '#8b8aa8',
                border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeSection === section.id ? 600 : 400,
                textAlign: 'left', transition: 'all 0.2s'
              }}
            >
              {section.title}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', maxHeight: '100vh' }}>
        {activeSection === 'quickstart' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Quick Start Guide</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              In 5 Minuten deinen ersten Bot erstellen und API-Calls machen
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 1: Account erstellen</h2>
              <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Gehe zu <code style={{ background: 'rgba(232,184,109,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#e8b86d' }}>/dev-register</code></li>
                <li>Wähle Username, Email und Passwort</li>
                <li>Nach Registrierung erhältst du automatisch einen API Key</li>
              </ol>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 2: Ersten Bot erstellen</h2>
              <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Im Dashboard auf <strong>"+ Neuer Bot"</strong> klicken</li>
                <li>Bot-Name eingeben (z.B. "Welcome Bot")</li>
                <li>Optional: Beschreibung hinzufügen</li>
                <li>Auf <strong>"Bot erstellen"</strong> klicken</li>
              </ol>
              <p style={{ marginTop: '12px', fontSize: '14px', color: '#8b8aa8' }}>
                ? Dein Bot erhält automatisch Permissions: READ_MESSAGES, SEND_MESSAGES
              </p>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 3: API Key kopieren</h2>
              <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Im Dashboard unter "API Key" auf <strong>"Show"</strong> klicken</li>
                <li>Auf <strong>"Copy"</strong> klicken</li>
                <li>Key sicher speichern (z.B. .env Datei)</li>
              </ol>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 4: Ersten API Call machen</h2>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', overflowX: 'auto', fontSize: '13px',
                fontFamily: 'monospace', color: '#86efac'
              }}>
{`curl -X POST https://api.nokki.dev/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel_id": "ch_abc123",
    "text": "Hello World!"
  }'`}
              </pre>
            </div>
          </div>
        )}

        {activeSection === 'authentication' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Authentifizierung</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              Wie du dich bei der Nokki API authentifizierst
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>API Key Format</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Alle API Keys beginnen mit <code style={{ background: 'rgba(232,184,109,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#e8b86d' }}>sk_live_</code>
              </p>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', fontSize: '13px', fontFamily: 'monospace', color: '#e8b86d'
              }}>
                sk_live_abc123def456ghi789...
              </pre>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Header verwenden</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Füge den API Key als Bearer Token im Authorization Header ein:
              </p>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', fontSize: '13px', fontFamily: 'monospace', color: '#86efac'
              }}>
                Authorization: Bearer sk_live_YOUR_KEY_HERE
              </pre>
            </div>

            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#ef4444' }}>?? Wichtig: Sicherheit</h3>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8', fontSize: '14px' }}>
                <li>Teile deinen API Key niemals öffentlich</li>
                <li>Committe Keys nicht in Git Repositories</li>
                <li>Verwende Umgebungsvariablen (.env)</li>
                <li>Generiere neue Keys wenn kompromittiert</li>
              </ul>
            </div>
          </div>
        )}

        {activeSection === 'bots' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Bots erstellen & verwalten</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              Alles über Bot-Erstellung, Permissions und Management
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Bot erstellen</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '16px' }}>
                Dashboard ? "+ Neuer Bot" ? Name & Beschreibung eingeben
              </p>
              <p style={{ color: '#8b8aa8', fontSize: '14px' }}>
                Nach Erstellung erhält der Bot automatisch:
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px', color: '#8b8aa8', lineHeight: '1.8' }}>
                <li>Eindeutige Bot ID (z.B. <code style={{ background: 'rgba(232,184,109,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#e8b86d' }}>bot_7k05hpn21i8</code>)</li>
                <li>Status: Active</li>
                <li>Basis-Permissions: READ_MESSAGES, SEND_MESSAGES</li>
              </ul>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Permissions</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                {[
                  { perm: 'READ_MESSAGES', desc: 'Bot kann Nachrichten lesen' },
                  { perm: 'SEND_MESSAGES', desc: 'Bot kann Nachrichten senden' },
                  { perm: 'MANAGE_CHANNELS', desc: 'Bot kann Channels erstellen/löschen' },
                  { perm: 'DELETE_MESSAGES', desc: 'Bot kann Nachrichten löschen' },
                  { perm: 'MANAGE_USERS', desc: 'Bot kann User kicken/bannen' },
                ].map(({ perm, desc }) => (
                  <div key={perm} style={{
                    background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: '8px', padding: '12px'
                  }}>
                    <code style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa' }}>{perm}</code>
                    <p style={{ fontSize: '13px', color: '#8b8aa8', marginTop: '4px' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Bot bearbeiten</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Meine Bots ? Bot auswählen ? "Bearbeiten" klicken
              </p>
              <p style={{ color: '#8b8aa8', fontSize: '14px' }}>
                Du kannst ändern:
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px', color: '#8b8aa8', lineHeight: '1.8' }}>
                <li>Name & Beschreibung</li>
                <li>Permissions (Checkboxen)</li>
                <li>Status (Aktiv/Inaktiv)</li>
              </ul>
            </div>
          </div>
        )}

        {activeSection === 'installation' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Bot mit Messenger verbinden</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              So installierst du deinen Bot in Nokki Channels
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 1: Bot aktivieren</h2>
              <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Gehe zu <strong>Meine Bots</strong></li>
                <li>Wähle deinen Bot aus</li>
                <li>Stelle sicher dass Status = <span style={{ color: '#22c55e', fontWeight: 600 }}>? Aktiv</span></li>
                <li>Falls inaktiv: Klicke auf <strong>"Aktivieren"</strong></li>
              </ol>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 2: Installation Link generieren</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Dein Bot kann über einen speziellen Link installiert werden:
              </p>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', fontSize: '13px', fontFamily: 'monospace', color: '#e8b86d'
              }}>
{`https://lumestack.de/install-bot?bot_id=DEINE_BOT_ID`}
              </pre>
              <p style={{ color: '#8b8aa8', marginTop: '12px', fontSize: '14px' }}>
                Ersetze <code style={{ background: 'rgba(232,184,109,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#e8b86d' }}>DEINE_BOT_ID</code> mit deiner echten Bot ID
              </p>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 3: Bot zu Channel hinzufügen</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '16px' }}>
                Es gibt 2 Wege deinen Bot zu installieren:
              </p>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e8b86d', marginBottom: '8px' }}>
                  A) Über Installation Link (Empfohlen)
                </h3>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8', fontSize: '14px' }}>
                  <li>Teile den Installation Link mit Usern</li>
                  <li>User klickt auf Link</li>
                  <li>User wählt Channel aus</li>
                  <li>Klickt auf <strong>"Bot installieren"</strong></li>
                  <li>Bot erscheint in Channel Mitgliederliste</li>
                </ol>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e8b86d', marginBottom: '8px' }}>
                  B) Manuell über Chat-Einstellungen
                </h3>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8', fontSize: '14px' }}>
                  <li>Öffne den Channel im Chat</li>
                  <li>Klicke auf Channel-Einstellungen (??)</li>
                  <li>Gehe zu <strong>"Bots & Integrationen"</strong></li>
                  <li>Klicke <strong>"+ Bot hinzufügen"</strong></li>
                  <li>Suche nach deinem Bot (Name oder Bot ID)</li>
                  <li>Klicke <strong>"Installieren"</strong></li>
                </ol>
              </div>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 4: Bot testen</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Sende eine Test-Nachricht an den Channel:
              </p>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', fontSize: '13px', fontFamily: 'monospace', color: '#86efac'
              }}>
{`curl -X POST https://api.nokki.dev/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel_id": "CHANNEL_ID_HIER",
    "text": "?? Bot ist online!"
  }'`}
              </pre>
              <p style={{ color: '#8b8aa8', marginTop: '12px', fontSize: '14px' }}>
                ? Wenn die Nachricht im Channel erscheint, ist dein Bot erfolgreich verbunden!
              </p>
            </div>
          </div>
        )}

        {activeSection === 'integration' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Eigene Bots einbinden</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              So integrierst du selbst entwickelte Bots mit Nokki
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Architektur Übersicht</h2>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '20px', fontSize: '12px', fontFamily: 'monospace', color: '#8b8aa8', lineHeight: '1.8'
              }}>
{`+-----------------+
¦  Nokki Chat     ¦  (User sendet Nachricht)
+-----------------+
         ¦
         ?
+-----------------+
¦  Nokki API      ¦  (Empfängt Event)
+-----------------+
         ¦
         ? Webhook
+-----------------+
¦  Dein Bot       ¦  (Verarbeitet Event)
¦  (Server)       ¦
+-----------------+
         ¦
         ? API Call
+-----------------+
¦  Nokki API      ¦  (Bot sendet Antwort)
+-----------------+
         ¦
         ?
+-----------------+
¦  Nokki Chat     ¦  (User sieht Antwort)
+-----------------+`}
              </pre>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 1: Bot im Developer Portal erstellen</h2>
              <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Gehe zu <strong>Dashboard</strong></li>
                <li>Klicke <strong>"+ Neuer Bot"</strong></li>
                <li>Gib Name und Beschreibung ein</li>
                <li>Notiere dir die <strong>Bot ID</strong> und <strong>API Key</strong></li>
              </ol>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 2: Webhook Server aufsetzen</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Dein Bot braucht einen Server der Webhooks empfangen kann:
              </p>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', overflowX: 'auto', fontSize: '12px',
                fontFamily: 'monospace', color: '#86efac', marginBottom: '16px'
              }}>
{`// server.js (Node.js + Express)
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const NOKKI_API_KEY = process.env.NOKKI_API_KEY;
const NOKKI_API = 'https://api.nokki.dev/v1';

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  const { event, bot_id, data } = req.body;

  console.log(\`?? Event: \${event}\`);

  // Nachricht empfangen
  if (event === 'message.create') {
    const { message_id, channel_id, text, sender_id } = data;

    // Bot antwortet nur auf @mentions oder Commands
    if (text.includes('@bot') || text.startsWith('/')) {
      await sendMessage(channel_id, \`Du hast gesagt: \${text}\`);
    }
  }

  res.status(200).send('OK');
});

// Funktion zum Senden
async function sendMessage(channelId, text) {
  try {
    await axios.post(\`\${NOKKI_API}/messages\`, {
      channel_id: channelId,
      text: text,
    }, {
      headers: {
        'Authorization': \`Bearer \${NOKKI_API_KEY}\`,
        'Content-Type': 'application/json',
      }
    });
    console.log('? Nachricht gesendet!');
  } catch (error) {
    console.error('? Fehler:', error.response?.data);
  }
}

app.listen(3000, () => {
  console.log('?? Bot Server läuft auf Port 3000');
});`}
              </pre>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 3: Webhook registrieren</h2>
              <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Gehe zu <strong>Webhooks</strong></li>
                <li>Klicke <strong>"+ Neuer Webhook"</strong></li>
                <li>URL eingeben: <code style={{ background: 'rgba(232,184,109,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#e8b86d' }}>https://your-server.com/webhook</code></li>
                <li>Events auswählen: <strong>message.create</strong></li>
                <li>Webhook speichern</li>
              </ol>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Schritt 4: Bot deployen</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Deploy-Optionen für deinen Bot-Server:
              </p>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8', fontSize: '14px' }}>
                <li><strong>Railway.app</strong> - Einfach & kostenlos</li>
                <li><strong>Heroku</strong> - Klassisch & bewährt</li>
                <li><strong>DigitalOcean</strong> - Mehr Kontrolle</li>
                <li><strong>AWS Lambda</strong> - Serverless</li>
                <li><strong>Eigener VPS</strong> - Volle Kontrolle</li>
              </ul>
              <p style={{ color: '#8b8aa8', marginTop: '16px', fontSize: '14px' }}>
                ?? Wichtig: Dein Server muss <strong>HTTPS</strong> unterstützen!
              </p>
            </div>
          </div>
        )}

        {activeSection === 'development' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Bot Development</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              Lokale Entwicklung, Testing und Debugging
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Lokale Entwicklung Setup</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Für lokales Testing brauchst du einen Tunnel (ngrok, localtunnel):
              </p>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', fontSize: '13px', fontFamily: 'monospace', color: '#86efac'
              }}>
{`# 1. Installiere ngrok
npm install -g ngrok

# 2. Starte deinen Bot
node server.js

# 3. Starte ngrok (anderes Terminal)
ngrok http 3000

# 4. Kopiere die HTTPS URL
# z.B. https://abc123.ngrok.io

# 5. Registriere als Webhook
# https://abc123.ngrok.io/webhook`}
              </pre>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Bot Testing Checkliste</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  '? API Key funktioniert (401 Error?)',
                  '? Bot in Channel installiert',
                  '? Bot Status = Active',
                  '? Webhook erreichbar (HTTPS!)',
                  '? Permissions korrekt gesetzt',
                  '? Webhook Events ausgewählt',
                  '? Server antwortet mit 200 OK',
                  '? Logs zeigen eingehende Events',
                ].map((item, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: '8px', padding: '12px', color: '#8b8aa8', fontSize: '14px'
                  }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Debugging Tipps</h2>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li><strong>Webhooks nicht empfangen?</strong>
                  <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                    <li>Prüfe ob ngrok läuft</li>
                    <li>Firewall/Ports checken</li>
                    <li>Webhook URL korrekt registriert?</li>
                  </ul>
                </li>
                <li><strong>API Calls schlagen fehl?</strong>
                  <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                    <li>API Key korrekt?</li>
                    <li>Rate Limit erreicht? (60/min)</li>
                    <li>Channel ID existiert?</li>
                  </ul>
                </li>
                <li><strong>Bot antwortet nicht?</strong>
                  <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                    <li>Console Logs checken</li>
                    <li>Event-Handler korrekt?</li>
                    <li>Try/Catch um alle API Calls?</li>
                  </ul>
                </li>
              </ul>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Produktions-Deployment</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Bevor du live gehst:
              </p>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8', fontSize: '14px' }}>
                <li>? Umgebungsvariablen (.env) konfiguriert</li>
                <li>? HTTPS aktiviert (Let's Encrypt)</li>
                <li>? Error Logging eingerichtet</li>
                <li>? Rate Limiting implementiert</li>
                <li>? Health Check Endpoint (/health)</li>
                <li>? Auto-Restart bei Crash (PM2, systemd)</li>
                <li>? Monitoring setup (Sentry, New Relic)</li>
              </ul>
            </div>
          </div>
        )}

        {activeSection === 'api' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? API Reference</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              Komplette API Dokumentation mit Endpoints
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Base URL</h2>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', fontSize: '14px', fontFamily: 'monospace', color: '#e8b86d'
              }}>
                https://api.nokki.dev/v1
              </pre>
            </div>

            {/* Messages Endpoint */}
            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)'
                }}>POST</span>
                <code style={{ fontSize: '16px', color: '#e8b86d' }}>/messages</code>
              </div>
              <p style={{ color: '#8b8aa8', marginBottom: '16px' }}>Nachricht senden</p>

              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Request Body:</h3>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', overflowX: 'auto', fontSize: '12px',
                fontFamily: 'monospace', color: '#86efac', marginBottom: '16px'
              }}>
{`{
  "channel_id": "ch_abc123",
  "text": "Hello World!",
  "attachments": [] // optional
}`}
              </pre>

              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Response:</h3>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', overflowX: 'auto', fontSize: '12px',
                fontFamily: 'monospace', color: '#86efac'
              }}>
{`{
  "message_id": "msg_xyz789",
  "channel_id": "ch_abc123",
  "text": "Hello World!",
  "created_at": "2026-05-06T12:00:00Z"
}`}
              </pre>
            </div>

            {/* Channels Endpoint */}
            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)'
                }}>GET</span>
                <code style={{ fontSize: '16px', color: '#e8b86d' }}>/channels/:id/messages</code>
              </div>
              <p style={{ color: '#8b8aa8', marginBottom: '16px' }}>Channel-Nachrichten abrufen</p>

              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Query Parameters:</h3>
              <ul style={{ paddingLeft: '20px', color: '#8b8aa8', lineHeight: '1.8', fontSize: '14px' }}>
                <li><code>limit</code> - Max. Anzahl (default: 50, max: 100)</li>
                <li><code>before</code> - Message ID für Pagination</li>
                <li><code>after</code> - Message ID für Pagination</li>
              </ul>
            </div>

            {/* Rate Limits */}
            <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#fde047' }}>? Rate Limits</h3>
              <ul style={{ paddingLeft: '20px', color: '#8b8aa8', lineHeight: '1.8', fontSize: '14px' }}>
                <li>60 Requests pro Minute</li>
                <li>3,600 Requests pro Stunde</li>
                <li>100,000 Requests pro Tag</li>
                <li>HTTP 429 bei Überschreitung</li>
              </ul>
            </div>
          </div>
        )}

        {activeSection === 'webhooks' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Webhooks einrichten</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              Erhalte Echtzeit-Benachrichtigungen für Bot-Events
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Webhook erstellen</h2>
              <ol style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Gehe zu Webhooks ? "+ Neuer Webhook"</li>
                <li>Webhook URL eingeben (z.B. <code style={{ background: 'rgba(232,184,109,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#e8b86d' }}>https://your-server.com/webhook</code>)</li>
                <li>Events auswählen (message.sent, bot.installed, etc.)</li>
                <li>Auf "Webhook erstellen" klicken</li>
              </ol>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Verfügbare Events</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  { event: 'message.sent', desc: 'Bot hat Nachricht gesendet' },
                  { event: 'message.create', desc: 'Bot hat Nachricht empfangen' },
                  { event: 'bot.installed', desc: 'Bot wurde installiert' },
                  { event: 'bot.uninstalled', desc: 'Bot wurde deinstalliert' },
                  { event: 'error.occurred', desc: 'Fehler ist aufgetreten' },
                ].map(({ event, desc }) => (
                  <div key={event} style={{
                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: '8px', padding: '12px'
                  }}>
                    <code style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>{event}</code>
                    <p style={{ fontSize: '13px', color: '#8b8aa8', marginTop: '4px' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Webhook Payload</h2>
              <p style={{ color: '#8b8aa8', marginBottom: '12px' }}>
                Nokki sendet POST Requests an deine URL:
              </p>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', overflowX: 'auto', fontSize: '12px',
                fontFamily: 'monospace', color: '#86efac'
              }}>
{`{
  "event": "message.sent",
  "bot_id": "bot_abc123",
  "data": {
    "message_id": "msg_xyz789",
    "channel_id": "ch_abc123",
    "text": "Hello World!",
    "sent_at": "2026-05-06T12:00:00Z"
  },
  "timestamp": 1683384000
}`}
              </pre>
            </div>
          </div>
        )}

        {activeSection === 'examples' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Code Examples</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              Praktische Code-Beispiele zum Loslegen
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>JavaScript/TypeScript</h2>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', overflowX: 'auto', fontSize: '12px',
                fontFamily: 'monospace', color: '#86efac'
              }}>
{`const NOKKI_API_KEY = process.env.NOKKI_API_KEY;

async function sendMessage(channelId: string, text: string) {
  const response = await fetch('https://api.nokki.dev/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${NOKKI_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel_id: channelId,
      text: text,
    }),
  });

  return await response.json();
}

// Verwendung
await sendMessage('ch_abc123', 'Hello from Bot!');`}
              </pre>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Python</h2>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', overflowX: 'auto', fontSize: '12px',
                fontFamily: 'monospace', color: '#86efac'
              }}>
{`import os
import requests

NOKKI_API_KEY = os.getenv('NOKKI_API_KEY')

def send_message(channel_id: str, text: str):
    response = requests.post(
        'https://api.nokki.dev/v1/messages',
        headers={
            'Authorization': f'Bearer {NOKKI_API_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'channel_id': channel_id,
            'text': text,
        }
    )
    return response.json()

# Verwendung
send_message('ch_abc123', 'Hello from Bot!')`}
              </pre>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Webhook Server (Node.js/Express)</h2>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '16px', overflowX: 'auto', fontSize: '12px',
                fontFamily: 'monospace', color: '#86efac'
              }}>
{`const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  const { event, bot_id, data } = req.body;

  console.log(\`Received: \${event} from \${bot_id}\`);

  // Event verarbeiten
  if (event === 'message.create') {
    console.log('New message:', data.text);
  }

  res.status(200).send('OK');
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});`}
              </pre>
            </div>
          </div>
        )}

        {activeSection === 'best-practices' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>? Best Practices</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              Tipps für sichere und performante Bots
            </p>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>?? Sicherheit</h2>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>API Keys in Umgebungsvariablen speichern (.env)</li>
                <li>Niemals Keys in Code committen</li>
                <li>Keys regelmäßig rotieren</li>
                <li>Nur minimale Permissions vergeben</li>
                <li>HTTPS für Webhooks verwenden</li>
              </ul>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>? Performance</h2>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Rate Limits beachten (60 req/min)</li>
                <li>Requests batchen wenn möglich</li>
                <li>Exponential Backoff bei Fehlern</li>
                <li>Timeouts setzen (max. 30s)</li>
                <li>Webhooks für Echtzeit-Events nutzen statt Polling</li>
              </ul>
            </div>

            <div style={{ background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>?? Error Handling</h2>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                <li>Alle API-Calls in try/catch wrappen</li>
                <li>HTTP Status Codes prüfen</li>
                <li>429 (Rate Limit) ? 60 Sekunden warten</li>
                <li>401 (Unauthorized) ? API Key prüfen</li>
                <li>500 (Server Error) ? Retry mit Backoff</li>
              </ul>
            </div>
          </div>
        )}

        {activeSection === 'troubleshooting' && (
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '16px' }}>?? Troubleshooting</h1>
            <p style={{ color: '#8b8aa8', marginBottom: '32px', fontSize: '16px' }}>
              Häufige Probleme und Lösungen
            </p>

            {[
              {
                problem: '401 Unauthorized',
                solutions: [
                  'API Key prüfen (richtig kopiert?)',
                  'Authorization Header korrekt? ("Bearer sk_live_...")',
                  'API Key regenerieren wenn kompromittiert',
                ]
              },
              {
                problem: '429 Too Many Requests',
                solutions: [
                  '60 Sekunden warten',
                  'Rate Limits beachten (60 req/min)',
                  'Requests batchen',
                  'Exponential Backoff implementieren',
                ]
              },
              {
                problem: 'Webhook funktioniert nicht',
                solutions: [
                  'URL erreichbar? (HTTPS!)',
                  'Server antwortet mit 200 OK?',
                  'Firewall/Ports prüfen',
                  'Webhook in Dashboard aktiviert?',
                ]
              },
              {
                problem: 'Bot erhält keine Nachrichten',
                solutions: [
                  'Permission READ_MESSAGES vorhanden?',
                  'Bot im Channel installiert?',
                  'Bot Status = Active?',
                ]
              },
            ].map((item, idx) => (
              <div key={idx} style={{
                background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px', padding: '24px', marginBottom: '20px'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#ef4444' }}>
                  ? {item.problem}
                </h3>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#8b8aa8', marginBottom: '8px' }}>Lösungen:</p>
                <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#8b8aa8' }}>
                  {item.solutions.map((sol, i) => (
                    <li key={i}>{sol}</li>
                  ))}
                </ul>
              </div>
            ))}

            <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '12px', padding: '20px', marginTop: '32px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#3b82f6' }}>?? Support kontaktieren</h3>
              <p style={{ color: '#8b8aa8', fontSize: '14px' }}>
                Problem nicht gelöst? Kontaktiere uns:<br />
                Email: <a href="mailto:dev@nokki.com" style={{ color: '#3b82f6' }}>dev@nokki.com</a><br />
                Discord: <a href="https://discord.gg/nokki" style={{ color: '#3b82f6' }}>discord.gg/nokki</a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevWiki;