/**
 * Einmalige Datenmigration beim Server-Start
 * Behebt inkonsistente Daten aus älteren Versionen
 */
import { Conversation } from '../models/Conversation'
import crypto from 'crypto'

export async function runMigrations(): Promise<void> {
  try {
    // Fix: Gruppen die groupName haben aber isGroup=false
    const result = await Conversation.updateMany(
      {
        $and: [
          { groupName: { $exists: true, $nin: [null, ''] } },
          { $or: [{ isGroup: false }, { isGroup: { $exists: false } }] }
        ]
      },
      { $set: { isGroup: true } }
    )
    if (result.modifiedCount > 0) {
      console.log(`✅ Migration: ${result.modifiedCount} Gruppen-Conversations repariert (isGroup=true)`)
    }

    // Fix: Gruppen ohne admins-Array → ersten Teilnehmer als Admin setzen
    const groupsWithoutAdmin = await Conversation.find({
      isGroup: true,
      $or: [{ admins: { $exists: false } }, { admins: { $size: 0 } }]
    })
    for (const g of groupsWithoutAdmin) {
      if (g.participants.length > 0) {
        g.admins = [g.participants[0]] as any
        await g.save()
      }
    }
    if (groupsWithoutAdmin.length > 0) {
      console.log(`✅ Migration: ${groupsWithoutAdmin.length} Gruppen haben jetzt einen Admin`)
    }

    // Früher bekamen alle Bot-Installationen automatisch Administratorrechte.
    const { default: BotInstallation } = await import('../models/BotInstallation')
    const botPermissionResult = await BotInstallation.updateMany(
      { permissions: 63, permissionsVersion: { $exists: false } },
      { $set: { permissions: 3, permissionsVersion: 2 } }
    )
    if (botPermissionResult.modifiedCount > 0) console.log(`✅ Migration: ${botPermissionResult.modifiedCount} Bot-Installationen auf minimale Rechte gesetzt`)

    // Bestehende Klartext-API-Keys sofort hashen und den Klartext entfernen.
    const { default: DevUser } = await import('../models/DevUser')
    const devUsersWithLegacyKeys = await DevUser.find({ apiKey: { $exists: true, $ne: null } }).select('+apiKey')
    for (const devUser of devUsersWithLegacyKeys) {
      if (!devUser.apiKey) continue
      devUser.apiKeyHash = crypto.createHash('sha256').update(devUser.apiKey).digest('hex')
      devUser.apiKeyPrefix = `${devUser.apiKey.slice(0, 16)}…`
      devUser.apiKey = undefined
      await devUser.save()
    }
    if (devUsersWithLegacyKeys.length > 0) console.log(`✅ Migration: ${devUsersWithLegacyKeys.length} Developer-API-Keys gehasht`)
    // Bestehende User ohne emailVerified als verifiziert markieren
    // (sie haben sich vor Einführung des Features registriert)
    const unverifiedResult = await (await import('../models/User')).User.updateMany(
      { emailVerified: { $exists: false } },
      { $set: { emailVerified: true } }
    )
    if (unverifiedResult.modifiedCount > 0) {
      console.log(`✅ Migration: ${unverifiedResult.modifiedCount} bestehende User als E-Mail-verifiziert markiert`)
    }
    // Bestehende User ohne Identität → automatisch Privat-Identität erstellen
    try {
      const { User } = await import('../models/User')
      const { Identity } = await import('../models/Identity')
      const usersWithoutIdentity = await User.find({ identityCount: { $in: [0, null, undefined] } })
      let identityCount = 0
      for (const u of usersWithoutIdentity) {
        const existing = await Identity.findOne({ userId: u._id })
        if (!existing) {
          const identity = await Identity.create({
            userId:    u._id,
            type:      'private',
            uin:       u.uin,
            username:  u.username,
            isDefault: true,
            isActive:  true,
            settings:  { notifications: true, newChatLimit: 100 },
          })
          await User.findByIdAndUpdate(u._id, {
            activeIdentityId: identity._id,
            identityCount: 1,
          })
          identityCount++
        }
      }
      if (identityCount > 0) {
        console.log(`✅ Migration: ${identityCount} bestehende User haben jetzt eine Privat-Identität`)
      }
    } catch (_ie) {
      console.error('Identity-Migration Fehler:', _ie)
    }

    // Bestehende Conversations ohne identityParticipants befüllen
    try {
      const { Conversation } = await import('../models/Conversation')
      const { Identity } = await import('../models/Identity')
      
      const convs = await Conversation.find({
        $or: [
          { identityParticipants: { $exists: false } },
          { identityParticipants: { $size: 0 } }
        ]
      }).limit(1000)

      let convFixed = 0
      for (const conv of convs) {
        if (!conv.isGroup && conv.participants.length > 0) {
          const identityIds = []
          for (const userId of conv.participants) {
            const ident = await Identity.findOne({ userId, isDefault: true })
            if (ident) identityIds.push(ident._id)
          }
          if (identityIds.length > 0) {
            (conv as any).identityParticipants = identityIds
            await conv.save()
            convFixed++
          }
        }
      }
      if (convFixed > 0) {
        console.log(`✅ Migration: ${convFixed} Conversations mit Identity verknüpft`)
      }
    } catch (_ce) {
      console.error('Conversation-Identity Migration Fehler:', _ce)
    }

    // Bestehende Kontakte ohne identityId → der Default-Identity des Owners zuordnen
    try {
      const { Contact } = await import('../models/Contact')
      const { Identity } = await import('../models/Identity')
      const contactsWithoutIdentity = await Contact.find({
        identityId: { $exists: false }
      }).limit(5000)

      let contactFixed = 0
      for (const c of contactsWithoutIdentity) {
        const ident = await Identity.findOne({ userId: c.owner, isDefault: true })
        if (ident) {
          await Contact.findByIdAndUpdate(c._id, { identityId: ident._id })
          contactFixed++
        }
      }
      if (contactFixed > 0) {
        console.log(`✅ Migration: ${contactFixed} Kontakte der Default-Identity zugeordnet`)
      }
    } catch (_ce) {
      console.error('Contact-Identity Migration Fehler:', _ce)
    }

  } catch (err) {
    console.error('Migration Fehler (nicht kritisch):', err)
  }
}
