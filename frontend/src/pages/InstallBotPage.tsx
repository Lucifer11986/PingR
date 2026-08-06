import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { devFetch } from '../services/devApi';

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'group' | 'dm' | 'nokki_channel';
}

const InstallBotPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const botId = searchParams.get('bot_id');

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!botId) {
      setError('Keine Bot-ID angegeben');
      setLoading(false);
      return;
    }

    fetchChannels();
  }, [botId]);

  const fetchChannels = async () => {
    try {
      // Prüfe beide Tokens
      const chatToken = localStorage.getItem('pingr_token');
      const devToken = localStorage.getItem('nokki_dev_token');
      const token = chatToken || devToken;

      if (!token) {
        setError('Bitte logge dich ein um Channels zu sehen');
        setLoading(false);
        return;
      }

      // Hole ECHTE Channels/Gruppen vom Backend
      const response = await devFetch('/api/conversations/my-channels', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
        
        if (data.channels.length === 0) {
          setError('Du hast keine Channels oder Gruppen wo du Admin bist');
        }
      } else {
        // Fallback zu Mock-Daten wenn API fehlschlägt
        console.warn('Could not load real channels, using mock data');
        const mockChannels: Channel[] = [
          { id: 'ch_general', name: '#general', type: 'channel' },
          { id: 'ch_random', name: '#random', type: 'channel' },
          { id: 'grp_team', name: 'Team Chat', type: 'group' },
        ];
        setChannels(mockChannels);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching channels:', err);
      setError('Fehler beim Laden der Channels');
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!selectedChannel) {
      setError('Bitte wähle einen Channel oder eine Gruppe aus');
      return;
    }

    setInstalling(true);
    setError('');

    try {
      // Prüfe beide Tokens: Chat-Token ODER Dev-Token
      const chatToken = localStorage.getItem('pingr_token');
      const devToken = localStorage.getItem('nokki_dev_token');
      const token = chatToken || devToken;

      if (!token) {
        setError('Bitte logge dich ein um Bots zu installieren');
        setInstalling(false);
        return;
      }

      const channel = channels.find(c => c.id === selectedChannel);

      const response = await devFetch('/api/bot-install/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          botId,
          channelId: selectedChannel,
          channelName: channel?.name,
          channelType: channel?.type,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/chat'); // Zurück zum Chat
        }, 2000);
      } else {
        setError(data.error || 'Fehler bei der Installation');
      }
    } catch (err) {
      console.error('Install error:', err);
      setError('Verbindungsfehler');
    } finally {
      setInstalling(false);
    }
  };

  if (!botId) {
    return (
      <div style={{ 
        minHeight: '100vh', background: '#08090f', color: '#f1f0f8',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>❌ Fehler</h1>
          <p style={{ color: '#8b8aa8' }}>Keine Bot-ID angegeben</p>
          <button onClick={() => navigate('/chat')} style={{
            marginTop: '20px', padding: '10px 20px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #b46a0e, #e8b86d)',
            border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600
          }}>Zurück zum Chat</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', background: '#08090f', color: '#f1f0f8',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: '#0d0f18', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '100%'
      }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>
              Bot erfolgreich installiert!
            </h2>
            <p style={{ color: '#8b8aa8', marginBottom: '24px' }}>
              Du wirst gleich zum Chat weitergeleitet...
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>
                Bot installieren
              </h1>
              <p style={{ color: '#8b8aa8', fontSize: '14px' }}>
                Bot ID: <code style={{ 
                  background: 'rgba(232,184,109,0.15)', 
                  padding: '2px 8px', 
                  borderRadius: '4px',
                  color: '#e8b86d' 
                }}>{botId}</code>
              </p>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '12px', marginBottom: '20px'
              }}>
                <p style={{ color: '#ef4444', fontSize: '14px', margin: 0 }}>❌ {error}</p>
              </div>
            )}

            {loading ? (
              <p style={{ textAlign: 'center', color: '#8b8aa8', padding: '40px' }}>
                Lade Channels...
              </p>
            ) : (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    marginBottom: '12px',
                    color: '#f1f0f8'
                  }}>
                    Wähle Channel oder Gruppe:
                  </label>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {channels.map(channel => (
                      <label key={channel.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                        background: selectedChannel === channel.id 
                          ? 'rgba(232,184,109,0.15)' 
                          : 'rgba(255,255,255,0.04)',
                        border: selectedChannel === channel.id 
                          ? '1px solid rgba(232,184,109,0.4)' 
                          : '1px solid rgba(255,255,255,0.08)',
                        transition: 'all 0.2s'
                      }}>
                        <input
                          type="radio"
                          name="channel"
                          value={channel.id}
                          checked={selectedChannel === channel.id}
                          onChange={e => setSelectedChannel(e.target.value)}
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            cursor: 'pointer',
                            accentColor: '#e8b86d'
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: 600,
                            color: selectedChannel === channel.id ? '#e8b86d' : '#f1f0f8'
                          }}>
                            {channel.type === 'channel' && '🏢 '}
                            {channel.type === 'nokki_channel' && '📢 '}
                            {channel.type === 'group' && '👥 '}
                            {channel.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#8b8aa8', marginTop: '2px' }}>
                            {channel.type === 'nokki_channel' ? 'Nokki Channel' : channel.type === 'channel' ? 'Öffentlicher Channel' : 'Private Gruppe'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => navigate('/chat')} style={{
                    flex: 1, padding: '14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)', 
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f1f0f8', cursor: 'pointer', fontWeight: 600
                  }}>
                    Abbrechen
                  </button>
                  <button 
                    onClick={handleInstall} 
                    disabled={installing || !selectedChannel}
                    style={{
                      flex: 1, padding: '14px', borderRadius: '10px',
                      background: installing || !selectedChannel 
                        ? '#666' 
                        : 'linear-gradient(135deg, #b46a0e, #e8b86d)',
                      border: 'none', color: '#fff', 
                      cursor: installing || !selectedChannel ? 'not-allowed' : 'pointer',
                      fontWeight: 700, fontSize: '15px'
                    }}
                  >
                    {installing ? 'Installiere...' : 'Bot installieren'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InstallBotPage;
