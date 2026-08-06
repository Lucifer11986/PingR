import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('pingr_token')
    
    // ✅ SECURITY FIX: activeIdentityId aus localStorage lesen
    const activeIdentityId = localStorage.getItem('pingr_active_identity')

    // Socket.IO URL: gleiche Origin wie die App
    // Wenn VITE_WS_URL gesetzt ist, nutze das
    // Sonst: gleiche Origin (window.location) - funktioniert immer korrekt
    const wsUrl = import.meta.env.VITE_WS_URL
      || import.meta.env.VITE_API_URL
      || `${window.location.protocol}//${window.location.host}`

    socket = io(wsUrl, {
      auth: { 
        token,
        identityId: activeIdentityId  // ✅ NEU: Identity mitgeben
      },
      // Polling first, dann WebSocket-Upgrade
      transports: ['polling', 'websocket'],
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1500,
      timeout:              20000,
      // SSL-Fehler nicht als fatal behandeln
      rejectUnauthorized:   false,
    })

    socket.on('connect', () => {
      console.log('✅ Socket verbunden:', socket?.id)
    })
    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket Verbindungsfehler:', err.message)
    })
    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket getrennt:', reason)
    })
  }
  return socket as Socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}