# Panduan Deployment Vercel Cloud — NGA INVENTRA

Dokumen ini memandu langkah demi langkah menghubungkan repositori GitHub **NGA-Inventra---Enterprise-Inventory-Asset-Management** ke platform **Vercel** untuk staging dan demo publik.

---

## 1. Prasyarat Sebelum Deployment

Sebelum memulai proses di dashboard Vercel, pastikan Anda telah menyiapkan:
1. Akun Vercel aktif (Hobby untuk staging/demo non-komersial).
2. Akun GitHub dengan repositori: `https://github.com/HannR002/NGA-Inventra---Enterprise-Inventory-Asset-Management`.
3. Database MySQL Cloud yang dapat diakses secara publik/eksternal via koneksi TCP dengan enkripsi TLS (lihat opsi di `DATABASE_CONNECTION_REPORT.md`).

---

## 2. Langkah Demi Langkah Deployment via Vercel Dashboard

### Langkah 1: Buat Proyek Baru di Vercel
1. Buka dashboard [vercel.com](https://vercel.com) dan login ke akun Anda.
2. Klik tombol **"Add New..."** di kanan atas -> pilih **"Project"**.
3. Pada bagian **"Import Git Repository"**, cari repositori:
   `HannR002/NGA-Inventra---Enterprise-Inventory-Asset-Management`.
4. Klik **"Import"**.

### Langkah 2: Konfigurasi Build & Output Settings
Vercel akan secara otomatis mendeteksi berkas `vercel.json` dan struktur proyek Vite. Pastikan parameter berikut sesuai:

| Pengaturan | Nilai Konfigurasi | Keterangan |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Terdeteksi otomatis dari `package.json` |
| **Root Directory** | `./` | Root repositori |
| **Build Command** | `npm run build` | Menjalankan Vite build + bundling script |
| **Output Directory** | `dist` | Folder hasil build frontend React |
| **Install Command** | `npm install` | Otomatis menjalankan `postinstall: prisma generate` |

### Langkah 3: Konfigurasi Environment Variables di Vercel
Buka tab **"Environment Variables"** pada halaman setup proyek Vercel, lalu tambahkan variabel berikut:

1. **`NODE_ENV`**:
   - Nilai: `production`
   - Target: Production, Preview, Development
2. **`DATABASE_URL`**:
   - Nilai: URL koneksi MySQL Cloud Anda, berformat:
     `mysql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?sslaccept=strict`
   - Target: Production, Preview
3. **`JWT_SECRET`**:
   - Nilai: String acak minimal 32 karakter (disarankan 64 karakter kriptografis), misalnya dibuat via terminal lokal:
     `openssl rand -hex 32`
   - Target: Production, Preview

> **PENTING:** Jangan pernah mencentang atau menambahkan prefix `VITE_` untuk variabel `DATABASE_URL` dan `JWT_SECRET` agar variabel tersebut tetap rahasia di sisi server (*Serverless Function*) dan tidak terekspos ke bundle JavaScript browser!

### Langkah 4: Klik Deploy
Klik tombol **"Deploy"**. Vercel akan:
1. Melakukan clone repositori.
2. Menjalankan `npm install` dan otomatis men-generate Prisma Client untuk runtime AWS Lambda (`rhel-openssl-3.0.x`).
3. Menjalankan `npm run build` menghasilkan bundle React di folder `dist/`.
4. Mengompilasi `api/index.ts` menjadi Vercel Serverless Function.
5. Mempublikasikan aplikasi dengan URL unik (contoh: `https://nga-inventra-xyz.vercel.app`).

---

## 3. Eksekusi Migrasi Database ke Cloud MySQL

Sebelum aplikasi digunakan, skema 17 tabel relasional wajib diterapkan ke database MySQL target. Jalankan perintah berikut dari komputer lokal Anda yang memiliki akses ke `DATABASE_URL`:

```bash
# Set DATABASE_URL database target di terminal lokal Anda
export DATABASE_URL="mysql://<USER>:<PASS>@<HOST>:<PORT>/<DB>?sslaccept=strict"

# Terapkan migrasi resmi Prisma
npx prisma migrate deploy

# (Opsional) Jalankan seeding akun & master data awal
npx tsx scripts/seed-mysql.ts
```

---

## 4. Verifikasi Pasca Deployment (Smoke Testing)

Setelah Vercel menyelesaikan deployment:

### A. Uji Health Check Endpoint
Akses URL: `https://<domain-vercel-anda>/api/health`
Pastikan respons JSON mengembalikan kode HTTP 200:
```json
{
  "status": "UP",
  "environment": "production",
  "runtime": "vercel-serverless",
  "activeEngine": "PRISMA_MYSQL",
  "database": {
    "status": "CONNECTED",
    "engine": "MySQL 8.0+",
    "databaseVersion": "8.0.xx",
    "host": "<host-cloud-db>"
  }
}
```

### B. Uji Navigasi Frontend SPA
Buka URL beranda `https://<domain-vercel-anda>`:
- Uji navigasi langsung ke subpath: `https://<domain-vercel-anda>/inventory`, `/assets`, `/movements`.
- Refresh browser pada halaman subpath untuk memastikan `vercel.json` rewrite tidak menghasilkan error 404.

### C. Uji Diagnostik Sistem
Buka halaman antarmuka **Pengaturan** -> klik **"Uji Koneksi Realtime"**. Sistem akan menjalankan query `SELECT VERSION()` dan `SELECT 1` langsung dari Serverless Function ke database MySQL Anda.

---

## 5. Troubleshooting Masalah Umum di Vercel

| Gejala Error | Penyebab Utama | Solusi |
| :--- | :--- | :--- |
| **`PrismaClientInitializationError: Query engine not found`** | Binary engine RHEL belum digenerate saat build. | Pastikan `prisma/schema.prisma` menyertakan `rhel-openssl-3.0.x` dan `postinstall: prisma generate` ada di `package.json`. |
| **`FUNCTION_INVOCATION_TIMEOUT` (10s limit)** | Query database terhalang firewall atau latency TLS terlalu tinggi. | Pastikan database cloud mengizinkan koneksi dari publik dengan SSL/TLS dan berada di region terdekat dengan Vercel (misal: `sin1` atau `fra1`). |
| **`Too many connections` di MySQL** | Setiap instance serverless membuka pool koneksi baru. | Pastikan `connectionLimit` diatur ke 3 per instance (telah dikonfigurasi di `server/db/connection.ts`) atau gunakan database connection pooler. |
| **404 pada rute `/api/*`** | Rewrites di `vercel.json` belum mengarahkan ke `/api`. | Pastikan `vercel.json` memiliki rewrite `{"source": "/api/(.*)", "destination": "/api"}`. |
