# Arsitektur Vercel Cloud Migration — NGA INVENTRA

Dokumen ini mendokumentasikan spesifikasi arsitektur cloud untuk memigrasikan sistem **NGA INVENTRA Enterprise Inventory & Serialized Asset Management** ke platform **Vercel** menggunakan pola arsitektur **Vite React SPA + Express Serverless Function + Prisma ORM + Managed MySQL Database**.

---

## 1. Ringkasan Eksekutif & Tujuan

| Parameter | Konfigurasi Lama (Hostinger) | Arsitektur Baru (Vercel Cloud) |
| :--- | :--- | :--- |
| **Compute Engine** | Single persistent Node.js process via PM2 | Distributed Serverless Functions (AWS Lambda / Vercel Edge) |
| **Frontend Serving** | Express static middleware (`dist/`) | Vercel Edge Network Global CDN |
| **API Handling** | Monolithic `app.listen(3000)` | Serverless entrypoint `/api` via `api/index.ts` |
| **Database Connection** | Localhost MySQL socket (`127.0.0.1:3306`) | Managed Cloud MySQL via TCP/SSL & connection pooling |
| **Routing & SPA** | Express wildcard `app.get('*')` | `vercel.json` native edge rewrites |
| **Lisensi & Skala** | Hostinger Cloud Hosting (berbagi dengan `p4ijournal.org`) | Vercel Hobby (staging/demo non-komersial) / Pro (Enterprise) |

---

## 2. Diagram Alur Sistem (Architecture Diagram)

```text
[ Klien Web / Mobile ]
         │
         ▼
[ Vercel Edge Network CDN (Anycast DNS & SSL) ]
         │
         ├──► Jika request path = "/api/*" 
         │         │
         │         ▼
         │    [ Vercel Serverless Function: api/index.ts ]
         │         │
         │         ├──► Middleware (Auth JWT, CORS, Audit Logger)
         │         ├──► Express Router (server/app.ts)
         │         │
         │         ▼
         │    [ Prisma ORM Client (Singleton with Serverless Pool) ]
         │         │
         │         ▼ (Encrypted TLS / Port 3306)
         │    [ Managed MySQL Database (Staging / Production) ]
         │
         └──► Jika request path = "/*" (Aset Statis & SPA Pages)
                   │
                   ▼
              [ Vite Build Assets: dist/index.html & assets/*.js ]
```

---

## 3. Adaptasi Backend untuk Serverless (Zero-Downtime Dual Runtime)

### A. Modularisasi Express (`server/app.ts`)
Seluruh middleware, routing bisnis (`/api/items`, `/api/movements`, `/api/assets`, `/api/opnames`), validasi otorisasi RBAC, dan audit trail dipisahkan ke dalam pabrik aplikasi murni `createApp()` pada `server/app.ts`. 

- **Tidak ada pemanggilan `app.listen()` di dalam `server/app.ts`**: Menjadikan aplikasi 100% portabel untuk dipanggil oleh serverless handler maupun runtime tradisional.
- **Proteksi 404 API Khusus**: Request yang salah ketik pada `/api/*` dijamin mengembalikan JSON `{ error: "Endpoint API tidak ditemukan" }` dan tidak pernah membocorkan berkas HTML frontend.

### B. Serverless Handler Entrypoint (`api/index.ts`)
Vercel mendeteksi direktori `/api` secara otomatis. Berkas `api/index.ts` mengimpor `createApp()` dan membungkusnya dengan mekanisme **Cold-Start Caching**:

```ts
import { createApp } from '../server/app.ts';
import { repoManager } from '../server/db/repository.ts';

const app = createApp();
let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = repoManager.init().then(() => {
      initialized = true;
    }).catch(err => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

export default async function handler(req: any, res: any) {
  await ensureInitialized();
  return app(req, res);
}
```

### C. Kompatibilitas Runtime Lokal & Serverless
- Di lingkungan lokal / dev: `server.ts` tetap berjalan via `tsx server.ts` mengikat port 3000 dengan Vite middlewares.
- Di lingkungan Vercel: Vercel mengeksekusi `api/index.ts` secara serverless tanpa memerlukan proses `server.listen()`.

---

## 4. Konfigurasi Routing & SPA Fallback (`vercel.json`)

Berkas `vercel.json` mengonfigurasi aturan rewrite native pada Vercel Edge:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- Seluruh request berawalan `/api/` diteruskan ke Serverless Function `api/index.ts`.
- Seluruh rute antarmuka SPA (`/inventory`, `/assets`, `/movements`, `/settings`) diteruskan ke `dist/index.html` dengan kode HTTP 200, memungkinkan React Router memproses navigasi di sisi klien tanpa error 404.

---

## 5. Manajemen Koneksi Database Serverless (Connection Pooling)

Lingkungan serverless dapat memicu banyak instance Lambda secara paralel saat traffic melonjak. Untuk mencegah kehabisan koneksi (*Connection Exhaustion*):

1. **Prisma Client Singleton via `globalThis`**:
   Instance Prisma Client dan MySQL2 Pool di-cache pada `globalThis` sehingga instance fungsi yang hangat (*warm container*) menggunakan kembali koneksi yang sudah terbuka.
2. **Serverless Connection Tuning**:
   Pada `server/db/connection.ts`, `connectionLimit` diatur ke **3 koneksi per function instance** saat berjalan di serverless (`process.env.VERCEL`), dibanding 10 koneksi pada server konvensional.
3. **Multi-Target Query Engine Binaries**:
   Generator Prisma di `prisma/schema.prisma` menyertakan binary AWS Lambda:
   `binaryTargets = ["native", "debian-openssl-3.0.x", "debian-openssl-1.1.x", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]`

---

## 6. Penghapusan Ketergantungan Filesystem Persisten

Di lingkungan serverless Vercel, sistem berkas bersifat *ephemeral* dan *read-only* (kecuali direktori sementara `/tmp`).

- **Larangan JSON Storage di Produksi**: Mode produksi (`NODE_ENV=production` atau `VERCEL=1`) mewajibkan `DATABASE_URL` yang sah ke database MySQL.
- Sistem secara eksplisit menolak (*fail-fast*) dan melempar error fatal jika database belum terhubung di mode produksi, mencegah penyimpanan data ke berkas JSON lokal yang akan hilang saat container serverless di-recycle.

---

## 7. Ketentuan Vercel Hobby vs Vercel Pro

- **Vercel Hobby Plan**: Diperuntukkan untuk proyek personal, demo portofolio, dan staging pengujian non-komersial. Batas serverless execution timeout: **10 detik**.
- **Vercel Pro Plan**: Diperlukan apabila NGA INVENTRA telah masuk ke fase operasional komersial penuh perusahaan dengan SLA, batas timeout hingga 60 detik, serta dukungan tim kolaboratif.
