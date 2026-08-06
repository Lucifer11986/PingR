// /opt/pingr/backend/src/utils/seedNokkiBots.ts
import Bot from '../models/Bot'
import DevUser from '../models/DevUser'
import bcrypt from 'bcrypt'

const NOKKI_BOTS = [
  {
    botId: 'nokki_welcome', name: 'Nokki Welcome Bot', icon: '👋',
    description: 'Begrüßt neue Mitglieder automatisch mit einer personalisierten Nachricht.',
    longDescription: 'Begrüßt jeden neuen Teilnehmer mit einer Willkommensnachricht. Die Nachricht ist frei anpassbar.\n\n**Commands:**\n`/setwelcome Willkommen {name}!` – Nachricht anpassen\n`/welcome` – Manuelle Begrüßung\n`/welcometest` – Vorschau der Begrüßung',
    category: 'moderation', tags: ['willkommen','neu','gruppe'], verified: true, featured: true, isNokki: true,
    permissions: ['send_messages','read_members'],
  },
  {
    botId: 'nokki_reminder', name: 'Nokki Reminder Bot', icon: '⏰',
    description: 'Setzt Erinnerungen in natürlicher Sprache – nie wieder etwas vergessen.',
    longDescription: 'Setze Erinnerungen mit natürlicher Sprache. Der Bot meldet sich zur richtigen Zeit im Chat.\n\n**Commands:**\n`/remind in 5 minuten Meeting` – Erinnerung setzen\n`/remind in 2 stunden Zahnarzt`\n`/remind in 1 tag Geburtstag von Anna`\n`/remindlist` – Aktive Erinnerungen anzeigen',
    category: 'productivity', tags: ['erinnerung','timer','reminder','aufgaben'], verified: true, featured: true, isNokki: true,
    permissions: ['send_messages'],
  },
  {
    botId: 'nokki_stats', name: 'Nokki Stats Bot', icon: '📈',
    description: 'Zeigt Chat-Statistiken: aktivste Mitglieder, Nachrichtenanzahl und mehr.',
    longDescription: 'Analysiert die Gruppenaktivität und zeigt wer am aktivsten schreibt.\n\n**Commands:**\n`/stats` – Gruppen-Übersicht\n`/topusers` – Aktivste Mitglieder (Top 5)\n`/activity` – Aktivitätsbericht',
    category: 'info', tags: ['statistik','analyse','aktivität','charts'], verified: true, featured: false, isNokki: true,
    permissions: ['read_messages','read_members'],
  },
  {
    botId: 'nokki_moderation', name: 'Nokki Mod Bot', icon: '🛡️',
    description: 'Auto-Moderation: Spam-Filter, Verwarnungen, Anti-Flood und Slow Mode.',
    longDescription: 'Schützt deine Gruppe automatisch vor Spam, Flood und unerwünschten Inhalten.\n\n**Commands:**\n`/warn @user Grund` – Verwarnen (max. 3)\n`/warncount @user` – Verwarnungen prüfen\n`/clearwarns @user` – Verwarnungen zurücksetzen\n`/slowmode 30` – Slow Mode in Sekunden\n`/antispam` – Status anzeigen\n\n**Auto-Trigger:**\nSpam-Keywords erkennen, Flood-Schutz, Slow Mode erzwingen',
    category: 'moderation', tags: ['moderation','spam','schutz','filter'], verified: true, featured: false, isNokki: true,
    permissions: ['send_messages','read_messages','kick_members'],
  },
  {
    botId: 'nokki_fun', name: 'Nokki Fun Bot', icon: '🎲',
    description: 'Würfeln, Münze werfen, Witze, Magic 8-Ball und Schere-Stein-Papier.',
    longDescription: 'Bringt Spaß und Abwechslung in jede Gruppe!\n\n**Commands:**\n`/dice [6]` – Würfeln (W4 bis W100)\n`/flip` – Münze werfen\n`/joke` – Zufälliger Witz\n`/8ball Frage?` – Magic 8-Ball\n`/rps stein` – Schere-Stein-Papier\n`/choose A | B | C` – Zufällig entscheiden',
    category: 'fun', tags: ['spiele','würfeln','witze','spaß','minispiele'], verified: true, featured: false, isNokki: true,
    permissions: ['send_messages'],
  },
  {
    botId: 'nokki_news', name: 'Nokki News Bot', icon: '📰',
    description: 'Aktuelle Headlines zu Tech, Sport, Wetter und Gaming direkt im Chat.',
    longDescription: 'Hält deine Gruppe mit aktuellen Headlines auf dem Laufenden.\n\n**Commands:**\n`/news [thema]` – Aktuelle Headline abrufen\n`/setnews tech sport` – Themen für tägliche News wählen\n`/newshelp` – Alle Befehle anzeigen\n\n**Themen:** tech, sport, wetter, gaming',
    category: 'info', tags: ['nachrichten','news','headlines','rss'], verified: true, featured: false, isNokki: true,
    permissions: ['send_messages'],
  },
  {
    botId: 'nokki_weather', name: 'Nokki Weather Bot', icon: '☀️',
    description: 'Aktuelles Wetter und Vorhersagen für jede Stadt direkt im Chat.',
    longDescription: 'Zeigt das aktuelle Wetter und 3-Tages-Vorhersagen für beliebige Städte.\n\n**Commands:**\n`/wetter Berlin` – Aktuelles Wetter\n`/wetter Berlin morgen` – Vorhersage\n`/wetter Berlin 3tage` – 3-Tages-Übersicht\n`/setcity Berlin` – Standardstadt setzen\n`/wetter` – Wetter für die Standardstadt\n\n**Auto-Trigger:**\nTägliche Morgen-Wetter-Updates wenn Standardstadt gesetzt.',
    category: 'utility', tags: ['wetter','weather','vorhersage','temperatur'], verified: true, featured: true, isNokki: true,
    permissions: ['send_messages'],
  },
  {
    botId: 'nokki_music', name: 'Nokki Music Bot', icon: '🎵',
    description: 'Sammelt YouTube-Links zu einer Gruppen-Playlist und verwaltet Musikwünsche.',
    longDescription: 'Verwaltet eine gemeinsame Musik-Playlist für die Gruppe. Links werden gesammelt und angezeigt.\n\n**Commands:**\n`/add https://youtube.com/...` – Song zur Playlist hinzufügen\n`/playlist` – Aktuelle Playlist anzeigen\n`/np` – Aktuell geteiltester Song\n`/clear` – Playlist leeren (nur Admins)\n`/top` – Meistgeteilte Songs\n\n**Auto-Trigger:**\nYouTube-Links werden automatisch erkannt und zur Playlist hinzugefügt.',
    category: 'fun', tags: ['musik','playlist','youtube','songs'], verified: true, featured: true, isNokki: true,
    permissions: ['send_messages','read_messages'],
  },
  {
    botId: 'nokki_quote', name: 'Nokki Quote Bot', icon: '📝',
    description: 'Speichert unvergessliche Zitate aus dem Chat und zeigt sie auf Abruf.',
    longDescription: 'Bewahre die besten Momente der Gruppe für immer auf.\n\n**Commands:**\n`/quote @user Das war großartig!` – Zitat speichern\n`/quotes` – Zufälliges Zitat anzeigen\n`/quotes @user` – Zitate eines Nutzers\n`/quotelist` – Alle Zitate (nummeriert)\n`/deletequote 3` – Zitat Nr. 3 löschen\n\n**Auto-Trigger:**\nReagiere mit 💬 auf eine Nachricht um sie als Zitat zu speichern.',
    category: 'fun', tags: ['zitate','quotes','lustig','erinnerungen'], verified: true, featured: false, isNokki: true,
    permissions: ['send_messages','read_messages'],
  },
  {
    botId: 'nokki_translate', name: 'Nokki Translate Bot', icon: '🌍',
    description: 'Übersetzt Nachrichten automatisch in über 20 Sprachen.',
    longDescription: 'Übersetzt Nachrichten direkt im Chat in beliebige Sprachen.\n\n**Commands:**\n`/translate de Hallo wie geht es dir` – Ins Deutsche übersetzen\n`/translate en Guten Morgen` – Ins Englische\n`/translate es Wie geht es dir` – Ins Spanische\n`/setlang de` – Standardsprache setzen\n`/languages` – Alle Sprachen anzeigen\n\n**Auto-Trigger:**\nNachrichten mit 🌍 Reaktion werden automatisch übersetzt.',
    category: 'utility', tags: ['übersetzen','translate','sprachen','international'], verified: true, featured: false, isNokki: true,
    permissions: ['send_messages','read_messages'],
  },
]

export async function seedNokkiBots() {
  try {
    let nokkiDev = await (DevUser as any).findOne({ username: 'nokki_system' })
    if (!nokkiDev) {
      const pw = await bcrypt.hash('nokki_internal_' + Date.now(), 10)
      nokkiDev = await (DevUser as any).create({
        username: 'nokki_system', email: 'bots@nokki.internal',
        password: pw, verified: true, isDeveloper: true,
        apiKey: 'nokki_system_' + Math.random().toString(36).slice(2) + Date.now(),
      })
      console.log('✅ [BotStore] Nokki System-Account erstellt')
    }

    // Alte Poll/Giveaway Bots deaktivieren falls vorhanden
    await Bot.updateMany(
      { botId: { $in: ['nokki_poll', 'nokki_giveaway'] } },
      { $set: { status: 'inactive' } }
    )

    let created = 0, updated = 0
    for (const data of NOKKI_BOTS) {
      const exists = await Bot.findOne({ botId: data.botId })
      if (!exists) {
        await Bot.create({ ...data, ownerId: nokkiDev._id, status: 'active' })
        created++
      } else {
        await Bot.findOneAndUpdate({ botId: data.botId }, { $set: { ...data, status: 'active' } })
        updated++
      }
    }
    console.log(`✅ [BotStore] ${created} Bots erstellt, ${updated} aktualisiert`)
  } catch (err) {
    console.error('❌ [BotStore] Seed-Fehler:', err)
  }
}