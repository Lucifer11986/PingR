/**
 * PingR Ende-zu-Ende Verschlüsselung
 * Nutzt WebCrypto API (in allen modernen Browsern verfügbar)
 *
 * Funktionsweise:
 * 1. Jeder User generiert ein ECDH-Schlüsselpaar (privat + öffentlich)
 * 2. Öffentlicher Schlüssel wird auf dem Server gespeichert
 * 3. Zum Verschlüsseln: ECDH shared secret + AES-GCM
 * 4. Privater Schlüssel verlässt NIE das Gerät
 */

const KEY_STORAGE = 'pingr_e2e_privkey'
const PUB_STORAGE = 'pingr_e2e_pubkey'

// ── Schlüsselpaar generieren ──────────────────────────────────────────────────
export async function generateKeyPair(): Promise<{
  publicKey:  string  // Base64 für Server
  privateKey: string  // Base64 für localStorage
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )

  const [pubExport, privExport] = await Promise.all([
    crypto.subtle.exportKey('spki', keyPair.publicKey),
    crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  ])

  const publicKey  = bufToBase64(pubExport)
  const privateKey = bufToBase64(privExport)

  // Privaten Schlüssel lokal speichern
  localStorage.setItem(KEY_STORAGE, privateKey)
  localStorage.setItem(PUB_STORAGE, publicKey)

  return { publicKey, privateKey }
}

// ── Shared Secret ableiten ────────────────────────────────────────────────────
async function deriveSharedKey(myPrivKeyB64: string, theirPubKeyB64: string): Promise<CryptoKey> {
  const myPrivKey = await crypto.subtle.importKey(
    'pkcs8',
    base64ToBuf(myPrivKeyB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  )

  const theirPubKey = await crypto.subtle.importKey(
    'spki',
    base64ToBuf(theirPubKeyB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPubKey },
    myPrivKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Nachricht verschlüsseln ───────────────────────────────────────────────────
export async function encryptMessage(
  plaintext:       string,
  myPrivKeyB64:    string,
  theirPubKeyB64:  string
): Promise<string> {
  try {
    const sharedKey = await deriveSharedKey(myPrivKeyB64, theirPubKeyB64)
    const iv        = crypto.getRandomValues(new Uint8Array(12))
    const encoded   = new TextEncoder().encode(plaintext)

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      encoded
    )

    // Format: "e2e:" + base64(iv) + ":" + base64(ciphertext)
    return `e2e:${bufToBase64(iv.buffer)}:${bufToBase64(ciphertext)}`
  } catch (err) {
    console.error('[E2E] Verschlüsselung fehlgeschlagen:', err)
    return plaintext  // Fallback: unverschlüsselt
  }
}

// ── Nachricht entschlüsseln ───────────────────────────────────────────────────
export async function decryptMessage(
  ciphertext:      string,
  myPrivKeyB64:    string,
  theirPubKeyB64:  string
): Promise<string> {
  if (!ciphertext.startsWith('e2e:')) return ciphertext  // Nicht verschlüsselt

  try {
    const [, ivB64, dataB64] = ciphertext.split(':')
    const sharedKey = await deriveSharedKey(myPrivKeyB64, theirPubKeyB64)
    const iv        = new Uint8Array(base64ToBuf(ivB64))
    const data      = base64ToBuf(dataB64)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      data
    )

    return new TextDecoder().decode(decrypted)
  } catch (err) {
    console.error('[E2E] Entschlüsselung fehlgeschlagen:', err)
    return '[🔒 Verschlüsselte Nachricht — Schlüssel nicht verfügbar]'
  }
}

// ── Lokale Schlüssel holen ────────────────────────────────────────────────────
export function getLocalKeys(): { privateKey: string | null; publicKey: string | null } {
  return {
    privateKey: localStorage.getItem(KEY_STORAGE),
    publicKey:  localStorage.getItem(PUB_STORAGE),
  }
}

export function hasLocalKeys(): boolean {
  return !!(localStorage.getItem(KEY_STORAGE) && localStorage.getItem(PUB_STORAGE))
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

// ── Schlüssel exportieren (für Backup) ───────────────────────────────────────
export function exportKeysAsFile(): void {
  const { privateKey, publicKey } = getLocalKeys()
  if (!privateKey || !publicKey) { alert('Keine Schlüssel gefunden'); return }

  const data = JSON.stringify({
    version:    'PingR-E2E-v1',
    exportedAt: new Date().toISOString(),
    publicKey,
    privateKey,
  }, null, 2)

  const a = document.createElement('a')
  a.href     = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  a.download = `PingR_E2E_Keys_${new Date().toISOString().slice(0,10)}.json`
  a.click()
}

// ── Schlüssel importieren ─────────────────────────────────────────────────────
export async function importKeysFromFile(file: File): Promise<boolean> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (data.version !== 'PingR-E2E-v1' || !data.privateKey || !data.publicKey) return false
    localStorage.setItem(KEY_STORAGE, data.privateKey)
    localStorage.setItem(PUB_STORAGE, data.publicKey)
    return true
  } catch (_e) {
    return false
  }
}