import { useState, useEffect, useCallback } from 'react'
import { Lang, TranslationKey, detectLanguage, t, setLanguage, detectLanguageByIP } from '../utils/i18n'

export function useI18n() {
  // Manuelle Auswahl hat Vorrang vor automatischer IP-Erkennung
  const getInitialLang = (): Lang => {
    const manual = localStorage.getItem('pingr_lang_manual') as Lang | null
    if (manual) return manual
    return detectLanguage()
  }

  const [lang, setLang] = useState<Lang>(getInitialLang)

  useEffect(() => {
    // IP-Erkennung nur wenn der Nutzer noch NIE manuell eine Sprache gewählt hat
    const hasManual = localStorage.getItem('pingr_lang_manual')
    if (!hasManual) {
      detectLanguageByIP().then(detected => {
        setLang(detected)
      })
    }

    const handler = (e: Event) => {
      setLang((e as CustomEvent).detail as Lang)
    }
    window.addEventListener('language_changed', handler)
    return () => window.removeEventListener('language_changed', handler)
  }, [])

  const translate = useCallback((key: TranslationKey) => t(key, lang), [lang])

  const changeLang = useCallback((newLang: Lang) => {
    // Manuelle Auswahl persistent in localStorage speichern
    localStorage.setItem('pingr_lang_manual', newLang)
    setLanguage(newLang)
    setLang(newLang)
  }, [])

  return { lang, tr: translate, changeLang }
}