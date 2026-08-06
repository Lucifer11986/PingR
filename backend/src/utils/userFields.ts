// Ausschließlich Felder, die andere Nutzer in Chats und Suchergebnissen sehen dürfen.
export const PUBLIC_USER_FIELDS = [
  '_id', 'uin', 'username', 'avatar', 'bio', 'status', 'statusMessage',
  'lastSeen', 'privacyShowStatus', 'privacyShowLastSeen', 'privacyShowAvatar',
  'legacyUin', 'legacyVerified',
].join(' ')

// Eigene Profilantworten dürfen Einstellungen enthalten, niemals jedoch
// Zugangsdaten, Reset-/Einladungstoken oder verschlüsselte Geheimnisse.
export const PRIVATE_USER_EXCLUDE = [
  '-password', '-resetToken', '-resetTokenExpires', '-emailVerifyToken',
  '-emailVerifyExpires', '-twoFactorSecret', '-twoFactorBackup', '-lastIP',
  '-adminInviteToken', '-adminInviteExpires', '-fakePin',
].join(' ')
