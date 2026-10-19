# Panduan Komprehensif Deployment NGA Inventra ke Hostinger

Dokumen ini merupakan panduan teknis langkah demi langkah untuk melakukan deployment sistem **NGA INVENTRA Enterprise Inventory & Asset Management** ke layanan hosting **Hostinger** menggunakan runtime Node.js/Express dan database MySQL.

---

## 1. Analisis & Pemilihan Paket Hosting Hostinger

Hostinger menyediakan beberapa kategori layanan. Berikut adalah matriks kompatibilitas untuk menjalankan NGA INVENTRA:

| Fitur / Parameter | Hostinger Shared Hosting (Premium/Business) | Hostinger Cloud Hosting (Cloud Startup/Professional) | Hostinger KVM VPS (KVM 1 / KVM 2 / KVM 4) — **Direkomendasikan** |
| :--- | :--- | :--- | :--- |
| **Node.js Engine** | Melalui CloudLinux Node.js Web App / Phusion Passenger | Melalui CloudLinux Node.js Web App / Passenger | Native Node.js v20/v22 LTS via NodeSource/NVM |
| **Batas Memori (RAM)** | 512MB - 1GB (Ketat) | 3GB - 6GB | 4GB - 16GB Dedicated |
| **Background Daemon** | Terbatas (proses sleep jika idle) | Terbatas | Penuh via **PM2** / Systemd (24/7 selalu aktif) |
| **Koneksi Database** | Localhost (`127.0.0.1:3306`) | Localhost (`127.0.0.1:3306`) | Localhost (`127.0.0.1:3306`) / Private Network |
| **Prisma Engine Binary** | Sering bermasalah dengan batas libc / memory saat build | Memungkinkan | 100% Kompatibel (Debian / Ubuntu OpenSSL 3.0) |
| **Web Server** | LiteSpeed + `.htaccess` | LiteSpeed + `.htaccess` | **Nginx Reverse Proxy** + HTTP/2 + SSL Certbot |
| **Rekomendasi Skala** | Hanya Prototyping / Internal Kecil | Operasional Menengah | **Produksi Enterprise & Multi-Cabang** |

> **REKOMENDASI ARSITEKTUR:** Untuk sistem inventaris perusahaan dengan mutasi real-time dan audit trail, sangat disarankan menggunakan **Hostinger KVM VPS (Ubuntu 22.04 / 24.04 LTS)** atau minimal **Hostinger Cloud Hosting**.

---

## 2. Pengaturan Database MySQL di Hostinger

### Langkah 2.1: Buat Database di hPanel (Shared / Cloud) atau Terminal (VPS)
1. Buka dashboard **Hostinger hPanel** -> menu **Databases** -> **MySQL Databases**.
2. Masukkan nama database baru, misalnya: `u123456789_inventra` (hPanel otomatis menambahkan prefix user).
3. Masukkan username database, misalnya: `u123456789_invuser`.
4. Buat password yang kuat (minimal 16 karakter, kombinasi simbol, angka, huruf besar/kecil).
5. Catat kredensial ini untuk dimasukkan ke variabel lingkungan `.env`.

### Langkah 2.2: Catatan Keamanan Remote MySQL
- Secara bawaan, MySQL Hostinger **hanya mendengarkan koneksi dari `localhost` (127.0.0.1)**.
- Fitur **Remote MySQL** di Hostinger mewajibkan IP statis klien. Karena serverless container (seperti AI Studio atau Cloud Run) menggunakan IP egress yang dinamis, koneksi remote langsung dari luar ke Hostinger akan diblokir oleh firewall Hostinger.
- **Solusi Produksi:** Aplikasi Node.js di-deploy langsung di Hostinger. Dengan cara ini, backend Node.js dan MySQL berada di satu server lokal yang sama (`host=localhost` atau `127.0.0.1`), menghasilkan:
  * Latensi query mikrodetik (< 1ms).
  * Bebas dari batasan Remote MySQL firewall.
  * Keamanan maksimal tanpa port database terekspos ke internet publik.

---

## 3. Langkah Deployment di Hostinger VPS (Metode Rekomendasi)

### Langkah 3.1: Persiapan Server VPS
Jalankan perintah berikut di terminal SSH Hostinger VPS:

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Pasang Node.js 22 LTS & Git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx

# Pasang PM2 secara global
sudo npm install -g pm2
```

### Langkah 3.2: Clone Repositori & Konfigurasi Variabel Lingkungan
```bash
# Clone proyek ke /var/www
sudo mkdir -p /var/www/nga-inventra
sudo chown -R $USER:$USER /var/www/nga-inventra
cd /var/www/nga-inventra

# Salin source code proyek
# Buat file .env produksi
nano .env
```

Isi file `.env` dengan format:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL="mysql://u123456789_invuser:PasswordKuatAnda@localhost:3306/u123456789_inventra"
JWT_SECRET="ganti_dengan_random_string_kriptografis_minimal_64_karakter_2026"
```

### Langkah 3.3: Eksekusi Migrasi & Build Otomatis
```bash
# Berikan izin eksekusi script deployment
chmod +x hostinger/deploy.sh

# Jalankan deployment otomatis
./hostinger/deploy.sh
```

Atau jalankan secara manual:
```bash
# 1. Install dependensi
npm install --legacy-peer-deps

# 2. Generate Prisma Client
npx prisma generate

# 3. Sinkronkan skema ke MySQL
npx prisma db push

# 4. (Opsional) Isi data awal/master enterprise
npm run db:seed

# 5. Build aset React
npm run build

# 6. Jalankan proses dengan PM2
pm2 start hostinger/ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

### Langkah 3.4: Konfigurasi Nginx Reverse Proxy & SSL
```bash
# Salin konfigurasi Nginx
sudo cp hostinger/nginx.conf /etc/nginx/sites-available/nga-inventra

# Sesuaikan nama domain Anda
sudo nano /etc/nginx/sites-available/nga-inventra

# Aktifkan situs
sudo ln -s /etc/nginx/sites-available/nga-inventra /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Pasang SSL gratis Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domainanda.com -d www.domainanda.com
```

---

## 4. Langkah Deployment di Hostinger Shared / Cloud Hosting (hPanel)

Jika Anda menggunakan paket Shared/Cloud Hosting berbasis hPanel:

1. **Buka Menu "Node.js" di hPanel**:
   * **Node.js version**: Pilih versi **20.x** atau **22.x**.
   * **Application mode**: `Production`.
   * **Application root**: `nga-inventra`.
   * **Application startup file**: `server.js` (berkas bundle produksi yang dihasilkan oleh `npm run build`).
2. **Unggah Berkas**:
   * Jika menggunakan **GitHub**: Hubungkan repositori di menu Git hPanel, lalu jalankan `npm run build` yang otomatis menghasilkan `dist/` dan `server.js`.
   * Jika menggunakan **ZIP**: Build proyek secara lokal (`npm run build`), lalu arsipkan dan upload ke hPanel File Manager, kemudian ekstrak ke root direktori aplikasi.
3. **Environment Variables di hPanel**:
   * Tambahkan `DATABASE_URL` dan `JWT_SECRET` pada tab Environment Variables di menu Node.js hPanel.
4. **Jalankan Migrasi Database**:
   * Buka phpMyAdmin di hPanel.
   * Pilih database Anda.
   * Klik tab **Import** -> pilih berkas `migrations/init_mysql.sql` -> klik **Go**.
5. **Konfigurasi .htaccess**:
   * Pastikan berkas `hostinger/.htaccess` tersalin ke root direktori web Anda (`public_html/.htaccess`).
6. **Klik "Restart"** pada menu Node.js app di hPanel.

---

## 5. Troubleshooting & Checklist Masalah Umum di Hostinger

| Gejala Error | Penyebab | Solusi |
| :--- | :--- | :--- |
| `ETIMEDOUT` / `ECONNREFUSED` saat koneksi database | MySQL diakses dari luar Hostinger atau port 3306 diblokir firewall. | Gunakan `localhost` atau `127.0.0.1` sebagai host database karena Node.js dan MySQL berada di server yang sama. |
| `PrismaClientInitializationError: Query engine binary not found` | Engine Prisma belum di-generate untuk arsitektur OS Hostinger (Debian/CloudLinux). | Jalankan `npx prisma generate` di server Hostinger setelah `npm install`. |
| Port 3000 conflict (`EADDRINUSE`) | Ada proses lama yang masih berjalan di background. | Hentikan proses lama: `pm2 delete all` atau `lsof -ti :3000 \| xargs kill -9`. |
| Memory Limit Exceeded saat build | Shared hosting memiliki limit memori RAM rendah saat `npm run build`. | Lakukan `npm run build` di komputer lokal Anda, kemudian upload folder `dist/` ke Hostinger. |
| Blank Page pada rute React selain `/` | Server web belum meneruskan seluruh request non-file ke `index.html`. | Pastikan baris fallback Nginx `try_files` atau aturan `.htaccess` sudah aktif. |

---

## 6. Verifikasi Pasca Deployment

Setelah server aktif, verifikasi integrasi sistem:
1. Buka `https://domainanda.com/api/health`.
   * Pastikan respons JSON menunjukkan: `"status": "UP"` dan `"database": { "status": "CONNECTED" }`.
2. Buka menu **Pengaturan** di halaman antarmuka web.
3. Klik tombol **"Uji Koneksi Realtime"**.
   * Sistem akan menjalankan query `SELECT VERSION()` dan `SELECT 1` secara langsung ke database MySQL Hostinger serta menampilkan nilai latensi aktual.
