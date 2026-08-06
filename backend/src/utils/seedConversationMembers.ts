import ConversationMember from '../models/ConversationMember'

/**
 * Seed Initial Conversation Members with Roles
 * Run once to setup initial roles
 */
export async function seedConversationMembers() {
  try {
    console.log('🌱 [SEED] Seeding conversation members...')
    
    // Lucifer als Admin in Team Chat
    const luciferTeamChat = await ConversationMember.findOneAndUpdate(
      {
        conversationId: '69d8f24104a465c12897b8fe',  // Team Chat
        userId: '69d8a56f59ddd3032a9fd8c7'  // Lucifer
      },
      {
        roles: ['owner', 'admin'],  // Owner + Admin Rechte
        isActive: true,
        joinedAt: new Date('2024-01-01')
      },
      { upsert: true, new: true }
    )
    
    console.log('✅ [SEED] Lucifer ist jetzt Admin in Team Chat!')
    
    // Weitere Members können hier hinzugefügt werden
    // z.B. andere User als 'moderator' oder 'member'
    
  } catch (error) {
    console.error('❌ [SEED] Error seeding conversation members:', error)
  }
}