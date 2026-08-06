import { Router, Request, Response } from 'express';
import DevUser from '../models/DevUser';  // ✅ DEFAULT IMPORT (ohne {})
import { authMiddleware } from '../middleware/devAuth';
import crypto from 'crypto';

const hashKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

const router = Router();

// Get current API key
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await DevUser.findById(userId).select('+apiKey');
    
    if (!user) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }
    
    const legacyKey = user.apiKey;
    if (legacyKey) {
      user.apiKeyHash = hashKey(legacyKey);
      user.apiKeyPrefix = `${legacyKey.slice(0, 16)}…`;
      user.apiKey = undefined;
      await user.save();
    }
    res.json({ apiKeyPrefix: user.apiKeyPrefix || 'sk_live_…', revealable: false });
  } catch (error) {
    console.error('Get API key error:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen des API Keys' });
  }
});

// Regenerate API key
router.post('/regenerate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await DevUser.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }
    
    // Generate new API key
    const newApiKey = `sk_live_${crypto.randomBytes(32).toString('base64url')}`;
    
    user.apiKeyHash = hashKey(newApiKey);
    user.apiKeyPrefix = `${newApiKey.slice(0, 16)}…`;
    user.apiKey = undefined;
    await user.save();
    
    res.json({ apiKey: newApiKey, message: 'API Key neu generiert' });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    res.status(500).json({ error: 'Fehler beim Regenerieren des API Keys' });
  }
});

export default router;
