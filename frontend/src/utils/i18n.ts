/**
 * PingR i18n System
 * Unterstützte Sprachen: DE, EN, FR, TR
 */

export type Lang = 'de' | 'en' | 'fr' | 'tr'

export const translations = {
  de: {
    // Navigation
    chats:          'Chats',
    contacts:       'Kontakte',
    groups:         'Gruppen',
    settings:       'Einstellungen',
    search:         'Suchen',
    bookmarks:      'Lesezeichen',
    // Chat
    typeMessage:    'Nachricht eingeben…',
    sendMessage:    'Nachricht senden',
    noConvSelected: 'Wähle ein Gespräch',
    noConvHint:     'oder füge einen Kontakt hinzu',
    online:         'Online',
    offline:        'Offline',
    away:           'Abwesend',
    typing:         'schreibt…',
    // Nachrichten
    edited:         '(bearbeitet)',
    deleted:        'Nachricht gelöscht',
    voiceMsg:       'Sprachnachricht',
    file:           'Datei',
    yesterday:      'Gestern',
    today:          'Heute',
    // Aktionen
    reply:          'Antworten',
    edit:           'Bearbeiten',
    delete:         'Löschen',
    forward:        'Weiterleiten',
    copy:           'Kopieren',
    report:         'Melden',
    react:          'Reagieren',
    bookmark:       'Lesezeichen',
    // Gruppen
    createGroup:    'Gruppe erstellen',
    joinGroup:      'Beitreten',
    discoverGroups: 'Entdecken',
    groupSettings:  'Gruppeneinstellungen',
    members:        'Mitglieder',
    addMember:      'Mitglied hinzufügen',
    leaveGroup:     'Gruppe verlassen',
    deleteGroup:    'Gruppe löschen',
    popularGroups:  'Beliebte Gruppen',
    noGroupsFound:  'Keine Gruppen gefunden',
    searchGroups:   'Gruppenname suchen…',
    // Kontakte
    addContact:     'Kontakt hinzufügen',
    removeContact:  'Kontakt entfernen',
    blockUser:      'Nutzer blockieren',
    unblockUser:    'Entsperren',
    removeConfirm:  'Kontakt wirklich entfernen?',
    // Einstellungen
    profile:        'Profil',
    status:         'Status',
    privacy:        'Privatsphäre',
    sound:          'Sound',
    twofa:          '2FA',
    loginHistory:   'Logins',
    password:       'Passwort',
    account:        'Konto',
    language:       'Sprache',
    save:           'Speichern',
    saved:          'Gespeichert!',
    cancel:         'Abbrechen',
    // Fehler
    error:          'Fehler',
    networkError:   'Netzwerkfehler',
    tryAgain:       'Erneut versuchen',
    // Upload
    fileUpload:     'Datei (max. 50 MB)',
    uploading:      'Lädt hoch…',
    // Umfragen
    createPoll:     'Umfrage erstellen',
    pollQuestion:   'Frage',
    pollOptions:    'Optionen',
    addOption:      '+ Option hinzufügen',
    votes:          'Stimmen',
    vote:           'Abstimmen',
    pollEnded:      'Umfrage beendet',
    // Auth
    logout:         'Abmelden',
    logoutConfirm:  'Wirklich abmelden?',
  },
  en: {
    chats:          'Chats',
    contacts:       'Contacts',
    groups:         'Groups',
    settings:       'Settings',
    search:         'Search',
    bookmarks:      'Bookmarks',
    typeMessage:    'Type a message…',
    sendMessage:    'Send message',
    noConvSelected: 'Select a conversation',
    noConvHint:     'or add a contact',
    online:         'Online',
    offline:        'Offline',
    away:           'Away',
    typing:         'is typing…',
    edited:         '(edited)',
    deleted:        'Message deleted',
    voiceMsg:       'Voice message',
    file:           'File',
    yesterday:      'Yesterday',
    today:          'Today',
    reply:          'Reply',
    edit:           'Edit',
    delete:         'Delete',
    forward:        'Forward',
    copy:           'Copy',
    report:         'Report',
    react:          'React',
    bookmark:       'Bookmark',
    createGroup:    'Create group',
    joinGroup:      'Join',
    discoverGroups: 'Discover',
    groupSettings:  'Group settings',
    members:        'Members',
    addMember:      'Add member',
    leaveGroup:     'Leave group',
    deleteGroup:    'Delete group',
    popularGroups:  'Popular groups',
    noGroupsFound:  'No groups found',
    searchGroups:   'Search group name…',
    addContact:     'Add contact',
    removeContact:  'Remove contact',
    blockUser:      'Block user',
    unblockUser:    'Unblock',
    removeConfirm:  'Remove contact?',
    profile:        'Profile',
    status:         'Status',
    privacy:        'Privacy',
    sound:          'Sound',
    twofa:          '2FA',
    loginHistory:   'Logins',
    password:       'Password',
    account:        'Account',
    language:       'Language',
    save:           'Save',
    saved:          'Saved!',
    cancel:         'Cancel',
    error:          'Error',
    networkError:   'Network error',
    tryAgain:       'Try again',
    fileUpload:     'File (max. 50 MB)',
    uploading:      'Uploading…',
    createPoll:     'Create poll',
    pollQuestion:   'Question',
    pollOptions:    'Options',
    addOption:      '+ Add option',
    votes:          'votes',
    vote:           'Vote',
    pollEnded:      'Poll ended',
    logout:         'Sign out',
    logoutConfirm:  'Sign out?',
  },
  fr: {
    chats:          'Discussions',
    contacts:       'Contacts',
    groups:         'Groupes',
    settings:       'Paramètres',
    search:         'Rechercher',
    bookmarks:      'Favoris',
    typeMessage:    'Écrire un message…',
    sendMessage:    'Envoyer',
    noConvSelected: 'Choisir une conversation',
    noConvHint:     'ou ajouter un contact',
    online:         'En ligne',
    offline:        'Hors ligne',
    away:           'Absent',
    typing:         'écrit…',
    edited:         '(modifié)',
    deleted:        'Message supprimé',
    voiceMsg:       'Message vocal',
    file:           'Fichier',
    yesterday:      'Hier',
    today:          "Aujourd'hui",
    reply:          'Répondre',
    edit:           'Modifier',
    delete:         'Supprimer',
    forward:        'Transférer',
    copy:           'Copier',
    report:         'Signaler',
    react:          'Réagir',
    bookmark:       'Favori',
    createGroup:    'Créer un groupe',
    joinGroup:      'Rejoindre',
    discoverGroups: 'Découvrir',
    groupSettings:  'Paramètres du groupe',
    members:        'Membres',
    addMember:      'Ajouter un membre',
    leaveGroup:     'Quitter le groupe',
    deleteGroup:    'Supprimer le groupe',
    popularGroups:  'Groupes populaires',
    noGroupsFound:  'Aucun groupe trouvé',
    searchGroups:   'Chercher un groupe…',
    addContact:     'Ajouter un contact',
    removeContact:  'Supprimer le contact',
    blockUser:      'Bloquer',
    unblockUser:    'Débloquer',
    removeConfirm:  'Supprimer ce contact?',
    profile:        'Profil',
    status:         'Statut',
    privacy:        'Confidentialité',
    sound:          'Son',
    twofa:          'Double auth.',
    loginHistory:   'Connexions',
    password:       'Mot de passe',
    account:        'Compte',
    language:       'Langue',
    save:           'Enregistrer',
    saved:          'Enregistré!',
    cancel:         'Annuler',
    error:          'Erreur',
    networkError:   'Erreur réseau',
    tryAgain:       'Réessayer',
    fileUpload:     'Fichier (max. 50 Mo)',
    uploading:      'Envoi…',
    createPoll:     'Créer un sondage',
    pollQuestion:   'Question',
    pollOptions:    'Options',
    addOption:      '+ Ajouter une option',
    votes:          'votes',
    vote:           'Voter',
    pollEnded:      'Sondage terminé',
    logout:         'Se déconnecter',
    logoutConfirm:  'Se déconnecter?',
  },
  tr: {
    chats:          'Sohbetler',
    contacts:       'Kişiler',
    groups:         'Gruplar',
    settings:       'Ayarlar',
    search:         'Ara',
    bookmarks:      'Yer imleri',
    typeMessage:    'Mesaj yaz…',
    sendMessage:    'Gönder',
    noConvSelected: 'Bir konuşma seç',
    noConvHint:     'veya kişi ekle',
    online:         'Çevrimiçi',
    offline:        'Çevrimdışı',
    away:           'Uzakta',
    typing:         'yazıyor…',
    edited:         '(düzenlendi)',
    deleted:        'Mesaj silindi',
    voiceMsg:       'Sesli mesaj',
    file:           'Dosya',
    yesterday:      'Dün',
    today:          'Bugün',
    reply:          'Yanıtla',
    edit:           'Düzenle',
    delete:         'Sil',
    forward:        'İlet',
    copy:           'Kopyala',
    report:         'Bildir',
    react:          'Tepki ver',
    bookmark:       'Yer imi',
    createGroup:    'Grup oluştur',
    joinGroup:      'Katıl',
    discoverGroups: 'Keşfet',
    groupSettings:  'Grup ayarları',
    members:        'Üyeler',
    addMember:      'Üye ekle',
    leaveGroup:     'Gruptan ayrıl',
    deleteGroup:    'Grubu sil',
    popularGroups:  'Popüler gruplar',
    noGroupsFound:  'Grup bulunamadı',
    searchGroups:   'Grup adı ara…',
    addContact:     'Kişi ekle',
    removeContact:  'Kişiyi kaldır',
    blockUser:      'Engelle',
    unblockUser:    'Engeli kaldır',
    removeConfirm:  'Kişi kaldırılsın mı?',
    profile:        'Profil',
    status:         'Durum',
    privacy:        'Gizlilik',
    sound:          'Ses',
    twofa:          '2FA',
    loginHistory:   'Girişler',
    password:       'Şifre',
    account:        'Hesap',
    language:       'Dil',
    save:           'Kaydet',
    saved:          'Kaydedildi!',
    cancel:         'İptal',
    error:          'Hata',
    networkError:   'Ağ hatası',
    tryAgain:       'Tekrar dene',
    fileUpload:     'Dosya (maks. 50 MB)',
    uploading:      'Yükleniyor…',
    createPoll:     'Anket oluştur',
    pollQuestion:   'Soru',
    pollOptions:    'Seçenekler',
    addOption:      '+ Seçenek ekle',
    votes:          'oy',
    vote:           'Oy ver',
    pollEnded:      'Anket bitti',
    logout:         'Çıkış yap',
    logoutConfirm:  'Çıkış yapılsın mı?',
  },
} as const

export type TranslationKey = keyof typeof translations['de']

// Sprache aus localStorage oder Browser
export function detectLanguage(): Lang {
  // 1. User hat manuell gesetzt
  const stored = localStorage.getItem('pingr_lang') as Lang
  if (stored && translations[stored]) return stored

  // 2. Browser-Sprache
  const browser = navigator.language.toLowerCase().slice(0, 2) as Lang
  if (translations[browser]) return browser

  // 3. Fallback
  return 'de'
}

// Sprache anhand von Browser-Einstellung erkennen
// DSGVO-konform: kein externer Dienst, keine IP-Übertragung
export async function detectLanguageByIP(): Promise<Lang> {
  // 1. User hat manuell gesetzt → immer Priorität
  const stored = localStorage.getItem('pingr_lang')
  if (stored && translations[stored as Lang]) return stored as Lang

  // 2. Browser-Sprache auswerten (navigator.language)
  const browserLang = navigator.language?.toLowerCase() || ''

  // Sprach-Mapping (nur Browser-Daten, kein externer Dienst)
  if (browserLang.startsWith('de')) return 'de'
  if (browserLang.startsWith('fr')) return 'fr'
  if (browserLang.startsWith('tr')) return 'tr'
  if (browserLang.startsWith('en')) return 'en'

  // 3. Fallback
  return 'de'
}

export function setLanguage(lang: Lang): void {
  localStorage.setItem('pingr_lang', lang)
  window.dispatchEvent(new CustomEvent('language_changed', { detail: lang }))
}

export function t(key: TranslationKey, lang?: Lang): string {
  const l = lang || detectLanguage()
  return translations[l]?.[key] || translations.de[key] || key
}