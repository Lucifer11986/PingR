import React from 'react'
import { useNavigate } from 'react-router-dom'

interface DevSidebarProps { active: string }

const NAV = [
  { id: 'dashboard', href: '/dev-dashboard', icon: '🏠', label: 'Übersicht'     },
  { id: 'bots',      href: '/dev-bots',      icon: '🤖', label: 'Meine Bots'    },
  { id: 'api-keys',  href: '/dev-api-keys',  icon: '🔑', label: 'API Keys'      },
  { id: 'analytics', href: '/dev-analytics', icon: '📈', label: 'Analytics'     },
  { id: 'webhooks',  href: '/dev-webhooks',  icon: '🔔', label: 'Webhooks'      },
  { id: 'settings',  href: '/dev-settings',  icon: '⚙️', label: 'Einstellungen' },
  { id: 'wiki',      href: '/dev-wiki',      icon: '📚', label: 'Wiki'          },
]

const DevSidebar: React.FC<DevSidebarProps> = ({ active }) => {
  const nav = useNavigate()

  return (
    <div className="dev-sidebar" style={{ width:220, flexShrink:0, background:'#0d0f18', borderRight:'1px solid rgba(255,255,255,0.07)', padding:'20px 12px', display:'flex', flexDirection:'column', minHeight:'100dvh' }}>

      {/* Logo */}
      <div onClick={() => nav('/developers')} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28, cursor:'pointer' }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#b46a0e,#e8b86d)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🤖</div>
        <span className="dev-sidebar-label" style={{ fontWeight:800, fontSize:16 }}>Nokki <span style={{ color:'#8b8aa8', fontWeight:500 }}>Dev</span></span>
      </div>

      {/* Nav */}
      <nav style={{ flex:1 }}>
        {NAV.map(item => {
          const isActive = item.id === active
          return (
            <button key={item.id} onClick={() => nav(item.href)} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
              padding:'9px 12px', borderRadius:8, marginBottom:3, border:'none', cursor:'pointer',
              background: isActive ? 'rgba(232,184,109,0.12)' : 'transparent',
              color: isActive ? '#e8b86d' : '#8b8aa8',
              fontSize:13, fontWeight: isActive ? 700 : 400, transition:'all .15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color='rgba(255,255,255,0.8)' }}
            onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.color='#8b8aa8' } }}>
              <span style={{ fontSize:15 }}>{item.icon}</span>
              <span className="dev-sidebar-label">{item.label}</span>
              {isActive && <div style={{ marginLeft:'auto', width:5, height:5, borderRadius:'50%', background:'#e8b86d' }} />}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="dev-sidebar-footer" style={{ paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => nav('/dev-wiki')} style={{ background:'none', border:'none', color:'#6b7280', fontSize:12, cursor:'pointer', padding:0, fontFamily:'inherit' }}>
          ❓ Hilfe & Dokumentation
        </button>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .dev-sidebar { width: 64px !important; padding: 16px 8px !important; }
          .dev-sidebar-label, .dev-sidebar-footer { display: none !important; }
          .dev-sidebar button { justify-content: center; padding: 10px 8px !important; }
        }
        @media (max-width: 560px) {
          .dev-sidebar { position: sticky; left: 0; top: 0; z-index: 20; }
        }
      `}</style>
    </div>
  )
}

export default DevSidebar
