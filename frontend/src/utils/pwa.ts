export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  // SW nur auf HTTPS mit gültigem Zertifikat registrieren
  // Nicht auf IP-Adressen (self-signed SSL schlägt fehl)
  const isIpAddress = /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)
  if (isIpAddress) {
    console.log('[PWA] SW übersprungen: IP-Adresse ohne gültiges SSL-Zertifikat')
    return
  }
  if (window.location.protocol !== 'https:') {
    console.log('[PWA] SW übersprungen: kein HTTPS')
    return
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    console.log('[PWA] Service Worker registriert:', reg.scope)
  } catch (err: any) {
    // SSL-Fehler still ignorieren
    if (err?.message?.includes('SSL') || err?.message?.includes('certificate')) {
      console.log('[PWA] SW SSL-Fehler ignoriert')
    } else {
      console.warn('[PWA] Service Worker Fehler:', err?.message)
    }
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}