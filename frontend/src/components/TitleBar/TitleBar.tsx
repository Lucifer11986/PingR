import { useState, useEffect, useCallback } from 'react'

export default function TitleBar() {
  const [isElectron,  setIsElectron]  = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [updateInfo,  setUpdateInfo]  = useState<any>(null)
  const [hov,         setHov]         = useState<string|null>(null)
  const [pulse,       setPulse]       = useState(false)

  useEffect(() => {
    const init = () => {
      if ((window as any).pingr?.isElectron) {
        setIsElectron(true)
        const p = (window as any).pingr
        p.onMaximized?.((v: boolean) => setIsMaximized(v))
        p.onUpdateStatus?.((d: any) => {
          setUpdateInfo(d)
          // Puls-Animation starten wenn Update verfügbar
          if (d.status === 'available' || d.status === 'downloaded') {
            setPulse(true)
          }
        })
        return true
      }
      return false
    }
    if (!init()) {
      const t = setTimeout(init, 300)
      return () => clearTimeout(t)
    }
  }, [])

  const minimize = useCallback(() => (window as any).pingr?.minimize(), [])
  const maximize = useCallback(() => (window as any).pingr?.maximize(),  [])
  const close    = useCallback(() => (window as any).pingr?.close(),     [])

  if (!isElectron) return null

  const hasUpdate  = updateInfo?.status === 'available' || updateInfo?.status === 'downloaded'
  const isDownloading = updateInfo?.status === 'downloading'
  const isDone     = updateInfo?.status === 'downloaded'

  return (
    <>
      <style>{`
        @keyframes titlebar-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); }
          50%       { box-shadow: 0 0 0 6px rgba(59,130,246,0); }
        }
        @keyframes titlebar-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes titlebar-glow {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        .update-btn-pulse {
          animation: titlebar-pulse 1.5s ease-in-out infinite;
        }
        .update-btn-glow {
          animation: titlebar-glow 2s ease-in-out infinite;
        }
      `}</style>

      <div style={{
        height:          '44px',
        background:      'linear-gradient(90deg, #071428 0%, #0d2347 45%, #0a3d6e 70%, #071428 100%)',
        display:         'flex',
        alignItems:      'center',
        flexShrink:      0,
        position:        'relative',
        borderBottom:    '1px solid rgba(255,255,255,0.06)',
        // @ts-ignore
        WebkitAppRegion: 'drag',
        userSelect:      'none',
      }}>

        {/* Links: Logo + Name */}
        <div style={{ display:'flex', alignItems:'center', gap:'9px', paddingLeft:'14px', width:'200px', flexShrink:0 }}>
          <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(13,148,136,0.15)', border:'1.5px solid rgba(13,148,136,0.55)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="9" viewBox="0 0 28 14" fill="none">
              <circle cx="7"  cy="7" r="3.5" fill="#0d9488"/>
              <circle cx="14" cy="7" r="3.5" fill="#0d9488"/>
              <circle cx="21" cy="7" r="3.5" fill="#0d9488"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:'12px', fontWeight:700, color:'white', lineHeight:1.2 }}>Nokki</div>
            <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.35)', letterSpacing:'.5px', textTransform:'uppercase' as const }}>Messenger</div>
          </div>
        </div>

        {/* Mitte */}
        <div style={{ position:'absolute', left:0, right:'140px', textAlign:'center', pointerEvents:'none' }}>
          <span style={{ fontSize:'13px', fontWeight:700, color:'rgba(255,255,255,0.9)', letterSpacing:'.8px' }}>NOKKI</span>
        </div>

        {/* Rechts: Update-Button + Fensterbuttons */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'6px', paddingRight:'4px',
          // @ts-ignore
          WebkitAppRegion: 'no-drag' }}>

          {/* Update-Button — nur wenn Update vorhanden */}
          {hasUpdate && (
            <button
              className={isDone ? '' : 'update-btn-pulse'}
              onClick={() => isDone
                ? (window as any).pingr?.installUpdate()
                : (window as any).pingr?.checkForUpdates()
              }
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '6px',
                padding:      '4px 10px',
                borderRadius: '8px',
                border:       `1px solid ${isDone ? 'rgba(34,197,94,0.6)' : 'rgba(59,130,246,0.6)'}`,
                background:   isDone ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                color:        isDone ? '#4ade80' : '#93c5fd',
                fontSize:     '11px',
                fontWeight:   700,
                cursor:       'pointer',
                letterSpacing: '.2px',
              }}
            >
              {/* Icon */}
              {isDone ? (
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              )}
              {isDone ? `Neustart & v${updateInfo.version}` : `Update v${updateInfo.version}`}
            </button>
          )}

          {/* Download-Fortschritt */}
          {isDownloading && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <svg className="update-btn-glow" width="12" height="12" fill="none" stroke="#60a5fa" strokeWidth="2.5" viewBox="0 0 24 24" style={{ animation:'titlebar-spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <div style={{ width:'80px', height:'4px', background:'rgba(255,255,255,0.1)', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ width:`${updateInfo.percent || 0}%`, height:'100%', background:'linear-gradient(90deg,#3b82f6,#0d9488)', borderRadius:'2px', transition:'width .3s' }}/>
              </div>
              <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', minWidth:'28px' }}>
                {updateInfo.percent || 0}%
              </span>
            </div>
          )}

          {/* Fensterbuttons */}
          {(['min','max','close'] as const).map(id => (
            <button key={id}
              onMouseEnter={() => setHov(id)}
              onMouseLeave={() => setHov(null)}
              onClick={id==='min' ? minimize : id==='max' ? maximize : close}
              style={{
                width:'44px', height:'44px', border:'none', cursor:'pointer',
                background: hov===id ? (id==='close' ? '#c42b1c' : 'rgba(255,255,255,0.1)') : 'transparent',
                color: hov===id && id==='close' ? 'white' : 'rgba(255,255,255,0.55)',
                fontSize: id==='min' ? '16px' : '12px',
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'background .1s, color .1s',
              }}>
              {id==='min' ? '─' : id==='max' ? (isMaximized ? '❐' : '□') : '✕'}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
