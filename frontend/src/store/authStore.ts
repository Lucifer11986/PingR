import { create } from 'zustand'
import api from '../services/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  activeIdentityId: string | null  // ✅ NEU
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  updateStatus: (status: User['status'], statusMessage?: string) => Promise<void>
  setToken: (token: string, activeIdentityId?: string) => void  // ✅ NEU
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('pingr_token'),
  activeIdentityId: localStorage.getItem('pingr_active_identity'),  // ✅ NEU
  loading: false,

  login: async (email, password) => {
    set({ loading: true })
    const { data } = await api.post('/api/auth/login', { email, password })
    localStorage.setItem('pingr_token', data.token)
    
    // ✅ activeIdentityId aus Response speichern
    if (data.user?.activeIdentityId) {
      localStorage.setItem('pingr_active_identity', data.user.activeIdentityId)
      set({ activeIdentityId: data.user.activeIdentityId })
    }
    
    set({ token: data.token, user: data.user, loading: false })
  },

  register: async (username, email, password) => {
    set({ loading: true })
    const { data } = await api.post('/api/auth/register', { username, email, password })
    localStorage.setItem('pingr_token', data.token)
    
    // ✅ activeIdentityId aus Response speichern
    if (data.user?.activeIdentityId) {
      localStorage.setItem('pingr_active_identity', data.user.activeIdentityId)
      set({ activeIdentityId: data.user.activeIdentityId })
    }
    
    set({ token: data.token, user: data.user, loading: false })
  },

  logout: () => {
    void api.post('/api/auth/logout').catch(() => {})
    // Logout-Sound triggern
    window.dispatchEvent(new CustomEvent('pingr_logout'))
    localStorage.removeItem('pingr_token')
    localStorage.removeItem('pingr_active_identity')  // ✅ NEU
    set({ token: null, user: null, activeIdentityId: null })
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/api/auth/me')
      set({ user: data })
    } catch {
      // Nicht ausloggen wenn wir im Dev Portal sind
      const isDevPortal = window.location.pathname.startsWith('/dev')
      if (!isDevPortal) {
        get().logout()
      }
    }
  },

  updateStatus: async (status, statusMessage) => {
    const { data } = await api.patch('/api/users/status', { status, statusMessage })
    set({ user: data })
  },

  // ✅ NEU: Token updaten (für Identity-Switch)
  setToken: (token, activeIdentityId) => {
    localStorage.setItem('pingr_token', token)
    if (activeIdentityId) {
      localStorage.setItem('pingr_active_identity', activeIdentityId)
      set({ activeIdentityId })
    }
    set({ token })
  },
}))
