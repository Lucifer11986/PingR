"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptField = encryptField;
exports.decryptField = decryptField;
/**
 * Einfache symmetrische Feldverschlüsselung für sensible MongoDB-Felder
 * Nutzt AES-256-GCM (Node.js crypto)
 *
 * HINWEIS: Für echte MongoDB Encryption at Rest braucht man MongoDB Enterprise.
 * Dies ist ein App-Level Kompromiss für Community Edition.
 */
const crypto_1 = require("crypto");
const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
// Schlüssel aus FIELD_ENCRYPTION_SECRET ableiten
function getKey() {
    const secret = process.env.FIELD_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'fallback-key-change-me';
    return (0, crypto_1.scryptSync)(secret, 'pingr-field-salt', KEY_LEN);
}
function encryptField(plaintext) {
    if (!plaintext)
        return plaintext;
    try {
        const key = getKey();
        const iv = (0, crypto_1.randomBytes)(12);
        const cipher = (0, crypto_1.createCipheriv)(ALGO, key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        // Format: iv(12) + tag(16) + ciphertext → base64
        return Buffer.concat([iv, tag, encrypted]).toString('base64');
    }
    catch (_e) {
        return plaintext; // Fallback: unverschlüsselt
    }
}
function decryptField(ciphertext) {
    if (!ciphertext)
        return ciphertext;
    // Prüfen ob es base64-verschlüsselt ist
    if (!isEncrypted(ciphertext))
        return ciphertext;
    try {
        const key = getKey();
        const buf = Buffer.from(ciphertext, 'base64');
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const data = buf.subarray(28);
        const decipher = (0, crypto_1.createDecipheriv)(ALGO, key, iv);
        decipher.setAuthTag(tag);
        return decipher.update(data) + decipher.final('utf8');
    }
    catch (_e) {
        return ciphertext; // Fallback: als Klartext zurückgeben
    }
}
function isEncrypted(value) {
    // Base64 mit korrekter Länge (mind. iv+tag+1 Zeichen = 29 Bytes → ~40 Base64)
    return /^[A-Za-z0-9+/]{40,}={0,2}$/.test(value) && value.length > 40;
}
