import { useEffect } from 'react'
import { useContactStore } from '../store/contactStore'

export function useContacts() {
  const { contacts, loading, error, fetchContacts } = useContactStore()

  useEffect(() => {
    fetchContacts()

    // Echtzeit-Update wenn Kontakt hinzugefügt/entfernt wird
    const handler = () => fetchContacts()
    window.addEventListener('contacts_changed', handler)
    return () => window.removeEventListener('contacts_changed', handler)
  }, [fetchContacts])

  return { contacts, loading, error }
}