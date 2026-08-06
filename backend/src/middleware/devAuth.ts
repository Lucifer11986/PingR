import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET fehlt');

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Kein Token vorhanden' });
      return;
    }

    const token = authHeader.substring(7);

    // ── Variante 1: JWT Token (vom Dev-Login) ────────────────────
    if (!token.startsWith('sk_live_') && !token.startsWith('sk_test_')) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'nokki-dev' }) as any;
        if (decoded.sessionVersion !== 2) throw new Error('Veraltete Developer-Sitzung');
        (req as any).userId = decoded.userId;
        (req as any).email  = decoded.email;
        next();
        return;
      } catch (jwtErr) {
        console.error('Auth middleware error:', jwtErr);
        res.status(401).json({ error: 'Ungültiger Token' });
        return;
      }
    }

    // ── Variante 2: API Key (sk_live_... oder sk_test_...) ───────
    const DevUser = require('../models/DevUser').default;
    const apiKeyHash = crypto.createHash('sha256').update(token).digest('hex');
    let user = await DevUser.findOne({ apiKeyHash }).select('+apiKeyHash').lean();
    if (!user) {
      const legacy = await DevUser.findOne({ apiKey: token }).select('+apiKey');
      if (legacy) {
        legacy.apiKeyHash = apiKeyHash;
        legacy.apiKeyPrefix = `${token.slice(0, 16)}…`;
        legacy.apiKey = undefined;
        await legacy.save();
        user = legacy.toObject();
      }
    }

    if (!user) {
      res.status(401).json({ error: 'Ungültiger API Key' });
      return;
    }

    if ((user as any).emailVerified !== true) {
      res.status(403).json({ error: 'Bitte bestätige zuerst deine Developer-E-Mail-Adresse' });
      return;
    }

    if ((user as any).isBanned) {
      res.status(403).json({ error: 'Developer-Account gesperrt' });
      return;
    }

    (req as any).userId   = (user as any)._id.toString();
    (req as any).email    = (user as any).email;
    (req as any).username = (user as any).username;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentifizierung fehlgeschlagen' });
  }
};
