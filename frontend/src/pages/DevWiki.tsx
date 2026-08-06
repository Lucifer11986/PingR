import React, { useState, useMemo } from 'react';

// ── Styles ────────────────────────────────────────────────────────────────────
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px', padding: '24px', marginBottom: '20px', ...extra
})
const code = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: 'rgba(232,184,109,0.15)', padding: '2px 7px',
  borderRadius: '4px', color: '#e8b86d', fontFamily: 'monospace', fontSize: '13px', ...extra
})
const pre: React.CSSProperties = {
  background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '10px', padding: '18px', overflowX: 'auto',
  fontSize: '12.5px', fontFamily: 'monospace', color: '#86efac', lineHeight: 1.7,
  margin: '12px 0'
}
const warn: React.CSSProperties = {
  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
  borderRadius: '10px', padding: '16px', marginBottom: '16px', color: '#fca5a5', fontSize: '13.5px'
}
const tip: React.CSSProperties = {
  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
  borderRadius: '10px', padding: '16px', marginBottom: '16px', color: '#86efac', fontSize: '13.5px'
}
const info: React.CSSProperties = {
  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
  borderRadius: '10px', padding: '16px', marginBottom: '16px', color: '#93c5fd', fontSize: '13.5px'
}
const h1s: React.CSSProperties = { fontSize: '34px', fontWeight: 900, marginBottom: '10px' }
const h2s: React.CSSProperties = { fontSize: '20px', fontWeight: 700, marginBottom: '14px' }
const h3s: React.CSSProperties = { fontSize: '16px', fontWeight: 700, marginBottom: '10px', color: '#e8b86d' }
const p: React.CSSProperties = { color: '#8b8aa8', lineHeight: 1.7, marginBottom: '12px', fontSize: '14px' }
const ul: React.CSSProperties = { paddingLeft: '20px', lineHeight: 2, color: '#8b8aa8', fontSize: '14px' }
const ol: React.CSSProperties = { paddingLeft: '20px', lineHeight: 2, color: '#8b8aa8', fontSize: '14px' }

// ── Badge ─────────────────────────────────────────────────────────────────────
const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{
    display: 'inline-block', padding: '2px 10px', borderRadius: '99px',
    fontSize: '11px', fontWeight: 700, marginRight: '6px',
    background: `${color}20`, color, border: `1px solid ${color}40`
  }}>{label}</span>
)

// ── Section content ───────────────────────────────────────────────────────────
const SECTIONS: Record<string, React.ReactNode> = {

  quickstart: (
    <div>
      <h1 style={h1s}>🚀 Quick Start Guide</h1>
      <p style={{ ...p, fontSize: '16px' }}>In 5 Minuten deinen ersten Bot erstellen und API-Calls machen.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { step: '1', title: 'Account erstellen', icon: '📝', color: '#3b82f6' },
          { step: '2', title: 'Bot erstellen', icon: '🤖', color: '#8b5cf6' },
          { step: '3', title: 'API Key kopieren', icon: '🔑', color: '#f59e0b' },
          { step: '4', title: 'Bot installieren', icon: '🔌', color: '#22c55e' },
          { step: '5', title: 'API Call machen', icon: '📡', color: '#06b6d4' },
        ].map(s => (
          <div key={s.step} style={{ background: '#0d0f18', border: `1px solid ${s.color}30`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{s.icon}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: s.color, marginBottom: '4px' }}>SCHRITT {s.step}</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.title}</div>
          </div>
        ))}
      </div>

      {[
        {
          title: 'Schritt 1: Developer Account erstellen',
          content: (
            <>
              <ol style={ol}>
                <li>Gehe zu <code style={code()}>/dev-register</code></li>
                <li>Wähle Username, E-Mail und Passwort</li>
                <li>Nach Registrierung wird dein API Key genau einmal vollständig angezeigt</li>
              </ol>
              <div style={tip}>✅ Tipp: Notiere dir deine Zugangsdaten sicher — du brauchst sie später oft.</div>
            </>
          )
        },
        {
          title: 'Schritt 2: Ersten Bot erstellen',
          content: (
            <>
              <ol style={ol}>
                <li>Im Dashboard auf <strong>„+ Neuer Bot"</strong> klicken</li>
                <li>Bot-Name und Beschreibung eingeben</li>
                <li>Auf <strong>„Bot erstellen"</strong> klicken</li>
              </ol>
              <p style={p}>✅ Dein Bot erhält automatisch: <code style={code()}>READ_MESSAGES</code> und <code style={code()}>SEND_MESSAGES</code></p>
            </>
          )
        },
        {
          title: 'Schritt 3: API Key kopieren',
          content: (
            <>
              <ol style={ol}>
                <li>Den bei Registrierung oder Rotation angezeigten Key sofort kopieren</li>
                <li>Später zeigt das Portal nur noch das Präfix des Keys</li>
                <li>Key sicher in einer <code style={code()}>.env</code> Datei speichern</li>
              </ol>
              <div style={warn}>⚠️ Teile deinen API Key niemals öffentlich! Nie in Git committen.</div>
            </>
          )
        },
        {
          title: 'Schritt 4: Bot in Channel installieren',
          content: (
            <>
              <p style={p}>Teile diesen Link mit dem Channel-Admin:</p>
              <pre style={pre}>{`https://lumestack.de/install-bot?bot_id=DEINE_BOT_ID`}</pre>
              <p style={p}>Oder manuell: Chat → Channel-Einstellungen → Bots & Integrationen → Bot hinzufügen</p>
            </>
          )
        },
        {
          title: 'Schritt 5: Ersten API Call machen',
          content: (
            <>
              <pre style={pre}>{`curl -X POST https://api.nokki.dev/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel_id": "CHANNEL_ID",
    "text": "🤖 Hallo von meinem ersten Bot!"
  }'`}</pre>
              <div style={tip}>✅ Wenn die Nachricht erscheint, ist alles richtig eingerichtet!</div>
            </>
          )
        },
      ].map((item, i) => (
        <div key={i} style={card()}>
          <h2 style={h2s}>{item.title}</h2>
          {item.content}
        </div>
      ))}
    </div>
  ),

  authentication: (
    <div>
      <h1 style={h1s}>🔐 Authentifizierung</h1>
      <p style={{ ...p, fontSize: '16px' }}>Wie du dich bei der Nokki API authentifizierst.</p>

      <div style={card()}>
        <h2 style={h2s}>API Key Format</h2>
        <p style={p}>Alle API Keys beginnen mit <code style={code()}>sk_live_</code></p>
        <pre style={pre}>sk_live_&lt;einmaliger-schlüssel&gt;</pre>
        <p style={p}>API Keys haben keine Ablaufzeit — du kannst sie jederzeit im Dashboard regenerieren.</p>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Authorization Header</h2>
        <p style={p}>Füge den API Key als Bearer Token in jeden Request ein:</p>
        <pre style={pre}>{`Authorization: Bearer sk_live_YOUR_KEY_HERE`}</pre>
        <p style={p}>Beispiel mit curl:</p>
        <pre style={pre}>{`curl -H "Authorization: Bearer sk_live_abc123" \\
     https://api.nokki.dev/v1/bots/me`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Fehler-Codes</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {[
            { code: '401', label: 'Unauthorized', desc: 'API Key fehlt oder ungültig', color: '#ef4444' },
            { code: '403', label: 'Forbidden', desc: 'Keine Berechtigung für diese Aktion', color: '#f59e0b' },
            { code: '429', label: 'Too Many Requests', desc: 'Rate Limit überschritten — 60s warten', color: '#f59e0b' },
            { code: '500', label: 'Server Error', desc: 'Interner Fehler — später nochmal versuchen', color: '#6b7280' },
          ].map(e => (
            <div key={e.code} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '15px', color: e.color, minWidth: '36px' }}>{e.code}</span>
              <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '140px' }}>{e.label}</span>
              <span style={{ color: '#8b8aa8', fontSize: '13px' }}>{e.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={warn}>⚠️ Sicherheitsregeln: Keys nie in Git committen · Nur in .env Dateien speichern · Regelmäßig rotieren · Minimal-Permissions vergeben</div>
    </div>
  ),

  bots: (
    <div>
      <h1 style={h1s}>🤖 Bots erstellen & verwalten</h1>
      <p style={{ ...p, fontSize: '16px' }}>Alles über Bot-Erstellung, Permissions und Management.</p>

      <div style={card()}>
        <h2 style={h2s}>Bot erstellen</h2>
        <ol style={ol}>
          <li>Dashboard → <strong>„+ Neuer Bot"</strong> klicken</li>
          <li>Name eingeben (z.B. „Welcome Bot")</li>
          <li>Beschreibung hinzufügen (optional)</li>
          <li>Bot erstellen</li>
        </ol>
        <p style={{ ...p, marginTop: '12px' }}>Dein Bot bekommt automatisch:</p>
        <ul style={ul}>
          <li>Eindeutige Bot ID (z.B. <code style={code()}>bot_7k05hpn21i8</code>)</li>
          <li>Status: Aktiv</li>
          <li>Basis-Permissions: READ_MESSAGES, SEND_MESSAGES</li>
        </ul>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Permissions</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {[
            { perm: 'READ_MESSAGES', desc: 'Nachrichten lesen', bit: 1 },
            { perm: 'SEND_MESSAGES', desc: 'Nachrichten senden', bit: 2 },
            { perm: 'DELETE_MESSAGES', desc: 'Nachrichten löschen', bit: 4 },
            { perm: 'MANAGE_MEMBERS', desc: 'User kicken / bannen / muten', bit: 8 },
            { perm: 'MANAGE_MESSAGES', desc: 'Massen-Löschung (purge)', bit: 16 },
            { perm: 'ADMINISTRATOR', desc: 'Alle Rechte (Vorsicht!)', bit: 32 },
          ].map(({ perm, desc, bit }) => (
            <div key={perm} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px', padding: '12px' }}>
              <code style={{ ...code(), minWidth: '180px' }}>{perm}</code>
              <span style={{ color: '#8b8aa8', fontSize: '13px', flex: 1 }}>{desc}</span>
              <span style={{ color: '#6b7280', fontSize: '11px', fontFamily: 'monospace' }}>bit {bit}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Bot bearbeiten & löschen</h2>
        <p style={p}><strong>Bearbeiten:</strong> Meine Bots → Bot auswählen → „Bearbeiten" → Name, Beschreibung oder Permissions ändern → Speichern</p>
        <p style={p}><strong>Deaktivieren:</strong> Bot temporär pausieren ohne ihn zu löschen. Alle Installationen bleiben erhalten.</p>
        <p style={p}><strong>Löschen:</strong> Entfernt Bot und alle Installationen dauerhaft. Nicht rückgängig zu machen!</p>
        <div style={warn}>⚠️ Nach dem Löschen werden alle aktiven Installationen sofort deaktiviert.</div>
      </div>
    </div>
  ),

  installation: (
    <div>
      <h1 style={h1s}>🔌 Bot Installation</h1>
      <p style={{ ...p, fontSize: '16px' }}>So verbindest du deinen Bot mit Nokki-Gruppen.</p>

      <div style={card()}>
        <h2 style={h2s}>Installation Link</h2>
        <p style={p}>Jeder Bot hat einen einzigartigen Installations-Link:</p>
        <pre style={pre}>{`https://lumestack.de/install-bot?bot_id=DEINE_BOT_ID`}</pre>
        <p style={p}>Teile diesen Link mit Gruppen-Admins. Sie können dann den Bot in ihre Gruppen installieren.</p>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Installation via Link (empfohlen)</h2>
        <ol style={ol}>
          <li>Installations-Link teilen</li>
          <li>User öffnet Link → wird zum Install-Modal weitergeleitet</li>
          <li>User wählt die Gruppe aus</li>
          <li>Klickt <strong>„Bot installieren"</strong></li>
          <li>Bot erscheint in der Gruppe und kann Commands empfangen</li>
        </ol>
        <div style={tip}>✅ Der User muss Admin/Owner der Gruppe sein um einen Bot hinzuzufügen.</div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Installationen verwalten</h2>
        <p style={p}>Unter <strong>Meine Bots → Bot auswählen → Installationen</strong> siehst du:</p>
        <ul style={ul}>
          <li>Welche Gruppen den Bot installiert haben</li>
          <li>Installationsdatum</li>
          <li>Status (aktiv/inaktiv)</li>
          <li>Möglichkeit zur Deinstallation</li>
        </ul>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Bot testen</h2>
        <pre style={pre}>{`curl -X POST https://api.nokki.dev/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel_id": "CHANNEL_ID",
    "text": "🤖 Bot Test erfolgreich!"
  }'`}</pre>
        <div style={tip}>✅ Wenn die Nachricht in der Gruppe erscheint ist alles korrekt eingerichtet!</div>
      </div>
    </div>
  ),

  integration: (
    <div>
      <h1 style={h1s}>⚙️ Bot Integration</h1>
      <p style={{ ...p, fontSize: '16px' }}>So bindest du selbst entwickelte Bots in Nokki ein.</p>

      <div style={card()}>
        <h2 style={h2s}>Architektur Übersicht</h2>
        <pre style={{ ...pre, color: '#8b8aa8' }}>{`┌─────────────────┐    Nachricht senden
│   Nokki Chat    │ ─────────────────────────►
└─────────────────┘                          │
                                             ▼
                                   ┌─────────────────┐
                                   │   Nokki API     │
                                   └────────┬────────┘
                                            │ Webhook Event
                                            ▼
                                   ┌─────────────────┐
                                   │   Dein Bot      │
                                   │   (Server)      │
                                   └────────┬────────┘
                                            │ API Call
                                            ▼
┌─────────────────┐    Antwort kommt an
│   Nokki Chat    │ ◄─────────────────────────
└─────────────────┘`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Minimaler Bot (Node.js)</h2>
        <pre style={pre}>{`// bot.js
const express = require('express');
const axios   = require('axios');
const app     = express();

app.use(express.json());

const API_KEY = process.env.NOKKI_API_KEY;
const API_URL = 'https://api.nokki.dev/v1';

// Webhook empfangen
app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;

  if (event === 'message.create') {
    const { channel_id, text } = data;

    if (text?.startsWith('/ping')) {
      await sendMessage(channel_id, '🏓 Pong!');
    }
  }

  res.sendStatus(200);
});

async function sendMessage(channelId, text) {
  await axios.post(\`\${API_URL}/messages\`, { channel_id: channelId, text }, {
    headers: { Authorization: \`Bearer \${API_KEY}\` }
  });
}

app.listen(3000, () => console.log('🤖 Bot läuft!'));`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Python Bot</h2>
        <pre style={pre}>{`# bot.py
from flask import Flask, request
import requests, os

app   = Flask(__name__)
TOKEN = os.environ['NOKKI_API_KEY']
API   = 'https://api.nokki.dev/v1'

@app.route('/webhook', methods=['POST'])
def webhook():
    data    = request.json
    event   = data.get('event')
    payload = data.get('data', {})

    if event == 'message.create':
        channel_id = payload.get('channel_id')
        text       = payload.get('text', '')

        if text.startswith('/ping'):
            requests.post(f'{API}/messages',
                json={'channel_id': channel_id, 'text': '🏓 Pong!'},
                headers={'Authorization': f'Bearer {TOKEN}'}
            )

    return 'OK', 200

if __name__ == '__main__':
    app.run(port=3000)`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Deploy-Optionen</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {[
            { name: 'Railway.app', desc: 'Einfachste Option, kostenloses Tier', tag: 'Empfohlen', color: '#22c55e' },
            { name: 'Render.com', desc: 'Kostenloser Tier, automatische Deploys', tag: 'Kostenlos', color: '#3b82f6' },
            { name: 'Heroku', desc: 'Klassisch, zuverlässig', tag: 'Bewährt', color: '#8b5cf6' },
            { name: 'DigitalOcean', desc: 'VPS ab 4€/Monat, volle Kontrolle', tag: 'Flexibel', color: '#06b6d4' },
            { name: 'Eigener VPS', desc: 'Maximale Kontrolle, eigene Hardware', tag: 'Profi', color: '#f59e0b' },
          ].map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px' }}>
              <span style={{ fontWeight: 700, minWidth: '130px' }}>{d.name}</span>
              <span style={{ color: '#8b8aa8', fontSize: '13px', flex: 1 }}>{d.desc}</span>
              <Badge label={d.tag} color={d.color} />
            </div>
          ))}
        </div>
        <div style={{ ...info, marginTop: '16px' }}>ℹ️ Dein Server muss HTTPS unterstützen damit Webhooks funktionieren!</div>
      </div>
    </div>
  ),

  development: (
    <div>
      <h1 style={h1s}>💻 Bot Development</h1>
      <p style={{ ...p, fontSize: '16px' }}>Lokale Entwicklung, Testing und Debugging.</p>

      <div style={card()}>
        <h2 style={h2s}>Lokales Setup mit ngrok</h2>
        <p style={p}>Für lokales Testen brauchst du einen HTTPS-Tunnel:</p>
        <pre style={pre}>{`# 1. ngrok installieren
npm install -g ngrok

# 2. Bot lokal starten
node bot.js   # läuft auf Port 3000

# 3. Tunnel öffnen (anderes Terminal)
ngrok http 3000

# 4. Ausgabe: https://abc123.ngrok.io → Webhook URL

# 5. Im Developer Portal als Webhook eintragen:
# https://abc123.ngrok.io/webhook`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>.env Datei einrichten</h2>
        <pre style={pre}>{`# .env
NOKKI_API_KEY=sk_live_dein_key_hier
NOKKI_BOT_ID=bot_abc123
PORT=3000`}</pre>
        <pre style={pre}>{`# Node.js laden
require('dotenv').config();
const key = process.env.NOKKI_API_KEY;`}</pre>
        <div style={warn}>⚠️ Füge .env zur .gitignore hinzu! Niemals committen.</div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Testing Checkliste</h2>
        <div style={{ display: 'grid', gap: '8px' }}>
          {[
            ['API Key funktioniert', '401-Fehler beim ersten Test?'],
            ['Bot Status = Aktiv', 'Im Dashboard prüfen'],
            ['Bot in Gruppe installiert', 'Installations-Link verwenden'],
            ['Webhook erreichbar', 'HTTPS Pflicht!'],
            ['Webhook im Portal eingetragen', 'Dashboard → Webhooks'],
            ['Events korrekt ausgewählt', 'z.B. message.create'],
            ['Bot antwortet auf Commands', '/ping testen'],
            ['Error Handling vorhanden', 'try/catch überall'],
          ].map(([check, hint], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '10px 14px' }}>
              <span style={{ fontSize: '18px' }}>☑️</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{check}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Debugging Tipps</h2>
        <pre style={pre}>{`// Alle eingehenden Webhooks loggen
app.post('/webhook', (req, res) => {
  console.log('📨 Event:', req.body.event);
  console.log('📦 Data:', JSON.stringify(req.body.data, null, 2));
  // ... dein Code
  res.sendStatus(200);
});`}</pre>
        <div style={tip}>✅ ngrok bietet unter http://localhost:4040 eine Web-UI mit allen empfangenen Requests!</div>
      </div>
    </div>
  ),

  api: (
    <div>
      <h1 style={h1s}>📡 API Reference</h1>
      <p style={{ ...p, fontSize: '16px' }}>Alle verfügbaren API-Endpunkte im Überblick.</p>

      <div style={{ ...info, marginBottom: '24px' }}>
        ℹ️ Base URL: <code style={code()}>https://api.nokki.dev/v1</code> &nbsp;|&nbsp; Alle Requests benötigen: <code style={code()}>Authorization: Bearer YOUR_KEY</code>
      </div>

      {[
        {
          category: '💬 Nachrichten', color: '#3b82f6',
          endpoints: [
            { method: 'POST', path: '/messages', desc: 'Nachricht senden', badge: 'SEND_MESSAGES' },
            { method: 'DELETE', path: '/messages/:id', desc: 'Nachricht löschen', badge: 'DELETE_MESSAGES' },
            { method: 'PATCH', path: '/messages/:id', desc: 'Nachricht bearbeiten', badge: 'SEND_MESSAGES' },
          ]
        },
        {
          category: '👥 Members', color: '#8b5cf6',
          endpoints: [
            { method: 'DELETE', path: '/channels/:id/members/:userId', desc: 'User kicken', badge: 'MANAGE_MEMBERS' },
            { method: 'POST', path: '/channels/:id/ban/:userId', desc: 'User bannen', badge: 'MANAGE_MEMBERS' },
            { method: 'POST', path: '/channels/:id/mute/:userId', desc: 'User muten', badge: 'MANAGE_MEMBERS' },
          ]
        },
        {
          category: '🤖 Bot Info', color: '#22c55e',
          endpoints: [
            { method: 'GET', path: '/bots/me', desc: 'Bot-Profil abrufen', badge: 'READ_MESSAGES' },
            { method: 'GET', path: '/bots/me/installations', desc: 'Alle Installationen', badge: 'READ_MESSAGES' },
          ]
        },
      ].map(section => (
        <div key={section.category} style={card()}>
          <h2 style={{ ...h2s, color: section.color }}>{section.category}</h2>
          <div style={{ display: 'grid', gap: '8px' }}>
            {section.endpoints.map(ep => (
              <div key={ep.path} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px' }}>
                <span style={{
                  padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                  minWidth: '56px', textAlign: 'center',
                  background: ep.method === 'GET' ? '#22c55e20' : ep.method === 'POST' ? '#3b82f620' : ep.method === 'DELETE' ? '#ef444420' : '#f59e0b20',
                  color: ep.method === 'GET' ? '#22c55e' : ep.method === 'POST' ? '#3b82f6' : ep.method === 'DELETE' ? '#ef4444' : '#f59e0b',
                }}>{ep.method}</span>
                <code style={{ ...code(), flex: 1 }}>{ep.path}</code>
                <span style={{ color: '#8b8aa8', fontSize: '13px', flex: 1 }}>{ep.desc}</span>
                <Badge label={ep.badge} color="#8b5cf6" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={card()}>
        <h2 style={h2s}>Beispiel: Nachricht senden</h2>
        <pre style={pre}>{`POST /messages
Content-Type: application/json
Authorization: Bearer sk_live_...

{
  "channel_id": "ch_abc123",
  "text": "Hallo von meinem Bot! 👋",
  "reply_to": "msg_xyz789"  // optional
}

// Response:
{
  "success": true,
  "message": {
    "id": "msg_new123",
    "text": "Hallo von meinem Bot! 👋",
    "created_at": "2025-05-12T10:00:00Z"
  }
}`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Rate Limits</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {[
            { limit: '60 req/min', desc: 'Standard Rate Limit pro API Key' },
            { limit: '10 req/s', desc: 'Burst Limit' },
            { limit: '429', desc: 'HTTP Status wenn Rate Limit überschritten — 60s warten' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px' }}>
              <code style={{ ...code(), minWidth: '90px' }}>{r.limit}</code>
              <span style={{ color: '#8b8aa8', fontSize: '13px' }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),

  webhooks: (
    <div>
      <h1 style={h1s}>🔔 Webhooks</h1>
      <p style={{ ...p, fontSize: '16px' }}>Echtzeit-Events für deinen Bot empfangen.</p>

      <div style={card()}>
        <h2 style={h2s}>Webhook einrichten</h2>
        <ol style={ol}>
          <li>Developer Portal → <strong>Webhooks</strong></li>
          <li><strong>„+ Neuer Webhook"</strong> klicken</li>
          <li>URL eingeben: <code style={code()}>https://dein-server.com/webhook</code></li>
          <li>Events auswählen</li>
          <li>Webhook speichern & aktivieren</li>
        </ol>
        <div style={warn}>⚠️ Webhook URLs müssen HTTPS verwenden!</div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Verfügbare Events</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {[
            { event: 'message.create', desc: 'Neue Nachricht im Channel', data: 'channel_id, message_id, text, sender_id' },
            { event: 'message.delete', desc: 'Nachricht wurde gelöscht', data: 'channel_id, message_id' },
            { event: 'member.join', desc: 'User ist dem Channel beigetreten', data: 'channel_id, user_id' },
            { event: 'member.leave', desc: 'User hat den Channel verlassen', data: 'channel_id, user_id' },
            { event: 'command.execute', desc: 'Bot-Command wurde ausgeführt', data: 'channel_id, command, user_id' },
            { event: 'giveaway.end', desc: 'Giveaway wurde beendet', data: 'giveaway_id, winners, prize' },
          ].map(e => (
            <div key={e.event} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <code style={code()}>{e.event}</code>
                <span style={{ color: '#8b8aa8', fontSize: '13px' }}>{e.desc}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Data: {e.data}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Webhook Payload Format</h2>
        <pre style={pre}>{`{
  "event": "message.create",
  "bot_id": "bot_abc123",
  "timestamp": "2025-05-12T10:00:00Z",
  "data": {
    "channel_id": "ch_xyz789",
    "message_id": "msg_def456",
    "text": "Hallo Bot!",
    "sender_id": "user_ghi012",
    "sender_name": "LucasTM"
  }
}`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Webhook Server (Express)</h2>
        <pre style={pre}>{`app.post('/webhook', (req, res) => {
  const { event, bot_id, data } = req.body;

  switch (event) {
    case 'message.create':
      handleMessage(data); break;
    case 'member.join':
      handleJoin(data); break;
    case 'giveaway.end':
      handleGiveaway(data); break;
  }

  // Immer 200 zurückgeben!
  res.sendStatus(200);
});`}</pre>
        <div style={tip}>✅ Antworte immer mit 200 OK — sonst wird der Webhook als fehlgeschlagen markiert und bis zu 3x wiederholt.</div>
      </div>
    </div>
  ),

  examples: (
    <div>
      <h1 style={h1s}>💡 Code Beispiele</h1>
      <p style={{ ...p, fontSize: '16px' }}>Fertige Bot-Beispiele zum Kopieren und Anpassen.</p>

      {[
        {
          title: '🏓 Ping-Pong Bot',
          desc: 'Antwortet auf /ping mit Pong',
          code: `app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;
  if (event === 'message.create' && data.text === '/ping') {
    await sendMessage(data.channel_id, '🏓 Pong!');
  }
  res.sendStatus(200);
});`
        },
        {
          title: '👋 Welcome Bot',
          desc: 'Begrüßt neue Mitglieder automatisch',
          code: `app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;
  if (event === 'member.join') {
    const msg = \`👋 Willkommen \${data.username}! Schön dass du dabei bist!\`;
    await sendMessage(data.channel_id, msg);
  }
  res.sendStatus(200);
});`
        },
        {
          title: '📊 Statistik Bot',
          desc: 'Zeigt Gruppen-Statistiken auf Command',
          code: `let messageCount = {};

app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;

  if (event === 'message.create') {
    messageCount[data.channel_id] = (messageCount[data.channel_id] || 0) + 1;

    if (data.text === '/stats') {
      const count = messageCount[data.channel_id] || 0;
      await sendMessage(data.channel_id, \`📊 Nachrichten seit Bot-Start: \${count}\`);
    }
  }

  res.sendStatus(200);
});`
        },
        {
          title: '🎉 Giveaway Bot',
          desc: 'Reagiert auf Giveaway-Events',
          code: `app.post('/webhook', async (req, res) => {
  const { event, data } = req.body;

  if (event === 'giveaway.end') {
    const winners = data.winners.map(w => \`@\${w.username}\`).join(', ');
    const msg = \`🎊 Herzlichen Glückwunsch \${winners}! Ihr habt **\${data.prize}** gewonnen!\`;
    await sendMessage(data.channel_id, msg);
  }

  res.sendStatus(200);
});`
        },
      ].map((ex, i) => (
        <div key={i} style={card()}>
          <h2 style={h2s}>{ex.title}</h2>
          <p style={p}>{ex.desc}</p>
          <pre style={pre}>{ex.code}</pre>
        </div>
      ))}
    </div>
  ),

  'best-practices': (
    <div>
      <h1 style={h1s}>⭐ Best Practices</h1>
      <p style={{ ...p, fontSize: '16px' }}>Tipps für sichere, stabile und performante Bots.</p>

      {[
        {
          title: '🔐 Sicherheit', color: '#ef4444',
          items: [
            'API Keys ausschließlich in .env Dateien — nie im Code oder Git',
            'Nur die minimalen Permissions vergeben die der Bot wirklich braucht',
            'HTTPS für alle Webhook-Endpoints verwenden',
            'API Keys regelmäßig rotieren (alle 90 Tage empfohlen)',
            'Webhook-Requests validieren (prüfe ob Payload plausibel ist)',
          ]
        },
        {
          title: '⚡ Performance', color: '#f59e0b',
          items: [
            'Rate Limits beachten: max. 60 Requests/Minute pro Key',
            'Requests bei Möglichkeit batchen',
            'Exponential Backoff bei 429-Fehlern implementieren',
            'Timeouts setzen (empfohlen: max. 10 Sekunden)',
            'Webhooks statt Polling — viel effizienter',
            'Async/await für alle API-Calls verwenden',
          ]
        },
        {
          title: '🐛 Error Handling', color: '#3b82f6',
          items: [
            'Alle API-Calls in try/catch wrappen',
            'HTTP Status Codes immer prüfen und gezielt reagieren',
            '429 → 60 Sekunden warten, dann nochmal versuchen',
            '401 → API Key prüfen und ggf. neu generieren',
            '500 → Retry mit Backoff, nach 3 Fehlern aufgeben',
            'Fehler loggen für späteres Debugging',
          ]
        },
        {
          title: '🧹 Code Qualität', color: '#22c55e',
          items: [
            'Event-Handler in separate Funktionen auslagern',
            'Bot-Logik von HTTP-Server trennen',
            'Konfiguration (API Keys, URLs) zentralisieren',
            'Commands in eigene Datei/Modul auslagern',
            'Einheitliche Fehlerbehandlung implementieren',
          ]
        },
      ].map(section => (
        <div key={section.title} style={card()}>
          <h2 style={{ ...h2s, color: section.color }}>{section.title}</h2>
          <ul style={ul}>
            {section.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      ))}

      <div style={card()}>
        <h2 style={h2s}>Exponential Backoff Beispiel</h2>
        <pre style={pre}>{`async function apiCallWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 429) {
        const wait = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(\`Rate limit — warte \${wait}ms...\`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err; // Andere Fehler direkt werfen
      }
    }
  }
  throw new Error('Max retries erreicht');
}`}</pre>
      </div>
    </div>
  ),

  troubleshooting: (
    <div>
      <h1 style={h1s}>🔧 Troubleshooting</h1>
      <p style={{ ...p, fontSize: '16px' }}>Häufige Probleme und wie du sie löst.</p>

      {[
        {
          problem: '401 Unauthorized',
          icon: '🔑',
          solutions: [
            'API Key korrekt kopiert? (kein Leerzeichen vorne/hinten)',
            'Authorization Header korrekt? → Authorization: Bearer sk_live_...',
            'API Key noch aktiv? Im Dashboard prüfen',
            'Key gehört dem richtigen Bot?',
          ],
          fix: `// Falsch:
headers: { Authorization: 'sk_live_abc123' }

// Richtig:
headers: { Authorization: 'Bearer sk_live_abc123' }`
        },
        {
          problem: '429 Too Many Requests',
          icon: '⏱️',
          solutions: [
            '60 Sekunden warten bevor du es nochmal versuchst',
            'Rate Limit: max. 60 Requests/Minute — prüfe deine Logik',
            'Mehrere API Keys für verschiedene Bots verwenden',
            'Requests batchen statt einzeln senden',
          ],
          fix: null
        },
        {
          problem: 'Webhook empfängt keine Events',
          icon: '🔔',
          solutions: [
            'Webhook URL erreichbar? (curl deine URL testen)',
            'HTTPS? HTTP funktioniert nicht!',
            'Port offen in Firewall?',
            'Events im Dashboard ausgewählt?',
            'Webhook Status = Aktiv?',
            'Bot in Gruppe installiert?',
          ],
          fix: `# Webhook lokal testen:
curl -X POST http://localhost:3000/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"event":"message.create","data":{"text":"test"}}'`
        },
        {
          problem: 'Bot antwortet nicht auf Commands',
          icon: '🤖',
          solutions: [
            'Permission SEND_MESSAGES vorhanden?',
            'Bot Status = Aktiv?',
            'Bot in der richtigen Gruppe installiert?',
            'Command korrekt geschrieben? (/command ohne Tippfehler)',
            'Webhook läuft und empfängt message.create Events?',
          ],
          fix: null
        },
        {
          problem: 'Command erscheint im Chat',
          icon: '💬',
          solutions: [
            'Commands werden serverseitig verarbeitet und nicht angezeigt',
            'Stelle sicher dass isGiveawayKeyword korrekt gesetzt ist',
            'Prüfe ob der Backend-Code korrekt deployed wurde',
          ],
          fix: null
        },
      ].map((item, idx) => (
        <div key={idx} style={card()}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', color: '#ef4444' }}>
            {item.icon} {item.problem}
          </h3>
          <p style={{ ...p, fontWeight: 600, marginBottom: '8px' }}>Mögliche Ursachen & Lösungen:</p>
          <ul style={ul}>
            {item.solutions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          {item.fix && <pre style={{ ...pre, marginTop: '14px' }}>{item.fix}</pre>}
        </div>
      ))}

      <div style={{ ...info, marginTop: '8px' }}>
        <strong>💬 Support:</strong> Problem nicht gelöst? Schreibe uns an{' '}
        <a href="mailto:dev@nokki.com" style={{ color: '#93c5fd' }}>dev@nokki.com</a>
      </div>
    </div>
  ),

  // ── NEU: Bot erstellen (Schritt für Schritt) ──────────────────────────────
  'bot-erstellen': (
    <div>
      <h1 style={h1s}>🤖 Bot erstellen — Schritt für Schritt</h1>
      <p style={p}>Diese Anleitung führt dich vom leeren Dev-Account bis zum live laufenden Bot auf dem Nokki-Marktplatz.</p>

      <div style={card()}>
        <h2 style={h2s}>Schritt 1 — Dev-Account erstellen</h2>
        <ol style={ol}>
          <li>Gehe zu <span style={code()}>lumestack.de/developers</span></li>
          <li>Klicke auf <strong>Registrieren</strong> — du brauchst eine E-Mail-Adresse</li>
          <li>Bestätige deine E-Mail</li>
          <li>Logge dich im Dev-Portal ein: <span style={code()}>lumestack.de/dev-login</span></li>
        </ol>
        <div style={info}>
          <strong>ℹ️ Wichtig:</strong> Nutze dieselbe E-Mail wie dein Nokki-Chat-Account — dann werden deine installierten Bots automatisch in beiden Bereichen angezeigt.
        </div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Schritt 2 — Neuen Bot anlegen</h2>
        <ol style={ol}>
          <li>Im Dev-Dashboard auf <strong>+ Neuer Bot</strong> klicken</li>
          <li>Name und kurze Beschreibung eingeben</li>
          <li>Permissions wählen (was darf dein Bot tun?)</li>
          <li>Bot erstellen → du bekommst eine <span style={code()}>botId</span> und einen <strong>API-Key</strong></li>
        </ol>

        <h3 style={h3s}>Wichtige Permissions</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '12px' }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#e8b86d' }}>Permission</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#8b8aa8' }}>Was sie erlaubt</th>
          </tr></thead>
          <tbody style={{ color: '#8b8aa8' }}>
            {[
              ['READ_MESSAGES',    'Nachrichten in Gruppen lesen'],
              ['SEND_MESSAGES',    'Nachrichten senden (als Bot)'],
              ['DELETE_MESSAGES',  'Nachrichten löschen (für Moderation)'],
              ['MANAGE_CHANNELS',  'Gruppeneinstellungen ändern'],
              ['MANAGE_USERS',     'Mitglieder verwalten'],
            ].map(([perm, desc]) => (
              <tr key={perm} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <td style={{ padding: '8px 12px' }}><span style={code()}>{perm}</span></td>
                <td style={{ padding: '8px 12px' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={tip}>Verwende immer nur die Permissions die dein Bot wirklich braucht — weniger ist mehr.</div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Schritt 3 — Bot entwickeln</h2>
        <p style={p}>Dein Bot läuft auf deinem eigenen Server und kommuniziert mit der Nokki API. Es gibt zwei Wege:</p>

        <h3 style={h3s}>Weg A: Webhook (empfohlen)</h3>
        <p style={p}>Nokki ruft deinen Server auf wenn eine Nachricht ankommt. Du antwortest mit einer Bot-Antwort.</p>
        <pre style={pre}>{`// Dein Node.js Server
const express = require('express')
const app = express()
app.use(express.json())

app.post('/webhook', (req, res) => {
  const { content, conversationId, senderName } = req.body

  // Auf Commands reagieren
  if (content === '/hallo') {
    res.json({
      reply: \`Hallo @\${senderName}! Ich bin dein Bot. 🤖\`
    })
    return
  }

  res.json({ reply: null }) // kein Reply
})

app.listen(3000)`}</pre>

        <h3 style={h3s}>Weg B: Polling (einfacher Einstieg)</h3>
        <p style={p}>Dein Bot fragt regelmäßig nach neuen Nachrichten.</p>
        <pre style={pre}>{`const API_KEY = 'dein_api_key'
const BOT_ID  = 'bot_xxxxxxxx'
const BASE    = 'https://lumestack.de/api'

async function poll() {
  const res = await fetch(\`\${BASE}/bot-messages/\${BOT_ID}/pending\`, {
    headers: { 'X-Bot-Key': API_KEY }
  })
  const { messages } = await res.json()
  for (const msg of messages) {
    if (msg.content === '/ping') {
      await sendMessage(msg.conversationId, 'Pong! 🏓')
    }
  }
}

setInterval(poll, 2000) // alle 2 Sekunden`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Schritt 4 — Bot testen</h2>
        <ol style={ol}>
          <li>Erstelle eine Test-Gruppe in Nokki</li>
          <li>Gehe im Dev-Portal zu <strong>Meine Bots → Installationen</strong></li>
          <li>Kopiere den Install-Link und öffne ihn</li>
          <li>Wähle deine Test-Gruppe aus und installiere den Bot</li>
          <li>Schreibe in der Gruppe einen Command — dein Bot sollte antworten</li>
        </ol>
        <div style={tip}>
          <strong>✅ Tipp:</strong> Nutze die Browser-Konsole (F12) um zu sehen was der Bot zurückgibt. Im Dev-Portal unter Analytics siehst du alle Aufrufe.
        </div>
      </div>
    </div>
  ),

  // ── NEU: Marktplatz-Veröffentlichung ─────────────────────────────────────
  marketplace: (
    <div>
      <h1 style={h1s}>🌐 Bot Marktplatz</h1>
      <p style={p}>Der Nokki Bot Marktplatz ist eine offene Plattform für Bots — nicht nur für Nokki, sondern für viele Messenger-Dienste. Als verifizierter Developer kannst du deine Bots einreichen.</p>

      <div style={card()}>
        <h2 style={h2s}>Unterstützte Plattformen</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          {[
            ['💬', 'Nokki', 'Nativ integriert'],
            ['🎮', 'Discord', 'Webhook-basiert'],
            ['✈️', 'Telegram', 'Bot API'],
            ['🎧', 'TeamSpeak', 'TS3 Plugin'],
            ['💼', 'Slack', 'Slack API'],
            ['🔷', 'Matrix', 'Matrix SDK'],
            ['🤖', 'Sonstiges', 'Eigene Plattform'],
          ].map(([icon, name, desc]) => (
            <div key={name} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{name}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={info}>Neue Plattformen werden regelmäßig hinzugefügt. Fehlt deine Plattform? Melde dich bei uns.</div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Bot veröffentlichen</h2>
        <p style={p}>Sobald dein Bot fertig entwickelt und getestet ist, kannst du ihn auf dem Marktplatz einreichen:</p>
        <ol style={ol}>
          <li>Gehe im Dev-Portal zu <strong>Meine Bots</strong></li>
          <li>Klicke bei deinem Bot auf <strong>🚀 Veröffentlichen</strong></li>
          <li>Fülle das Formular aus:</li>
        </ol>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', margin: '12px 0 16px' }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#e8b86d' }}>Feld</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#e8b86d' }}>Pflicht</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: '#8b8aa8' }}>Beschreibung</th>
          </tr></thead>
          <tbody style={{ color: '#8b8aa8' }}>
            {[
              ['Plattform',           '✅', 'Für welchen Messenger ist der Bot?'],
              ['Icon (Emoji)',         '✅', 'Ein einzelnes Emoji das deinen Bot repräsentiert'],
              ['Kategorie',           '✅', 'Utility, Fun, Moderation, Produktivität, etc.'],
              ['Kurzbeschreibung',    '✅', 'Max. 160 Zeichen — was macht dein Bot?'],
              ['Ausführliche Beschr.','✅', 'Alle Commands, Features, Beispiele'],
              ['Tags',                '❌', 'Kommagetrennte Stichwörter für die Suche'],
              ['Command-Präfix',      '❌', 'Standard: / — welches Zeichen startet Commands?'],
              ['Support-URL',         '❌', 'Link zu deiner Dokumentation oder Discord'],
              ['Webhook-URL',         '❌', 'Deine Webhook-Adresse (für Nokki-Integration)'],
            ].map(([field, req, desc]) => (
              <tr key={field} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#f1f0f8' }}>{field}</td>
                <td style={{ padding: '8px 12px' }}>{req}</td>
                <td style={{ padding: '8px 12px' }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={tip}>
          <strong>✅ Nach dem Absenden</strong> ist dein Bot sofort auf dem Marktplatz sichtbar unter <span style={code()}>lumestack.de/bot-store</span>. Kein Warten auf Freigabe!
        </div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Bot vom Marktplatz entfernen</h2>
        <p style={p}>Du kannst deinen Bot jederzeit zurückziehen:</p>
        <ol style={ol}>
          <li>Gehe zu <strong>Meine Bots</strong> im Dev-Portal</li>
          <li>Klicke auf <strong>Vom Marktplatz</strong> (erscheint wenn Bot veröffentlicht ist)</li>
          <li>Bestätige — der Bot ist sofort nicht mehr sichtbar</li>
        </ol>
        <div style={warn}>Bestehende Installationen bleiben aktiv bis die User den Bot manuell deinstallieren.</div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Tipps für einen erfolgreichen Bot-Eintrag</h2>
        <ul style={ul}>
          <li><strong>Wähle ein aussagekräftiges Emoji</strong> — es ist das erste was User sehen</li>
          <li><strong>Kurzbeschreibung</strong>: Was macht der Bot in einem Satz? Aktiv formulieren: "Erstellt Umfragen..." nicht "Kann Umfragen..."</li>
          <li><strong>Lange Beschreibung</strong>: Liste alle Commands mit Beispielen auf</li>
          <li><strong>Tags</strong>: Denke an Synonyme die User suchen würden</li>
          <li><strong>Support-URL</strong>: Verlinke eine Seite wo User Hilfe bekommen</li>
        </ul>
      </div>
    </div>
  ),

  // ── NEU: Webhook-Setup detailliert ───────────────────────────────────────
  'webhook-setup': (
    <div>
      <h1 style={h1s}>🔔 Webhook-Setup</h1>
      <p style={p}>Webhooks ermöglichen deinem Bot auf Nachrichten in Echtzeit zu reagieren. Nokki ruft deine URL auf sobald eine Nachricht in einer Gruppe ankommt wo dein Bot installiert ist.</p>

      <div style={card()}>
        <h2 style={h2s}>Webhook registrieren</h2>
        <p style={p}>Trage deine Webhook-URL im Dev-Portal unter <strong>Meine Bots → Bearbeiten</strong> ein, oder beim Veröffentlichen auf dem Marktplatz.</p>
        <pre style={pre}>{`// Nokki sendet folgende Daten an deine URL (POST):
{
  "event":          "message",
  "botId":          "bot_xxxxxxxx",
  "conversationId": "...",
  "content":        "/wetter Berlin",
  "senderId":       "...",
  "senderName":     "Lucifer",
  "timestamp":      "2026-05-21T12:00:00.000Z"
}`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Antwort-Format</h2>
        <p style={p}>Dein Server muss innerhalb von 5 Sekunden antworten:</p>
        <pre style={pre}>{`// Einfache Textnachricht
{ "reply": "Hallo! 👋" }

// Keine Antwort (kein Reply)
{ "reply": null }

// Mehrere Nachrichten
{ "replies": ["Erste Nachricht", "Zweite Nachricht"] }`}</pre>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Lokales Testen mit ngrok</h2>
        <p style={p}>Zum Testen kannst du deinen lokalen Server mit ngrok öffentlich erreichbar machen:</p>
        <pre style={pre}>{`# ngrok installieren und starten
npx ngrok http 3000

# Du bekommst eine URL wie:
# https://abc123.ngrok.io

# Diese URL als Webhook in deinem Bot eintragen
# Nokki → Dev-Portal → Mein Bot → Bearbeiten → Webhook URL`}</pre>
        <div style={tip}>ngrok ist nur zum Testen. Für den Live-Betrieb brauchst du einen echten Server (VPS, Heroku, Railway, etc.)</div>
      </div>

      <div style={card()}>
        <h2 style={h2s}>Webhook absichern</h2>
        <p style={p}>Verifiziere dass Requests wirklich von Nokki kommen:</p>
        <pre style={pre}>{`app.post('/webhook', (req, res) => {
  // Nokki schickt deinen API-Key im Header
  const key = req.headers['x-nokki-bot-key']
  if (key !== process.env.NOKKI_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  // ... deine Bot-Logik
})`}</pre>
      </div>
    </div>
  ),
}

// ── Main Component ────────────────────────────────────────────────────────────
const DevWiki: React.FC = () => {
  const [activeSection, setActiveSection] = useState('quickstart')
  const [search, setSearch] = useState('')

  const sections = [
    { id: 'quickstart',      title: '🚀 Quick Start' },
    { id: 'authentication',  title: '🔐 Authentifizierung' },
    { id: 'bots',            title: '🤖 Bots erstellen' },
    { id: 'bot-erstellen',   title: '📋 Bot-Anleitung (Neu)' },
    { id: 'installation',    title: '🔌 Bot Installation' },
    { id: 'integration',     title: '⚙️ Bot Integration' },
    { id: 'webhook-setup',   title: '🔔 Webhook-Setup (Neu)' },
    { id: 'development',     title: '💻 Bot Development' },
    { id: 'marketplace',     title: '🌐 Marktplatz (Neu)' },
    { id: 'api',             title: '📡 API Reference (geplant)' },
    { id: 'webhooks',        title: '🔔 Webhooks' },
    { id: 'examples',        title: '💡 Code Beispiele' },
    { id: 'best-practices',  title: '⭐ Best Practices' },
    { id: 'troubleshooting', title: '🔧 Troubleshooting' },
  ]

  const filtered = useMemo(() =>
    search.trim() === '' ? sections
      : sections.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
  , [search])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#08090f', color: '#f1f0f8' }}>

      {/* Sidebar */}
      <div style={{ width: '250px', background: '#0d0f18', borderRight: '1px solid rgba(255,255,255,0.07)', padding: '20px 14px', overflowY: 'auto', maxHeight: '100vh', flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg,#b46a0e,#e8b86d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📚</div>
          <span>Nokki <span style={{ color: '#8b8aa8', fontWeight: 500 }}>Wiki</span></span>
        </div>

        {/* Suche */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suchen..."
          style={{
            width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff',
            fontSize: '13px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box'
          }}
        />

        <a href="/dev-dashboard" style={{ display: 'block', padding: '9px 12px', borderRadius: '8px', marginBottom: '8px', color: '#8b8aa8', textDecoration: 'none', fontSize: '13px' }}>← Dashboard</a>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '10px' }} />

        {filtered.map(section => (
          <button
            key={section.id}
            onClick={() => { setActiveSection(section.id); setSearch('') }}
            style={{
              display: 'block', width: '100%', padding: '9px 12px', borderRadius: '8px',
              marginBottom: '3px', background: activeSection === section.id ? 'rgba(232,184,109,0.12)' : 'transparent',
              color: activeSection === section.id ? '#e8b86d' : '#8b8aa8',
              border: 'none', cursor: 'pointer', fontSize: '13px',
              fontWeight: activeSection === section.id ? 700 : 400,
              textAlign: 'left', transition: 'all 0.15s'
            }}
          >
            {section.title}
          </button>
        ))}

        {filtered.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: '13px', padding: '12px', textAlign: 'center' }}>
            Kein Eintrag gefunden
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', maxHeight: '100vh' }}>
        <div style={{ maxWidth: '820px' }}>
          <div style={info}>
            <strong>Developer Platform Beta:</strong> Öffentliche <code style={code()}>api.nokki.dev/v1</code>-Beispiele und offizielle SDKs sind noch nicht freigegeben. Nutze produktiv nur die im Portal verfügbaren Bot-, Webhook-, Scheduler- und Analytics-Funktionen.
          </div>
          {SECTIONS[activeSection] || (
            <div style={{ textAlign: 'center', padding: '80px', color: '#8b8aa8' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚧</div>
              Dieser Abschnitt wird noch erstellt.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DevWiki
