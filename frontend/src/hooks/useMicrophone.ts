/**
 * Mikrofon-Hook mit sauberer Fehlerbehandlung
 * 
 * WICHTIG: getUserMedia() funktioniert nur über:
 * - HTTPS (Produktionsserver)
 * - localhost / 127.0.0.1
 * 
 * Auf HTTP://<IP-Adresse> wird es vom Browser blockiert.
 * Lösung: HTTPS mit Let's Encrypt oder selbst-signiertem Zertifikat.
 */
import { useRef, useState, useCallback } from 'react'

export interface MicrophoneState {
  recording:     boolean
  seconds:       number
  error:         string | null
  supported:     boolean
}

export function useMicrophone() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval>>()

  const [state, setState] = useState<MicrophoneState>({
    recording: false, seconds: 0, error: null,
    // Prüfen ob getUserMedia verfügbar ist
    supported: !!(navigator.mediaDevices?.getUserMedia) &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'),
  })

  const start = useCallback(async (): Promise<boolean> => {
    setState(s => ({ ...s, error: null }))

    // HTTPS-Check
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setState(s => ({
        ...s,
        error: 'Mikrofon benötigt HTTPS. Bitte den Browser-Hinweis beachten.',
        supported: false,
      }))
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.start()
      mediaRecorderRef.current = mr
      setState(s => ({ ...s, recording: true, seconds: 0, error: null }))
      timerRef.current = setInterval(() => {
        setState(s => ({ ...s, seconds: s.seconds + 1 }))
      }, 1000)
      return true
    } catch (err: unknown) {
      const e = err as DOMException
      let msg = 'Mikrofon-Zugriff fehlgeschlagen.'
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        msg = 'Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.'
      } else if (e.name === 'NotFoundError') {
        msg = 'Kein Mikrofon gefunden.'
      } else if (e.name === 'NotReadableError') {
        msg = 'Mikrofon wird von einer anderen App verwendet.'
      } else if (e.name === 'SecurityError') {
        msg = 'Mikrofon benötigt HTTPS. Auf dieser Seite nicht verfügbar.'
      }
      setState(s => ({ ...s, error: msg, recording: false }))
      return false
    }
  }, [])

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const mr = mediaRecorderRef.current
      if (!mr) { resolve(null); return }
      clearInterval(timerRef.current)
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        mr.stream.getTracks().forEach(t => t.stop())
        setState(s => ({ ...s, recording: false, seconds: 0 }))
        resolve(blob)
      }
      mr.stop()
    })
  }, [])

  const fmtSeconds = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return { state, start, stop, fmtSeconds }
}