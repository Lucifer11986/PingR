// PingR Update-Banner — prüft ob eine neue Version verfügbar ist
(function() {
  if (!('serviceWorker' in navigator)) return

  // Auf neue Service Worker Version prüfen
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (document.getElementById('pingr-update-banner')) return

    var banner = document.createElement('div')
    banner.id = 'pingr-update-banner'
    banner.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
      'background:#0d0f18', 'border:1px solid rgba(232,184,109,0.4)',
      'border-radius:14px', 'padding:12px 20px',
      'display:flex', 'align-items:center', 'gap:12px',
      'z-index:99999', 'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
      'font-family:-apple-system,sans-serif', 'font-size:13px',
      'color:rgba(255,255,255,0.85)', 'white-space:nowrap',
      'backdrop-filter:blur(16px)',
    ].join(';')

    banner.innerHTML = [
      '<span style="font-size:16px">🆕</span>',
      '<span>Neue Version verfügbar</span>',
      '<button onclick="window.location.reload()" style="',
        'background:linear-gradient(135deg,#b46a0e,#e8b86d);',
        'border:none;border-radius:8px;padding:5px 14px;',
        'color:#fff;font-size:12px;font-weight:600;cursor:pointer',
      '">Aktualisieren</button>',
      '<button onclick="this.parentElement.remove()" style="',
        'background:none;border:none;color:rgba(255,255,255,0.3);',
        'cursor:pointer;font-size:16px;padding:0 4px',
      '">✕</button>',
    ].join('')

    document.body.appendChild(banner)

    // Banner nach 30 Sekunden automatisch ausblenden
    setTimeout(function() {
      if (banner.parentElement) banner.remove()
    }, 30000)
  })
})()
