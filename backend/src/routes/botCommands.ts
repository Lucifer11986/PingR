import express, { Request, Response } from 'express'
import BotCommand from '../models/BotCommand'

const router = express.Router()

/**
 * GET /api/bot-commands
 * Liste alle verfügbaren Commands
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, enabled = 'true' } = req.query

    const query: any = {}
    if (category) query.category = category
    if (enabled) query.enabled = enabled === 'true'

    const commands = await BotCommand.find(query).sort({ category: 1, name: 1 })

    res.json({
      success: true,
      commands
    })

  } catch (error) {
    console.error('❌ [COMMANDS] List error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const commands = await BotCommand.find({ category: req.params.category, enabled: true }).sort({ name: 1 })
    res.json({ success: true, category: req.params.category, commands })
  } catch (error) {
    console.error('❌ [COMMANDS] Category error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

/**
 * GET /api/bot-commands/:commandId
 * Get einzelnen Command
 */
router.get('/:commandId', async (req: Request, res: Response) => {
  try {
    const command = await BotCommand.findOne({ commandId: req.params.commandId })
    if (!command) return res.status(404).json({ error: 'Command nicht gefunden' })
    res.json({ success: true, command })
  } catch (error) {
    console.error('❌ [COMMANDS] Get error:', error)
    res.status(500).json({ error: 'Fehler beim Laden' })
  }
})

export default router
