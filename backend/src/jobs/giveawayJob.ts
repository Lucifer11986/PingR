import cron from 'node-cron'
import Giveaway from '../models/Giveaway'
import Message from '../models/Message'
import { getIO } from '../socket/socketServer'
import { triggerGiveawayEvent } from '../utils/webhookTrigger'

/**
 * Wähle Random Winner aus eligible participants
 */
function selectWinners(participants: any[], count: number): string[] {
  const eligible = participants.filter(p => p && (p.eligible !== false))
  
  if (eligible.length === 0) {
    return []
  }

  const winners: string[] = []
  const pool = [...eligible]

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const randomIndex = Math.floor(Math.random() * pool.length)
    const winner = pool.splice(randomIndex, 1)[0]
    winners.push((winner.userId || winner).toString())
  }

  return winners
}

/**
 * Check Giveaways - Läuft jede Minute
 */
async function checkGiveaways() {
  try {
    const now = new Date()

    // Finde alle aktiven Giveaways die beendet sein sollten
    const endedGiveaways = await Giveaway.find({
      status: 'active',
      endsAt: { $lte: now }
    })

    if (endedGiveaways.length === 0) {
      return
    }

    console.log(`🎉 [GIVEAWAY-JOB] ${endedGiveaways.length} Giveaway(s) ended`)

    for (const giveaway of endedGiveaways) {
      try {
        // 1. Wähle Gewinner
        const winnerIds = selectWinners(giveaway.participants, giveaway.winnersCount)

        if (winnerIds.length === 0) {
          console.log(`⚠️ [GIVEAWAY-JOB] No eligible participants for ${giveaway.giveawayId}`)
          
          // Update Giveaway
          giveaway.status = 'ended'
          await giveaway.save()

          // Update Message
          if (giveaway.messageId) {
            await Message.findByIdAndUpdate(giveaway.messageId, {
              content: `🎉 **GIVEAWAY BEENDET!** 🎉\n\n**Preis:** ${giveaway.prize}\n\n❌ Keine berechtigten Teilnehmer!`
            })
          }

          // Socket Event
          const io = getIO()
          io.to(`conv:${giveaway.conversationId}`).emit('giveaway_ended', {
            giveawayId: giveaway._id,
            winners: [],
            noWinners: true
          })

          continue
        }

        // 2. Update Giveaway
        giveaway.winners = winnerIds as any
        giveaway.status = 'ended'
        await giveaway.save()

        // 3. Populate Winners
        await giveaway.populate('winners', 'username avatar')

        // 4. Update Message
        if (giveaway.messageId) {
          const winnerNames = (giveaway.winners as any[])
            .map((w: any) => `@${w.username}`)
            .join(', ')

          await Message.findByIdAndUpdate(giveaway.messageId, {
            content: `🎉 **GIVEAWAY BEENDET!** 🎉\n\n**Preis:** ${giveaway.prize}\n\n🎊 **Gewinner:** ${winnerNames}\n\n**Teilnehmer:** ${giveaway.participants.length}`
          })
        }

        // 5. Socket Event
        const io = getIO()
        io.to(`conv:${giveaway.conversationId}`).emit('giveaway_ended', {
          giveawayId: giveaway._id,
          winners: giveaway.winners,
          prize: giveaway.prize
        })

        // 6. Webhook Trigger
        await triggerGiveawayEvent(giveaway.botId, 'end', giveaway)

        console.log(`✅ [GIVEAWAY-JOB] ${giveaway.giveawayId} ended - Winners: ${winnerIds.length}`)

      } catch (error) {
        console.error(`❌ [GIVEAWAY-JOB] Error ending ${giveaway.giveawayId}:`, error)
      }
    }

  } catch (error) {
    console.error('❌ [GIVEAWAY-JOB] Check error:', error)
  }
}

/**
 * Start Giveaway Cron Job
 */
export function startGiveawayJob() {
  console.log('🎉 [GIVEAWAY-JOB] Starting...')

  // Run every minute
  cron.schedule('* * * * *', () => {
    checkGiveaways().catch(err => {
      console.error('❌ [GIVEAWAY-JOB] Unhandled error:', err)
    })
  })

  console.log('✅ [GIVEAWAY-JOB] Started - läuft jede Minute')
}
