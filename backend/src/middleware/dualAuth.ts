import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET fehlt');

// Middleware die BEIDE Tokens akzeptiert: Chat-Token ODER Dev-Token
export const dualAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Kein Token vorhanden' });
    }

    const token = authHeader.substring(7);
    let decoded: any
    let tokenType: 'chat' | 'dev'
    try {
      decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'nokki-api' })
      tokenType = 'chat'
    } catch {
      decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'nokki-dev' })
      tokenType = 'dev'
    }

    if (typeof decoded?.userId !== 'string') {
      return res.status(401).json({ error: 'Ungültiger Token-Inhalt' })
    }
    (req as any).userId = decoded.userId;
    (req as any).tokenType = tokenType;

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
};
