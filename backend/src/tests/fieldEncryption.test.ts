import test from 'node:test'
import assert from 'node:assert/strict'
import { decryptField, encryptField } from '../utils/fieldEncryption'

test('sensible Webhook-Payloads werden verschlüsselt gespeichert', () => {
  const previous = process.env.FIELD_ENCRYPTION_SECRET
  process.env.FIELD_ENCRYPTION_SECRET = 'test-only-field-encryption-secret-32-characters'
  try {
    const plaintext = JSON.stringify({ event: 'message.create', data: { message: 'vertraulich' } })
    const encrypted = encryptField(plaintext)
    assert.notEqual(encrypted, plaintext)
    assert.equal(encrypted.includes('vertraulich'), false)
    assert.equal(decryptField(encrypted), plaintext)
  } finally {
    if (previous === undefined) delete process.env.FIELD_ENCRYPTION_SECRET
    else process.env.FIELD_ENCRYPTION_SECRET = previous
  }
})
