#!/usr/bin/env bash
# ==============================================================================
# NGA INVENTRA - Automated Hostinger VPS Deployment Script
# ==============================================================================

set -e

echo "=== [1/6] Memeriksa Lingkungan Runtime Hostinger ==="
node -v
npm -v

# Ensure .env exists
if [ ! -f .env ]; then
  echo "ERROR: File .env tidak ditemukan! Silakan salin dari .env.example dan isi kredensial MySQL Hostinger."
  exit 1
fi

echo "=== [2/6] Memasang Dependensi Node.js ==="
npm ci --legacy-peer-deps || npm install --legacy-peer-deps

echo "=== [3/6] Men-generate Prisma Client ==="
npx prisma generate

echo "=== [4/6] Menjalankan Migrasi Database ke Hostinger MySQL via Prisma Migrate ==="
npx prisma migrate deploy

echo "=== [5/6] Membangun Bundle Frontend Produksi (Vite Build) ==="
npm run build

echo "=== [6/6] Menjalankan / Restart Aplikasi dengan PM2 ==="
mkdir -p logs
if command -v pm2 &> /dev/null; then
  pm2 reload hostinger/ecosystem.config.cjs --env production || pm2 start hostinger/ecosystem.config.cjs --env production
  pm2 save
  echo "=== Deployment Berhasil! Aplikasi aktif via PM2 ==="
else
  echo "PM2 tidak terpasang secara global. Anda dapat menjalankannya dengan: npm run start:prod (atau node server.js)"
fi
