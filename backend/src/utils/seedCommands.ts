import BotCommand, { BotPermission } from '../models/BotCommand'

export const PREDEFINED_COMMANDS = [
  // ========================================
  // MODERATION COMMANDS
  // ========================================
  {
    commandId: 'ban',
    name: 'ban',
    description: 'Ban einen User permanent oder temporär',
    category: 'moderation',
    requiredPermissions: [BotPermission.MANAGE_MEMBERS],
    requiredRoles: ['admin', 'moderator'],
    options: [
      { name: 'user', type: 'user', description: 'User zum Bannen', required: true },
      { name: 'reason', type: 'string', description: 'Ban-Grund', required: false },
      { name: 'duration', type: 'number', description: 'Dauer in Minuten (0 = permanent)', required: false, default: 0 }
    ]
  },
  {
    commandId: 'kick',
    name: 'kick',
    description: 'Kicke einen User aus der Conversation',
    category: 'moderation',
    requiredPermissions: [BotPermission.MANAGE_MEMBERS],
    requiredRoles: ['admin', 'moderator'],
    options: [
      { name: 'user', type: 'user', description: 'User zum Kicken', required: true },
      { name: 'reason', type: 'string', description: 'Kick-Grund', required: false }
    ]
  },
  {
    commandId: 'mute',
    name: 'mute',
    description: 'Mute einen User temporär',
    category: 'moderation',
    requiredPermissions: [BotPermission.MANAGE_MEMBERS],
    requiredRoles: ['admin', 'moderator'],
    options: [
      { name: 'user', type: 'user', description: 'User zum Muten', required: true },
      { name: 'duration', type: 'number', description: 'Dauer in Minuten', required: true },
      { name: 'reason', type: 'string', description: 'Mute-Grund', required: false }
    ]
  },
  {
    commandId: 'warn',
    name: 'warn',
    description: 'Verwarne einen User',
    category: 'moderation',
    requiredPermissions: [BotPermission.MANAGE_MEMBERS],
    requiredRoles: ['admin', 'moderator'],
    options: [
      { name: 'user', type: 'user', description: 'User zum Verwarnen', required: true },
      { name: 'reason', type: 'string', description: 'Verwarnung-Grund', required: true }
    ]
  },
  {
    commandId: 'timeout',
    name: 'timeout',
    description: 'Gib einem User einen Timeout',
    category: 'moderation',
    requiredPermissions: [BotPermission.MANAGE_MEMBERS],
    requiredRoles: ['admin', 'moderator'],
    options: [
      { name: 'user', type: 'user', description: 'User für Timeout', required: true },
      { name: 'duration', type: 'number', description: 'Dauer in Minuten', required: true }
    ]
  },
  {
    commandId: 'purge',
    name: 'purge',
    description: 'Lösche mehrere Nachrichten auf einmal',
    category: 'moderation',
    requiredPermissions: [BotPermission.MANAGE_MESSAGES],
    requiredRoles: ['admin', 'moderator'],
    options: [
      { name: 'amount', type: 'number', description: 'Anzahl zu löschender Nachrichten', required: true }
    ]
  },

  // ========================================
  // FUN/ENGAGEMENT COMMANDS
  // ========================================
  {
    commandId: 'giveaway',
    name: 'giveaway',
    description: 'Öffne Giveaway Management',
    category: 'fun',
    requiredPermissions: [BotPermission.SEND_MESSAGES],
    requiredRoles: ['admin', 'moderator', 'event-manager'],
    interactive: true,
    options: []  // Modal übernimmt alle Eingaben
  },
  {
    commandId: 'announce',
    name: 'announce',
    description: 'Sende eine formatierte Ankündigung',
    category: 'fun',
    requiredPermissions: [BotPermission.SEND_MESSAGES],
    requiredRoles: ['admin', 'moderator'],
    options: [
      { name: 'title', type: 'string', description: 'Ankündigungs-Titel', required: true },
      { name: 'message', type: 'string', description: 'Ankündigungs-Text', required: true },
      { name: 'ping', type: 'boolean', description: '@everyone pingen?', required: false, default: false }
    ]
  },
  {
    commandId: 'reaction_role',
    name: 'reaction-role',
    description: 'Setup Reaction-Role System',
    category: 'fun',
    requiredPermissions: [BotPermission.MANAGE_MEMBERS],
    requiredRoles: ['admin'],
    interactive: true,
    options: [
      { name: 'message', type: 'string', description: 'Message Text', required: true }
    ]
  },
  {
    commandId: 'quote',
    name: 'quote',
    description: 'Teile ein Zitat von einem User',
    category: 'fun',
    requiredPermissions: [BotPermission.SEND_MESSAGES],
    options: [
      { name: 'user', type: 'user', description: 'User zum Zitieren', required: true },
      { name: 'text', type: 'string', description: 'Zitat-Text', required: true }
    ]
  },

  // ========================================
  // UTILITY COMMANDS
  // ========================================
  {
    commandId: 'stats',
    name: 'stats',
    description: 'Zeige Bot & Server Statistiken',
    category: 'utility',
    requiredPermissions: [BotPermission.READ_MESSAGES],
    options: [
      { name: 'type', type: 'string', description: 'Stats-Typ', required: false,
        choices: [
          { name: 'Bot Stats', value: 'bot' },
          { name: 'Server Stats', value: 'server' },
          { name: 'User Stats', value: 'user' }
        ]
      }
    ]
  },
  {
    commandId: 'info',
    name: 'info',
    description: 'Zeige Info über User oder Bot',
    category: 'utility',
    requiredPermissions: [BotPermission.READ_MESSAGES],
    options: [
      { name: 'user', type: 'user', description: 'User Info', required: false }
    ]
  },
  {
    commandId: 'remind',
    name: 'remind',
    description: 'Setze eine Erinnerung',
    category: 'utility',
    requiredPermissions: [BotPermission.SEND_MESSAGES],
    options: [
      { name: 'time', type: 'number', description: 'Zeit in Minuten', required: true },
      { name: 'message', type: 'string', description: 'Erinnerung-Text', required: true }
    ]
  },
  {
    commandId: 'avatar',
    name: 'avatar',
    description: 'Zeige User Avatar in groß',
    category: 'utility',
    requiredPermissions: [BotPermission.READ_MESSAGES],
    options: [
      { name: 'user', type: 'user', description: 'User', required: false }
    ]
  },

  // ========================================
  // ADMIN COMMANDS
  // ========================================
  {
    commandId: 'setup',
    name: 'setup',
    description: 'Konfiguriere Bot-Einstellungen',
    category: 'admin',
    requiredPermissions: [BotPermission.ADMINISTRATOR],
    requiredRoles: ['admin'],
    interactive: true,
    options: [
      { name: 'setting', type: 'string', description: 'Einstellung', required: true,
        choices: [
          { name: 'Welcome Message', value: 'welcome' },
          { name: 'Mod Log Channel', value: 'modlog' },
          { name: 'Auto-Role', value: 'autorole' },
          { name: 'Command Prefix', value: 'prefix' }
        ]
      },
      { name: 'value', type: 'string', description: 'Wert', required: true }
    ]
  },
  {
    commandId: 'permissions',
    name: 'permissions',
    description: 'Verwalte Bot Permissions',
    category: 'admin',
    requiredPermissions: [BotPermission.ADMINISTRATOR],
    requiredRoles: ['admin'],
    options: [
      { name: 'action', type: 'string', description: 'Aktion', required: true,
        choices: [
          { name: 'View', value: 'view' },
          { name: 'Grant', value: 'grant' },
          { name: 'Revoke', value: 'revoke' }
        ]
      }
    ]
  }
]

export async function seedCommands() {
  try {
    console.log('🌱 [SEED] Seeding predefined commands...')
    
    for (const cmd of PREDEFINED_COMMANDS) {
      await BotCommand.findOneAndUpdate(
        { commandId: cmd.commandId },
        cmd,
        { upsert: true, new: true }
      )
    }
    
    console.log(`✅ [SEED] ${PREDEFINED_COMMANDS.length} commands seeded!`)
  } catch (error) {
    console.error('❌ [SEED] Error seeding commands:', error)
  }
}