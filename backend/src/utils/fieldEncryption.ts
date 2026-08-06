/**
 * Einfache symmetrische Feldverschlüsselung für sensible MongoDB-Felder
 * Nutzt AES-256-GCM (Node.js crypto)
 * 
 * HINWEIS: Für echte MongoDB Encryption at Rest braucht man MongoDB Enterprise.
 * Dies ist ein App-Level Kompromiss für Community Edition.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGO    = 'aes-256-gcm'
const KEY_LEN = 32

// Schlüssel aus FIELD_ENCRYPTION_SECRET ableiten
function getKey(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_SECRET
  if (!secret || secret.length < 32) throw new Error('FIELD_ENCRYPTION_SECRET fehlt oder ist zu kurz')
  return scryptSync(secret, 'pingr-field-salt', KEY_LEN)
}

export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext
  try {
    const key = getKey()
    const iv  = randomBytes(12)
    const cipher = createCipheriv(ALGO, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    // Format: iv(12) + tag(16) + ciphertext → base64
    return Buffer.concat([iv, tag, encrypted]).toString('base64')
  } catch (error) {
    throw new Error(`Feldverschlüsselung fehlgeschlagen: ${(error as Error).message}`)
  }
}

export function decryptField(ciphertext: string): string {
  if (!ciphertext) return ciphertext
  // Prüfen ob es base64-verschlüsselt ist
  if (!isEncrypted(ciphertext)) return ciphertext
  try {
    const key    = getKey()
    const buf    = Buffer.from(ciphertext, 'base64')
    const iv     = buf.subarray(0, 12)
    const tag    = buf.subarray(12, 28)
    const data   = buf.subarray(28)
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data) + decipher.final('utf8')
  } catch (error) {
    throw new Error(`Feldentschlüsselung fehlgeschlagen: ${(error as Error).message}`)
  }
}

function isEncrypted(value: string): boolean {
  // Base64 mit korrekter Länge (mind. iv+tag+1 Zeichen = 29 Bytes → ~40 Base64)
  return /^[A-Za-z0-9+/]{40,}={0,2}$/.test(value) && value.length > 40
}
