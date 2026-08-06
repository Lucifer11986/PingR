db = db.getSiblingDB('pingr');

db.createCollection('users');
db.createCollection('messages');
db.createCollection('conversations');
db.createCollection('contacts');

db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.messages.createIndex({ conversationId: 1, createdAt: 1 });
db.conversations.createIndex({ participants: 1 });

print('PingR Datenbank initialisiert ✓');
