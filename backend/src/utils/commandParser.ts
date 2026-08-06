import BotCommand from '../models/BotCommand'
import Bot from '../models/Bot'
import BotInstallation from '../models/BotInstallation'
import { BotPermission } from '../models/BotCommand'

export interface ParsedCommand {
  name: string
  args: Record<string, any>
  raw: string
}

export interface CommandContext {
  botId: string
  conversationId: string
  channelId?: string
  userId: string
  username: string
  userRoles?: string[]
  message: string
}

/**
 * Parsed einen Command String
 * Beispiel: "/giveaway prize:PS5 duration:60 winners:1"
 */
export function parseCommand(message: string): ParsedCommand | null {
  if (!message.startsWith('/')) {
    return null
  }

  const parts = message.slice(1).trim().split(/\s+/)
  const name = parts[0].toLowerCase()
  const args: Record<string, any> = {}

  // Parse arguments (key:value format)
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    
    if (part.includes(':')) {
      const [key, ...valueParts] = part.split(':')
      const value = valueParts.join(':')
      
      // Try parse number
      if (!isNaN(Number(value))) {
        args[key] = Number(value)
      } else if (value === 'true' || value === 'false') {
        args[key] = value === 'true'
      } else {
        args[key] = value
      }
    } else {
      // Positional argument
      args[`arg${i}`] = part
    }
  }

  return { name, args, raw: message }
}

/**
 * Prüft ob Bot das Command ausführen darf
 */
export async function canExecuteCommand(
  command: any,
  context: CommandContext
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // 1. Prüfe ob Bot existiert
    const bot = await Bot.findOne({ botId: context.botId })
    if (!bot) {
      return { allowed: false, reason: 'Bot nicht gefunden' }
    }

    // 2. Prüfe ob Bot installiert ist
    const installation = await BotInstallation.findOne({
      botId: context.botId,
      channelId: context.conversationId,
      active: true
    })
    
    console.log('🔍 [INSTALLATION-CHECK]', {
      found: !!installation,
      botId: context.botId,
      channelId: context.conversationId,
      installationId: installation?._id,
      permissions: installation?.permissions,
      fullDoc: installation ? JSON.stringify(installation) : 'null'
    })
    
    if (!installation) {
      return { allowed: false, reason: 'Bot nicht in dieser Conversation installiert' }
    }

    // 3. Prüfe Bot Permissions
    if (command.requiredPermissions && command.requiredPermissions.length > 0) {
      console.log('🔍 [PERMISSION-CHECK]', {
        commandName: command.name,
        requiredPerms: command.requiredPermissions,
        installationPerms: installation.permissions,
        installationPermsType: typeof installation.permissions,
        hasAdminFlag: installation.permissions ? (installation.permissions & BotPermission.ADMINISTRATOR) === BotPermission.ADMINISTRATOR : 'undefined'
      })
      
      const hasPermission = command.requiredPermissions.some((perm: number) => {
        // Check if bot has ADMINISTRATOR or specific permission
        const hasAdmin = (installation.permissions & BotPermission.ADMINISTRATOR) === BotPermission.ADMINISTRATOR
        const hasSpecific = (installation.permissions & perm) === perm
        
        console.log('🔍 [PERM-DETAIL]', {
          requiredPerm: perm,
          hasAdmin,
          hasSpecific,
          result: hasAdmin || hasSpecific
        })
        
        return hasAdmin || hasSpecific
      })

      if (!hasPermission) {
        console.log('❌ [PERMISSION-DENIED]')
        return { allowed: false, reason: 'Bot hat nicht die erforderlichen Permissions' }
      }
      
      console.log('✅ [PERMISSION-GRANTED]')
    }

    // 4. Prüfe User Roles (wenn erforderlich)
    if (command.requiredRoles && command.requiredRoles.length > 0) {
      if (!context.userRoles || context.userRoles.length === 0) {
        return { allowed: false, reason: 'Du hast nicht die erforderlichen Rollen' }
      }

      const hasRole = command.requiredRoles.some((role: string) => 
        context.userRoles!.includes(role)
      )

      if (!hasRole) {
        return { 
          allowed: false, 
          reason: `Du brauchst eine der folgenden Rollen: ${command.requiredRoles.join(', ')}` 
        }
      }
    }

    // 5. Prüfe Channel Restrictions
    if (command.allowedChannels && command.allowedChannels.length > 0) {
      if (!context.channelId || !command.allowedChannels.includes(context.channelId)) {
        return { allowed: false, reason: 'Command in diesem Channel nicht erlaubt' }
      }
    }

    return { allowed: true }

  } catch (error) {
    console.error('❌ [COMMAND] Permission check error:', error)
    return { allowed: false, reason: 'Fehler bei Permission-Check' }
  }
}

/**
 * Validiert Command Arguments
 */
export function validateCommandArgs(
  command: any,
  args: Record<string, any>
): { valid: boolean; errors?: string[] } {
  const errors: string[] = []

  for (const option of command.options) {
    const value = args[option.name]

    // Required check
    if (option.required && (value === undefined || value === null || value === '')) {
      errors.push(`Parameter '${option.name}' ist erforderlich`)
      continue
    }

    // Type validation
    if (value !== undefined && value !== null) {
      if (option.type === 'number' && typeof value !== 'number') {
        errors.push(`Parameter '${option.name}' muss eine Zahl sein`)
      }
      if (option.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Parameter '${option.name}' muss true/false sein`)
      }
    }

    // Choices validation
    if (option.choices && value !== undefined) {
      const validValues = option.choices.map((c: any) => c.value)
      if (!validValues.includes(value)) {
        errors.push(`Parameter '${option.name}' muss einer der folgenden Werte sein: ${validValues.join(', ')}`)
      }
    }
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
}

/**
 * Main Command Handler - Called from messages route
 */
export async function handleCommand(
  parsed: ParsedCommand,
  context: CommandContext
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    console.log('🔧 [COMMAND-HANDLER] Started', { 
      commandName: parsed.name, 
      args: parsed.args,
      botId: context.botId 
    })
    
    // 1. Find command
    const command = await BotCommand.findOne({ 
      name: parsed.name,
      enabled: true 
    })

    if (!command) {
      console.log('❌ [COMMAND-HANDLER] Command not found:', parsed.name)
      return { success: false, error: `Command '/${parsed.name}' nicht gefunden` }
    }
    
    console.log('✅ [COMMAND-HANDLER] Command found:', {
      commandId: command.commandId,
      name: command.name,
      requiredPermissions: command.requiredPermissions,
      requiredRoles: command.requiredRoles
    })

    // 2. Check permissions
    console.log('🔒 [COMMAND-HANDLER] Checking permissions...')
    const permCheck = await canExecuteCommand(command, context)
    console.log('🔒 [COMMAND-HANDLER] Permission result:', permCheck)
    
    if (!permCheck.allowed) {
      console.log('❌ [COMMAND-HANDLER] Permission denied:', permCheck.reason)
      return { success: false, error: permCheck.reason }
    }

    // 3. Validate arguments
    const validation = validateCommandArgs(command, parsed.args)
    if (!validation.valid) {
      return { 
        success: false, 
        error: `Fehler bei Parametern:\n${validation.errors!.join('\n')}` 
      }
    }

    // 4. Increment usage count
    command.usageCount += 1
    await command.save()

    // 5. Return success with command data
    return {
      success: true,
      data: {
        command: command.toObject(),
        args: parsed.args,
        interactive: command.interactive
      }
    }

  } catch (error) {
    console.error('❌ [COMMAND] Handler error:', error)
    return { success: false, error: 'Interner Fehler beim Command-Handler' }
  }
}