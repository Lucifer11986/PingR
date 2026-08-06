import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hashSecret, normalizeDevEmail, safeReturnPath, validDevEmail, validDevPassword, validDevUsername,
} from '../utils/devAuthSecurity'

test('Developer-E-Mail wird normalisiert und validiert', () => {
  assert.equal(normalizeDevEmail('  Dev@Example.COM '), 'dev@example.com')
  assert.equal(validDevEmail('dev@example.com'), true)
  assert.equal(validDevEmail('dev@example'), false)
})

test('Developer-Namen und Passwörter beachten Grenzen', () => {
  assert.equal(validDevUsername('nokki_dev'), true)
  assert.equal(validDevUsername('../admin'), false)
  assert.equal(validDevPassword('1234567890'), true)
  assert.equal(validDevPassword('short'), false)
  assert.equal(validDevPassword('x'.repeat(201)), false)
})

test('Token-Hashes sind deterministisch und geben Geheimnisse nicht preis', () => {
  const secret = 'secret-value'
  assert.equal(hashSecret(secret), hashSecret(secret))
  assert.notEqual(hashSecret(secret), secret)
  assert.equal(hashSecret(secret).length, 64)
})

test('Weiterleitungen bleiben auf der eigenen Anwendung', () => {
  assert.equal(safeReturnPath('/dev-dashboard'), '/dev-dashboard')
  assert.equal(safeReturnPath('//evil.example'), '/dev-login')
  assert.equal(safeReturnPath('https://evil.example'), '/dev-login')
})
