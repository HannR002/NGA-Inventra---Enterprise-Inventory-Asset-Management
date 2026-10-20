# Panduan Deployment Hostinger Staging — NGA INVENTRA

Dokumen ini merupakan panduan arsitektural dan operasional resmi untuk menambahkan **NGA INVENTRA Enterprise Inventory & Asset Management** sebagai aplikasi terpisah pada akun hosting Hostinger Anda (2 CPU Cores, 3072 MB RAM, 50 GB Disk), berdampingan secara aman dengan website jurnal yang sudah berjalan (**p4ijournal.org**).

---

## ⚠️ Protokol Keamanan & Isolasi (Non-Interference with p4ijournal.org)

Hostinger Cloud Hosting / VPS mendukung arsitektur multi-tenancy berbasis virtual host terisolasi. Untuk menjamin operasional `p4ijournal.org` tidak terganggu sama sekali:

1. **JANGAN PERNAH menyentuh database yang sudah ada**:
   - Database `p4ijournal.org` (biasanya OJS / WordPress / custom DB) tidak boleh diubah, dimigrasi, atau ditimpa.
   - Buat database MySQL baru khusus Inventra dengan nama unik, misalnya: `uXXXXX_inventra_staging`.
2. **JANGAN PERNAH menggunakan direktori root `p4ijournal.org`**:
   - Berkas web `p4ijournal.org` berada di path seperti `public_html/`.
   - NGA Inventra harus ditempatkan pada subdomain terpisah (contoh: `inventra.p4ijournal.org` atau `staging-inventra.p4ijournal.org`) yang memiliki Document Root independen (contoh: `domains/inventra.p4ijournal.org/public_html` atau direktori web app terisolasi).
3. **Isolasi Proses Node.js**:
   - NGA Inventra berjalan sebagai proses Node.js 22 independen via PM2 atau Hostinger Node.js Application Manager, mendengarkan port tersendiri (misal 3000), tanpa mempengaruhi web server Apache/LiteSpeed/Nginx yang melayani `p4ijournal.org`.

---

## 1. Spesifikasi Runtime & Hasil Verifikasi Lokal

| Komponen | Spesifikasi & Status |
| :--- | :--- |
| **Node.js Target** | **Node.js 22 LTS** (didukung penuh oleh paket hosting Anda) |
| **Frontend Bundle** | React 19 SPA terkompilasi ke direktori `dist/` via Vite |
| **Backend Bundle** | Standalone ECMAScript `server.js` (dibundel via esbuild dengan `--packages=external`) |
| **Prisma Engine Binary** | Dikonfigurasi dengan `binaryTargets = ["native", "debian-openssl-3.0.x", "debian-openssl-1.1.x"]` |
| **Mekanisme Migrasi** | **Satu mekanisme tunggal: Prisma Migrate (`npx prisma migrate deploy`)** menggunakan direktori `prisma/migrations/20261018000000_init_mysql/migration.sql` (17 tabel relasional lengkap) |
| **Password Hashing** | **OWASP PBKDF2-HMAC-SHA512** (210.000 iterasi, salt 16-byte kriptografis, otomatis rehash akun lama saat login) |
| **Hasil Pengujian Lokal** | **16/16 Test Passed (0 Failures)** mencakup rollback transaksi atomik, proteksi konkurensi (mencegah stok minus), idempotensi mutasi, konservasi stok transfer, dan rekonsiliasi stock opname |

---

## 2. Langkah Demi Langkah Setup Staging di Hostinger hPanel

### Tahap 1: Buat Subdomain Khusus Staging
1. Masuk ke **hPanel Hostinger**.
2. Pilih domain Anda (`p4ijournal.org`) -> buka menu **Domains** -> **Subdomains**.
3. Buat subdomain baru:
   - **Subdomain Name**: `inventra` (sehingga alamat menjadi `inventra.p4ijournal.org`).
   - Centang opsi **Custom folder for subdomain**: misalnya `public_html/inventra` atau biarkan default hPanel.
4. Klik **Create**.

### Tahap 2: Buat Database MySQL Staging Khusus
1. Di hPanel, buka menu **Databases** -> **MySQL Databases**.
2. Buat database baru khusus:
   - **Database Name**: Masukkan `inventra_staging` (nama lengkap di hPanel akan berformat seperti `u123456789_inventra_staging`).
   - **Username**: Masukkan `inventra_user` (nama lengkap: `u123456789_inventra_user`).
   - **Password**: Hasilkan password kuat (minimal 16 karakter acak dengan simbol dan angka).
3. Simpan nama database, username, dan password tersebut.
4. Pastikan host database adalah `localhost` atau `127.0.0.1` (karena backend Node.js dan MySQL berada di satu server lokal).

---

## 3. Deployment via GitHub (Add Website → Deploy Web App → Import Git)

Jika paket Hostinger Anda memiliki fitur **Deploy Web App / Node.js**:

1. Masuk ke menu **Websites** -> **Add Website** (atau **Web Apps** / **Node.js**).
2. Pilih opsi **Deploy Web App** -> **Import Git Repository**.
3. Konfigurasikan parameter repositori:
   - **Repository URL**: Masukkan URL repositori GitHub NGA Inventra Anda.
   - **Branch**: `main`
   - **Node.js Version**: Pilih **22.x** (atau **20.x**).
   - **Application Root**: `/` (root direktori repositori).
   - **Application Startup File**: **`server.js`** *(bukan `server.ts` karena Node.js di server hosting menjalankan berkas JavaScript murni)*.
4. Masukkan **Environment Variables**:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL="mysql://u123456789_inventra_user:PasswordDatabaseAnda@localhost:3306/u123456789_inventra_staging"
   JWT_SECRET="masukkan_string_acak_kriptografis_minimal_64_karakter_contoh_openssl_rand_hex_32"
   ```
5. Tentukan Perintah Build & Start:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod` (atau `node server.js`)
6. Klik **Deploy / Save**.

---

## 4. Eksekusi Migrasi Database & Seeding Awal Staging

Setelah kode berhasil ter-deploy ke Hostinger, buka terminal SSH atau Terminal bawaan hPanel:

```bash
# 1. Pindah ke direktori aplikasi
cd /home/uXXXXX/public_html/inventra # (sesuaikan dengan direktori aplikasi Anda)

# 2. Jalankan migrasi resmi Prisma (menerapkan 17 tabel relasional)
npx prisma migrate deploy

# 3. (Opsional) Lakukan Seeding data master staging (User awal, Gudang, Kategori, Unit)
npm run db:seed
```

> **Catatan:** Script `npm run db:seed` otomatis mengeksekusi `node scripts/seed-mysql.js` yang telah dikompilasi secara mandiri sehingga tidak membutuhkan `tsx` atau dependensi development tambahan di server produksi.

---

## 5. Konfigurasi Web Server Reverse Proxy & SSL

### Skenario A: Hostinger Cloud Hosting (LiteSpeed / Apache)
Pastikan berkas `.htaccess` di direktori web app Anda memiliki aturan rewrite untuk meneruskan traffic ke Node.js dan SPA fallback:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^api/(.*)$ http://127.0.0.1:3000/api/$1 [P,L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Skenario B: Hostinger VPS (Nginx Reverse Proxy)
Gunakan konfigurasi Nginx pada `hostinger/nginx.conf` dengan `server_name inventra.p4ijournal.org`:

```nginx
server {
    server_name inventra.p4ijournal.org;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan SSL gratis Let's Encrypt melalui menu **Security** -> **SSL** di hPanel untuk subdomain `inventra.p4ijournal.org`.

---

## 6. Verifikasi Operasional Pasca-Deployment

Setelah aplikasi aktif di Hostinger, lakukan uji koneksi langsung:

1. **Uji Health Check Endpoint**:
   Kunjungi: `https://inventra.p4ijournal.org/api/health`
   Respons yang benar akan mengembalikan HTTP 200:
   ```json
   {
     "status": "UP",
     "environment": "production",
     "activeEngine": "PRISMA_MYSQL",
     "database": {
       "status": "CONNECTED",
       "engine": "MySQL 8.0+",
       "databaseVersion": "8.0.xx",
       "latencyMs": 1.2,
       "host": "localhost"
     }
   }
   ```
2. **Uji Antarmuka Web**:
   Buka `https://inventra.p4ijournal.org` di browser.
   Login menggunakan kredensial staging yang telah di-seed:
   - **Email**: `admin@nga-inventra.com`
   - **Password**: `AdminSecurePass2026!`
   *(Sistem akan otomatis meng-upgrade hash akun ke standar OWASP 210.000 iterasi secara transparan).*
3. **Uji Pengaturan Sistem**:
   Buka menu **Pengaturan** -> klik **"Uji Koneksi Realtime"**. Sistem akan mengeksekusi query `SELECT VERSION()` dan `SELECT 1` secara langsung ke MySQL Hostinger Anda dan menampilkan latensi query aktual.
