/**
 * Sound-System für PingR
 * Sounds:
 *   ding    — neue Nachricht
 *   login   — Anmeldung (icq-anmeldung.mp3)
 *   logout  — Abmeldung (icq-abmelden.mp3)
 *   contact — Kontakt hinzugefügt (icq-Kontakt_Hinzugefügt.mp3)
 *   error   — Fehler / Dateiübertragung fehlgeschlagen (icq-fehler.mp3)
 */

type SoundTheme = 'icq' | 'modern' | 'minimal' | 'off'
type SoundType  = 'ding' | 'login' | 'logout' | 'contact' | 'error'

export interface CustomSound {
  id:         string
  label:      string
  url:        string
  size:       number
  uploadedAt: string
}

const THEMES: Record<SoundTheme, Record<SoundType, string> | null> = {
  // ICQ Classic — originale ICQ-Sounds
  icq: {
    ding:    '/sounds/icq-ding.mp3',
    login:   '/sounds/icq-anmeldung.mp3',
    logout:  '/sounds/icq-abmelden.mp3',
    contact: '/sounds/icq-kontakt.mp3',
    error:   '/sounds/icq-fehler.mp3',
  },
  // Modern — neue cleane Sounds
  modern: {
    ding:    '/sounds/modern-ding.mp3',
    login:   '/sounds/modern-ding.mp3',
    logout:  '/sounds/modern-ding.mp3',
    contact: '/sounds/modern-ding.mp3',
    error:   '/sounds/modern-ding.mp3',
  },
  // Minimal — sehr kurze, dezente Sounds
  minimal: {
    ding:    '/sounds/minimal-ding.mp3',
    login:   '/sounds/minimal-ding.mp3',
    logout:  '/sounds/minimal-ding.mp3',
    contact: '/sounds/minimal-ding.mp3',
    error:   '/sounds/minimal-ding.mp3',
  },
  off: null,
}

function getVolume(): number {
  return parseFloat(localStorage.getItem('pingr_volume') || '0.6')
}

function getTheme(): SoundTheme {
  return (localStorage.getItem('pingr_sound_theme') as SoundTheme) || 'icq'
}

function getCustomDingId(): string {
  return localStorage.getItem('pingr_custom_ding') || ''
}

function playBeep(frequency: number, duration: number, volume: number): void {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = 'sine'
    gain.gain.setValueAtTime(volume * 0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch (_err) {}
}

import { useCallback, useRef } from 'react'

const apiBase = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_API_URL || '') : ''

export function useSound() {
  const audioRef = useRef<Record<string, HTMLAudioElement>>({})

  const play = useCallback((type: SoundType) => {
    const theme  = getTheme()
    const volume = getVolume()
    if (theme === 'off' || volume === 0) return

    // Quiet Hours: Sound unterdrücken wenn aktive Identity in Quiet Hours
    try {
      const stored = localStorage.getItem('nokki_active_identity')
      if (stored) {
        const identity = JSON.parse(stored)
        const s = identity?.settings
        if (s?.quietHoursFrom && s?.quietHoursTo) {
          const now = new Date()
          const h = now.getHours() * 60 + now.getMinutes()
          const [fh, fm] = s.quietHoursFrom.split(':').map(Number)
          const [th, tm] = s.quietHoursTo.split(':').map(Number)
          const from = fh * 60 + fm
          const to   = th * 60 + tm
          const inQH = from > to ? (h >= from || h < to) : (h >= from && h < to)
          if (inQH) return  // Quiet Hours aktiv — kein Sound
        }
      }
    } catch (_e) {}

    // Custom Sound nur für 'ding'
    if (type === 'ding') {
      const customId = getCustomDingId()
      if (customId) {
        try {
          const stored = localStorage.getItem('pingr_custom_sounds')
          if (stored) {
            const sounds: CustomSound[] = JSON.parse(stored)
            const s = sounds.find(x => x.id === customId)
            if (s) {
              const key = `custom_${s.id}`
              if (!audioRef.current[key]) {
                audioRef.current[key] = new Audio(`${apiBase}${s.url}`)
              }
              const audio = audioRef.current[key]
              audio.volume = Math.max(0, Math.min(1, volume))
              audio.currentTime = 0
              audio.play().catch(() => playBeep(880, 0.15, volume))
              return
            }
          }
        } catch (_e) {}
      }
    }

    const sounds = THEMES[theme]
    if (!sounds) return
    const src = sounds[type]
    if (!src) return

    try {
      // Immer frisches Audio-Objekt — kein Cache-Problem bei Theme-Wechsel
      const audio = new Audio(src)
      audio.volume = Math.max(0, Math.min(1, volume))
      audio.play().catch(() => {
        if (type === 'ding') playBeep(880, 0.15, volume)
        else if (type === 'error') playBeep(220, 0.3, volume)
        else playBeep(440, 0.2, volume)
      })
    } catch (_err) {
      playBeep(880, 0.2, volume)
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    localStorage.setItem('pingr_volume', String(Math.max(0, Math.min(1, v))))
    Object.values(audioRef.current).forEach(a => { a.volume = v })
  }, [])

  const setTheme = useCallback((theme: string) => {
    localStorage.setItem('pingr_sound_theme', theme)
    audioRef.current = {}
  }, [])

  const setCustomDing = useCallback((soundId: string) => {
    localStorage.setItem('pingr_custom_ding', soundId)
  }, [])

  const playPreview = useCallback((url: string) => {
    const volume = getVolume()
    const audio  = new Audio(`${apiBase}${url}`)
    audio.volume = Math.max(0, Math.min(1, volume))
    audio.play().catch(() => {})
  }, [])

  const getVolumeValue = useCallback(() => getVolume(), [])
  const getThemeValue  = useCallback(() => getTheme(), [])
  const getCustomDing  = useCallback(() => getCustomDingId(), [])

  return {
    play, setVolume, setTheme, setCustomDing, playPreview,
    getVolume: getVolumeValue, getTheme: getThemeValue, getCustomDing,
  }
}