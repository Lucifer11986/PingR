import { create } from 'zustand'
import api from '../services/api'
import type { Contact, User } from '../types'

interface ContactState {
  contacts: Contact[]
  loading: boolean
  error: string | null
  fetchContacts: () => Promise<void>
  addContact: (uin: string) => Promise<void>
  removeContact: (contactId: string) => Promise<void>
  setUserStatus: (userId: string, status: User['status']) => void
}

export const useContactStore = create<ContactState>((set) => ({
  contacts: [],
  loading: false,
  error: null,

  fetchContacts: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/contacts')
      set({ contacts: data, loading: false })
    } catch (_err) {
      set({ error: 'Kontakte konnten nicht geladen werden', loading: false })
    }
  },

  addContact: async (uin) => {
    const { data } = await api.post('/api/contacts', { uin })
    set(s => ({ contacts: [...s.contacts, data] }))
  },

  removeContact: async (contactId) => {
    await api.delete(`/api/contacts/${contactId}`)
    set(s => ({ contacts: s.contacts.filter(c => c._id !== contactId) }))
  },

  setUserStatus: (userId, status) => {
    set(s => ({
      contacts: s.contacts.map(c =>
        c.user._id === userId ? { ...c, user: { ...c.user, status } } : c
      ),
    }))
  },
}))