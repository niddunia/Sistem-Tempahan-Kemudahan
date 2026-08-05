#!/bin/bash
# ============================================================
# Sistem e-Tempahan PLTT-JTM — Supabase Setup Script
# Jalankan skrip ini di komputer tempatan anda selepas clone repo
# ============================================================

set -e

echo "🚀 Sistem e-Tempahan PLTT-JTM — Supabase Setup"
echo "================================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ Fail .env tidak dijumpai! Sila cipta .env dengan konfigurasi Supabase."
  echo "   cp .env.example .env"
  echo "   Kemudian edit .env dengan kredensial Supabase anda."
  exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
  echo "📦 Memasang dependencies..."
  bun install
fi

echo ""
echo "1️⃣  Menjana Prisma Client untuk PostgreSQL..."
bun run db:generate
echo "   ✅ Prisma Client dijana"
echo ""

echo "2️⃣  Push schema ke Supabase (cipta semua tables)..."
echo "   Sedang menyambung ke database..."
bun run db:push
echo "   ✅ Schema di-push ke Supabase"
echo ""

echo "3️⃣  Seed database dengan data dummy..."
bun run db:seed
echo "   ✅ Data dummy dimasukkan"
echo ""

echo "================================================"
echo "✅ Setup Selesai!"
echo ""
echo "📊 Tables yang dicipta di Supabase:"
echo "   - User (8 pengguna)"
echo "   - Facility (6 kemudahan)"
echo "   - Booking (22+ tempahan)"
echo "   - ApprovalLog (log kelulusan)"
echo "   - Notification (notifikasi)"
echo "   - AuditLog (log audit)"
echo "   - Feedback (maklum balas)"
echo "   - Session (sesi NextAuth)"
echo "   - Account (akaun OAuth)"
echo "   - VerificationToken (token verification)"
echo ""
echo "🔐 Demo Login:"
echo "   admin@pltt.gov.my / Password123!  (Super Admin)"
echo "   fadmin@pltt.gov.my / Password123! (Facility Admin)"
echo "   user1@pltt.gov.my / Password123!  (Regular User)"
echo ""
echo "▶️  Untuk jalankan aplikasi:"
echo "   bun run dev"
echo "   Buka: http://localhost:3000"
echo "================================================"
