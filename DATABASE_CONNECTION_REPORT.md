# Laporan Evaluasi Koneksi Database MySQL — NGA INVENTRA

Dokumen ini memaparkan hasil audit kelayakan konektivitas database antara platform **Vercel Serverless Functions** dengan berbagai penyedia layanan basis data MySQL, serta status verifikasi koneksi aktual saat ini.

---

## 1. Status Verifikasi Koneksi dari Runtime Saat Ini

- **Status Konektivitas Database**: **`NOT_CONFIGURED`** (Belum Dikonfigurasi)
- **Engine Aktif di AI Studio**: `STANDALONE_STORE` (Sandbox Isolated Store)
- **Status Pemeriksaan Internal (`/api/health`)**:
  ```json
  {
    "status": "UP",
    "environment": "development",
    "runtime": "node-process",
    "activeEngine": "STANDALONE_STORE",
    "database": {
      "status": "NOT_CONFIGURED",
      "engine": "JSON_SIMULATION",
      "latencyMs": null,
      "databaseVersion": null,
      "host": null,
      "error": "Variabel lingkungan DATABASE_URL belum diatur."
    }
  }
  ```
- **Kepatuhan Protokol Kejujuran Teknis**:
  Sesuai instruksi audit, kami **tidak mengklaim koneksi database CONNECTED** karena variabel lingkungan `DATABASE_URL` belum diinjeksikan ke dalam runtime AI Studio. Koneksi hanya akan dinyatakan `CONNECTED` apabila query `SELECT 1` dan `SELECT VERSION()` berhasil dieksekusi secara nyata dari server.

---

## 2. Analisis & Discovery Opsi Penyedia Database MySQL

### Opsi A: MySQL Hostinger Eksisting (yang saat ini berada di server yang sama dengan `p4ijournal.org`)

| Parameter | Evaluasi Teknis |
| :--- | :--- |
| **Kelebihan** | Tidak ada biaya tambahan karena sudah termasuk dalam paket hosting Hostinger Anda. Menggunakan phpMyAdmin hPanel yang sudah familiar. |
| **Kendala Utama (Blocker)** | **Firewall Remote MySQL & Dynamic IP Vercel**: Vercel Serverless berjalan di atas kluster AWS Lambda dengan IP egress publik yang dinamis. Hostinger Remote MySQL secara default mewajibkan input IP statis klien. Mengizinkan wildcard (`%` atau `0.0.0.0/0`) pada port 3306 shared hosting sangat berisiko terhadap serangan brute-force dan berpotensi membebani server jurnal `p4ijournal.org`. |
| **Batas Koneksi** | Paket shared/cloud hosting umumnya memiliki limit `max_connections` (30 - 50 koneksi serentak). Lonjakan traffic serverless dapat memicu error `Too many connections` yang dapat berdampak buruk pada database website jurnal. |
| **Kesimpulan Opsi A** | **TIDAK DIREKOMENDASIKAN UNTUK VERCEL SERVERLESS** demi menjamin stabilitas dan keamanan website `p4ijournal.org`. |

---

### Opsi B: Managed Cloud MySQL (Direkomendasikan untuk Vercel)

Penyedia database cloud terkelola berikut dirancang khusus untuk arsitektur serverless, mendukung TLS/SSL wajib, dan dapat diakses dari IP dinamis Vercel:

| Provider | Paket & Biaya | Lokasi Region | Fitur & Dukungan Vercel |
| :--- | :--- | :--- | :--- |
| **Aiven for MySQL** | **Free Tier Selamanya** (1 node, 5 GB storage, 1 GB RAM, 1 CPU) | Singapura (`ap-southeast-1`), Frankfurt (`eu-central-1`) | Wajib TLS/SSL, auto-backup harian, kompatibel 100% dengan Prisma ORM & MySQL 8. |
| **Railway MySQL** | $5 free trial credit bulanan / Pay-as-you-go | Asia Pasifik / US East | Near-instant provisioning, built-in TLS, dashboard visual bawaan. |
| **PlanetScale** | Mulai $39/bln (tidak ada free tier) | Global Edge | Skalabilitas tak terbatas, arsitektur Vitess (tidak mendukung foreign key konvensional). |
| **Google Cloud SQL (MySQL)** | Free trial GCP $300 / Pay-per-use | Jakarta (`asia-southeast2`) | Latensi terendah untuk pengguna Indonesia (< 15ms), SSL CA certs, enterprise SLA. |

> **REKOMENDASI TERBAIK UNTUK STAGING & DEMO:** **Aiven for MySQL (Free Tier)**
> - Bebas biaya operasional untuk staging dan demo portofolio.
> - Menyediakan koneksi aman via SSL/TLS secara default.
> - Menggunakan engine standar MySQL 8.0 murni sehingga mendukung 100% relasi foreign key pada `prisma/schema.prisma` tanpa modifikasi apapun.

---

### Opsi C: Alternatif Serverless Database (PostgreSQL / Supabase / Neon)
- Prisma mendukung PostgreSQL secara native, namun schema NGA Inventra saat ini (`prisma/schema.prisma` dan migrasi `20261018000000_init_mysql/migration.sql`) menggunakan tipe data dan sintaks khusus MySQL (seperti `DATETIME(3)`, `JSON`, enum native, dan indeks InnoDB).
- **Keputusan:** Tetap menggunakan **MySQL 8.0** pada cloud database untuk menghindari risiko *schema drift* dan perubahan kontrak data.

---

## 3. Catatan Keamanan phpMyAdmin

1. **phpMyAdmin Adalah Alat Bantu, Bukan Database**:
   - phpMyAdmin hanyalah antarmuka web (GUI) untuk mempermudah eksekusi query DDL/DML.
   - Jangan pernah menganggap phpMyAdmin sebagai mesin database.
2. **Keamanan phpMyAdmin**:
   - Jika Anda menggunakan phpMyAdmin di Hostinger, akses tersebut sudah terlindungi di dalam session login hPanel.
   - Jangan pernah memasang phpMyAdmin publik tanpa proteksi IP whitelist atau Cloudflare Access di depan domain produksi.

---

## 4. Format `DATABASE_URL` yang Kompatibel dengan Vercel

Ketika Anda telah membuat database MySQL di provider cloud (misal Aiven atau Google Cloud SQL):

```env
DATABASE_URL="mysql://<USERNAME>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?sslaccept=strict"
```

- Parameter `sslaccept=strict` memastikan seluruh traffic data inventaris, mutasi stok, dan data aset dienkripsi via TLS 1.3 selama transit melalui internet dari Vercel ke database server.
