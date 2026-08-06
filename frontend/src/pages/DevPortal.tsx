import React from 'react';
import { useNavigate } from 'react-router-dom';

const DevPortal: React.FC = () => {
  const navigate = useNavigate();
  const features = [
    { icon: '🔑', title: 'Bot Authentication', desc: 'Gehashte API-Keys mit serverseitigem Rate-Limiting.', available: true },
    { icon: '📡', title: 'Real-time Webhooks', desc: 'Erhalte sofortige Benachrichtigungen für Nachrichten und Events.', available: true },
    { icon: '💬', title: 'Öffentliche REST API', desc: 'Versionierte API für externe Integrationen.', available: false, coming: 'In Entwicklung' },
    { icon: '🛡️', title: 'Permission System', desc: 'Granulare Berechtigungen: READ_MESSAGES, SEND_MESSAGES, MANAGE_CHANNELS.', available: true },
    { icon: '📊', title: 'Analytics Dashboard', desc: 'Gespeicherte Bot-, Command- und Webhook-Metriken.', available: true },
    { icon: '📚', title: 'OpenAPI-Dokumentation', desc: 'Maschinenlesbare API-Spezifikation mit Live-Testing.', available: false, coming: 'In Entwicklung' },
    { icon: '🤖', title: 'Bot Store', desc: 'Veröffentliche und entdecke Community-Bots.', available: true },
    { icon: '💰', title: 'Monetization', desc: 'Verkaufe Premium-Bots mit eingebauter Zahlungsabwicklung.', available: false, coming: 'Q3 2026' },
  ];

  return (
    <div style={{ background: '#08090f', color: '#f1f0f8', minHeight: '100vh' }}>
      {/* Fixed Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backdropFilter: 'blur(24px)', background: 'rgba(8,9,15,0.9)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 4%',
        height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: 800, cursor: 'pointer' }}
          onClick={() => navigate('/developers')}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #b46a0e, #e8b86d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', boxShadow: '0 0 0 8px rgba(232,184,109,0.08)'
          }}>🤖</div>
          <span>Nokki <span style={{ color: '#8b8aa8', fontWeight: 500, marginLeft: '4px' }}>Developers</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <a href="#features" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Features</a>
          <a href="#api" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>API Docs</a>
          <button onClick={() => navigate('/dev-dashboard')} style={{
            padding: '10px 22px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
            background: 'rgba(255,255,255,0.05)', color: '#f1f0f8', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer'
          }}>Dashboard</button>
          <button onClick={() => navigate('/dev-register')} style={{
            padding: '10px 22px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
            background: 'linear-gradient(135deg, #b46a0e, #e8b86d)', color: '#fff', border: 'none', cursor: 'pointer'
          }}>Get Started</button>
        </div>
      </nav>

      {/* SCROLLABLE CONTENT CONTAINER - CRITICAL FIX */}
      <div style={{
        paddingTop: '64px',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {/* Hero */}
        <section style={{
          minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', padding: '80px 5%', position: 'relative'
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
            color: '#a855f7', padding: '6px 18px', borderRadius: '99px', fontSize: '13px', fontWeight: 600, marginBottom: '28px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }}></span>
            <span>Developer Platform • Beta</span>
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 7vw, 80px)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-2.8px', marginBottom: '24px' }}>
            <span>Erstelle mächtige Bots</span><br />
            <span style={{
              background: 'linear-gradient(135deg, #b46a0e, #e8b86d)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>für Nokki</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: '#8b8aa8', maxWidth: '680px', lineHeight: 1.75, margin: '0 auto 40px' }}>
            Erstelle Bots mit sicheren Webhooks, Berechtigungen, Zeitplänen und nachvollziehbaren Analytics.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => window.location.href = '/docs.html'} style={{
              padding: '14px 32px', borderRadius: '10px', fontSize: '16px', fontWeight: 600,
              background: 'linear-gradient(135deg, #b46a0e, #e8b86d)', color: '#fff', border: 'none', cursor: 'pointer'
            }}>📚 Dokumentation ansehen</button>
            <button onClick={() => navigate('/dev-register')} style={{
              padding: '14px 32px', borderRadius: '10px', fontSize: '16px', fontWeight: 600,
              background: 'rgba(255,255,255,0.05)', color: '#f1f0f8', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer'
            }}>🔑 API-Key holen</button>
          </div>
        </section>

        {/* Stats */}
        <section style={{ background: '#0d0f18', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '40px 5%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            {[
              { value: '60', label: 'Requests pro Minute' },
              { value: 'HMAC', label: 'Signierte Webhooks' },
              { value: '10', label: 'Webhooks pro Bot' },
              { value: 'Beta', label: 'Aktueller Status' },
            ].map((stat, idx) => (
              <div key={idx}>
                <div style={{
                  fontSize: '48px', fontWeight: 900, letterSpacing: '-2px',
                  background: 'linear-gradient(135deg, #b46a0e, #e8b86d)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px'
                }}>{stat.value}</div>
                <div style={{ fontSize: '13px', color: '#8b8aa8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" style={{ padding: '100px 5%', background: '#08090f' }}>
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 60px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#e8b86d', marginBottom: '14px' }}>
              🔥 Platform Features
            </div>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-1.8px', marginBottom: '18px' }}>
              Alles was du zum Bauen brauchst
            </h2>
            <p style={{ fontSize: '17px', color: '#8b8aa8', lineHeight: 1.7 }}>
              Die verfügbaren Funktionen sind gekennzeichnet; weitere Schnittstellen befinden sich in Entwicklung.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', maxWidth: '1300px', margin: '0 auto' }}>
            {features.map((feature, idx) => (
              <div key={idx} style={{
                background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px',
                padding: '36px 28px', position: 'relative', opacity: feature.available ? 1 : 0.6,
                transition: 'all 0.3s'
              }}>
                <span style={{
                  position: 'absolute', top: '16px', right: '16px', padding: '5px 12px',
                  borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                  background: feature.available ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                  color: feature.available ? '#86efac' : '#fde047',
                  border: feature.available ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(234,179,8,0.3)'
                }}>
                  {feature.available ? '✅ Verfügbar' : `⏳ ${feature.coming}`}
                </span>
                <span style={{ fontSize: '40px', display: 'block', marginBottom: '20px', filter: feature.available ? 'none' : 'grayscale(1)', opacity: feature.available ? 1 : 0.5 }}>
                  {feature.icon}
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px', letterSpacing: '-0.4px' }}>
                  {feature.title}
                </h3>
                <p style={{ fontSize: '14px', color: '#8b8aa8', lineHeight: 1.7 }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ 
          background: '#0d0f18', 
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '60px 5% 40px',
          marginTop: '100px'
        }}>
          <div style={{ 
            maxWidth: '1200px', 
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '40px',
            marginBottom: '40px'
          }}>
            {/* Column 1 - Produkt */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#e8b86d' }}>Produkt</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="/features.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Features</a>
                <a href="/pricing.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Preise</a>
                <a href="/api-status.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>API Status</a>
                <a href="/changelog.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Changelog</a>
              </div>
            </div>

            {/* Column 2 - Dokumentation */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#e8b86d' }}>Dokumentation</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="/docs.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Docs</a>
                <a href="/api-reference.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>API Reference</a>
                <a href="/examples.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Beispiele</a>
                <a href="/sdks.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>SDKs</a>
              </div>
            </div>

            {/* Column 3 - Ressourcen */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#e8b86d' }}>Ressourcen</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="/dev-wiki" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Wiki</a>
                <a href="mailto:privacy@lumestack.de" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Support</a>
              </div>
            </div>

            {/* Column 4 - Legal */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#e8b86d' }}>Legal</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a href="/datenschutz.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Datenschutz</a>
                <a href="/agb.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>AGB</a>
                <a href="/impressum.html" style={{ fontSize: '14px', color: '#8b8aa8', textDecoration: 'none' }}>Impressum</a>
              </div>
            </div>
          </div>

          <div style={{ 
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '32px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '13px', color: '#8b8aa8' }}>
              © 2026 Nokki Developer Platform • Made with 🤖 in Germany
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DevPortal;
