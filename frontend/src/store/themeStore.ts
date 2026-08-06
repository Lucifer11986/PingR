import { create } from 'zustand'

export type ColorTheme = 'dark' | 'light' | 'midnight' | 'ocean' | 'forest'
export type ChatBackground = 'none' | 'dots' | 'grid' | 'waves' | 'bubbles' | 'custom'

interface ThemeState {
  colorTheme:    ColorTheme
  chatBg:        ChatBackground
  chatBgCustom:  string | null   // URL für eigenes Hintergrundbild
  fontSize:      'sm' | 'md' | 'lg'
  bubbleStyle:   'rounded' | 'sharp' | 'modern'
  setColorTheme: (t: ColorTheme)      => void
  setChatBg:     (bg: ChatBackground) => void
  setChatBgCustom:(url: string|null)  => void
  setFontSize:   (s: 'sm'|'md'|'lg') => void
  setBubbleStyle:(s: 'rounded'|'sharp'|'modern') => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  colorTheme:   (localStorage.getItem('pingr_theme')    || 'dark')    as ColorTheme,
  chatBg:       (localStorage.getItem('pingr_chatbg')   || 'none')    as ChatBackground,
  chatBgCustom:  localStorage.getItem('pingr_chatbg_custom') || null,
  fontSize:     (localStorage.getItem('pingr_fontsize') || 'md')      as 'sm'|'md'|'lg',
  bubbleStyle:  (localStorage.getItem('pingr_bubble')   || 'rounded') as 'rounded'|'sharp'|'modern',

  setColorTheme: (t) => {
    localStorage.setItem('pingr_theme', t)
    set({ colorTheme: t })
    applyTheme(t)
  },
  setChatBg: (bg) => {
    localStorage.setItem('pingr_chatbg', bg)
    set({ chatBg: bg })
  },
  setChatBgCustom: (url) => {
    if (url) localStorage.setItem('pingr_chatbg_custom', url)
    else localStorage.removeItem('pingr_chatbg_custom')
    set({ chatBgCustom: url })
  },
  setFontSize: (s) => {
    localStorage.setItem('pingr_fontsize', s)
    set({ fontSize: s })
    document.documentElement.style.fontSize = s === 'sm' ? '14px' : s === 'lg' ? '17px' : '15px'
  },
  setBubbleStyle: (s) => {
    localStorage.setItem('pingr_bubble', s)
    set({ bubbleStyle: s })
  },
}))

export function applyTheme(theme: ColorTheme) {
  const root = document.documentElement
  const themes: Record<ColorTheme, Record<string, string>> = {
    dark: {
      '--bg':   '#0d0d14',
      '--bg2':  '#13131f',
      '--bg3':  '#1a1a2e',
      '--acc':  '#4f6ef7',
      '--txt':  '#f1f0f8',
      '--mut':  '#8b8aa8',
      '--bdr':  'rgba(255,255,255,0.08)',
      '--msg-own':   'rgba(79,110,247,0.25)',
      '--msg-other': 'rgba(255,255,255,0.06)',
    },
    light: {
      '--bg':   '#f0f2f5',
      '--bg2':  '#ffffff',
      '--bg3':  '#e8eaed',
      '--acc':  '#2563eb',
      '--txt':  '#1a1a2e',
      '--mut':  '#6b7280',
      '--bdr':  'rgba(0,0,0,0.1)',
      '--msg-own':   'rgba(37,99,235,0.15)',
      '--msg-other': 'rgba(0,0,0,0.04)',
    },
    midnight: {
      '--bg':   '#070714',
      '--bg2':  '#0d0d20',
      '--bg3':  '#12122a',
      '--acc':  '#7c3aed',
      '--txt':  '#e8e8ff',
      '--mut':  '#7070a0',
      '--bdr':  'rgba(124,58,237,0.15)',
      '--msg-own':   'rgba(124,58,237,0.3)',
      '--msg-other': 'rgba(255,255,255,0.05)',
    },
    ocean: {
      '--bg':   '#0a1628',
      '--bg2':  '#0f2040',
      '--bg3':  '#142a50',
      '--acc':  '#0ea5e9',
      '--txt':  '#e0f2fe',
      '--mut':  '#64a3c8',
      '--bdr':  'rgba(14,165,233,0.15)',
      '--msg-own':   'rgba(14,165,233,0.25)',
      '--msg-other': 'rgba(255,255,255,0.06)',
    },
    forest: {
      '--bg':   '#0a1a0f',
      '--bg2':  '#0f2318',
      '--bg3':  '#142d1e',
      '--acc':  '#16a34a',
      '--txt':  '#dcfce7',
      '--mut':  '#5a9c6e',
      '--bdr':  'rgba(22,163,74,0.15)',
      '--msg-own':   'rgba(22,163,74,0.25)',
      '--msg-other': 'rgba(255,255,255,0.06)',
    },
  }
  const vars = themes[theme] || themes.dark
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))

  // Body Klasse für Light-Mode
  document.body.classList.toggle('light-mode', theme === 'light')
}

// Beim Start Theme anwenden
const stored = (localStorage.getItem('pingr_theme') || 'dark') as ColorTheme
applyTheme(stored)
const storedSize = localStorage.getItem('pingr_fontsize') || 'md'
document.documentElement.style.fontSize = storedSize === 'sm' ? '14px' : storedSize === 'lg' ? '17px' : '15px'