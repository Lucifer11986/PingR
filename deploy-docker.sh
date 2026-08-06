#!/bin/bash
set -e

echo "🔥 Redis + JWT-Identity Deployment (Docker)"
echo "==========================================="

cd /opt/pingr

# 1. Dependencies installieren
echo "📦 Installing dependencies..."
cd backend
npm install ioredis
cd ..

# 2. .env Update (falls nötig)
echo "🌍 Checking .env..."
if ! grep -q "REDIS_URL" .env; then
  echo "REDIS_URL=redis://pingr-redis:6379" >> .env
  echo "✅ REDIS_URL added to .env"
else
  echo "✅ REDIS_URL already in .env"
fi

# 3. Container stoppen
echo "🛑 Stopping containers..."
docker-compose down

# 4. Images neu bauen
echo "🔨 Building images..."
docker-compose build backend

# 5. Container starten
echo "🚀 Starting containers..."
docker-compose up -d

# 6. Warten auf Redis
echo "⏳ Waiting for Redis..."
sleep 5

# 7. Redis testen
echo "🧪 Testing Redis..."
if docker exec pingr-redis redis-cli ping | grep -q "PONG"; then
  echo "✅ Redis is responding"
else
  echo "❌ Redis check failed"
  exit 1
fi

# 8. Logs prüfen
echo "📋 Checking backend logs..."
sleep 3
docker-compose logs --tail=30 backend

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Verify deployment:"
echo "   docker-compose ps"
echo "   docker-compose logs -f backend"
echo ""
echo "Expected in logs:"
echo "   ✅ Redis connected"
echo "   ✅ Redis ready"
echo "   ✅ Socket.IO initialisiert (Multi-Identity Support)"