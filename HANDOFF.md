# NGA INVENTRA - Engineering Handoff Document

**Proyek:** NGA INVENTRA  
**Tahap Saat Ini:** Fase 1 Selesai  
**Arsitektur Target:** React 19 + TypeScript, Express (Node.js 22), MySQL 8.0 dengan Prisma ORM.

---

## 1. Status Pekerjaan (Gap Analysis & Checklist)

### A. Telah Bekerja Nyata (Fully Working & Verified):
1. **Express Server API:** Berjalan di port 3000 (`server.ts`) dengan routing `/api/*` lengkap.
2. **Server-Side Authentication:** Password hashing dengan PBKDF2-SHA512 + salt, stateful session tokens (HMAC-SHA256), dan pemeriksaan izin (RBAC).
3. **Pemisahan Domain Consumable vs Serialized Asset:** Master item dengan validasi eksplisit penolakan pendaftaran unit serial pada item berstatus consumable.
4. **Pencegahan Stok Negatif:** Validasi row-locking di backend dan verifikasi UI secara real-time.
5. **Pencegahan Double-Submit:** Pengenalan `idempotencyKey` pada seluruh mutasi stok.
6. **Mutasi Antar Gudang:** Pengurangan di gudang asal dan penambahan di gudang tujuan dengan pelestarian total saldo persediaan.
7. **Jejak Audit Otomatis (Audit Trail):** Pencatatan kronologis ke log audit digital pada setiap mutasi, pembuatan master barang, dan pergantian penanggung jawab aset.
8. **Unit Tests (node:test):** 6 skenario pengujian dieksekusi secara nyata dan lulus 100%.
9. **UI/UX Enterprise:** Responsive sidebar, command palette (⌘K), drawer rincian barang/aset, modal formulir, light/dark mode switch, dan visualisasi grafik persediaan.
10. **MySQL 8 Migration & Prisma Blueprint:** File DDL SQL (`migrations/init_mysql.sql`), schema Prisma (`prisma/schema.prisma`), dan stack docker phpMyAdmin (`docker-compose.yml`) telah disusun lengkap.

### B. Status Koneksi Database MySQL (Laporan Mandatori):
- **Status:** `BELUM TERVERIFIKASI TERHADAP INSTANCE MYSQL EKSTERNAL`
- **Penyebab:** Container runner lingkungan preview AI Studio bersifat isolated dan tidak memiliki daemon layanan `mysqld` aktif secara lokal.
- **Solusi Yang Telah Disediakan:** Sistem menggunakan **Hybrid Persistence Engine** (Local atomic JSON store pada `.data/inventra-db.json`) sehingga data transaksi, mutasi, master barang, dan aset tetap **tersimpan secara persisten** saat dev server direstart, sekaligus menyediakan artefak migrasi MySQL 8 dan Docker Compose siap pakai saat aplikasi dideploy ke server produksi.

### C. Rencana Fase 2 (Untuk Model AI / Engineer Berikutnya):
1. Menghubungkan client Prisma ke instance Cloud SQL / RDS MySQL menggunakan `DATABASE_URL`.
2. Menjalankan `npx prisma db push` atau `npx prisma migrate deploy` di lingkungan hosting produksi.
3. Integrasi cetak label barcode / QR Code fisik ke printer thermal (Zebra ZPL / ESC/POS driver).
4. Penambahan modul notifikasi email / webhook untuk persetujuan dokumen berstatus `PENDING`.
5. Integrasi barcode scanner fisik via WebHID / USB keyboard emulation.

---

## 2. Struktur Direktori Proyek

```
/
├── prisma/
│   └── schema.prisma         # Skema relasional MySQL 8
├── migrations/
│   └── init_mysql.sql        # DDL migration script siap eksekusi
├── server/
│   ├── db/
│   │   ├── types.ts          # Kontrak interface domain
│   │   ├── seedData.ts       # Dataset awal enterprise
│   │   └── store.ts          # Repository persistence & transaction runner
│   └── security/
│       └── auth.ts           # PBKDF2 hashing, HMAC token & RBAC middleware
├── src/
│   ├── components/
│   │   ├── common/           # DataTable, Modal, Drawer, Badges, Charts
│   │   └── layout/           # Header, Sidebar, CommandPalette
│   ├── context/              # AuthContext, ThemeContext, NotificationContext
│   ├── pages/                # 15 Halaman modul enterprise
│   ├── services/
│   │   └── api.ts            # Client adapter API
│   ├── types/
│   │   └── index.ts          # Domain type definitions
│   ├── App.tsx               # Entry point aplikasi
│   └── index.css             # Tailwind 4 styling
├── test/
│   └── stockRules.test.ts    # Unit tests (node:test)
├── docker-compose.yml        # Stack MySQL 8 + phpMyAdmin
├── server.ts                 # Express full-stack entry point
├── README.md                 # Dokumentasi umum & panduan cepat
├── DESIGN_SYSTEM.md          # Spesifikasi sistem desain & token UI
├── SYSTEM_BLUEPRINT.md       # Blueprint arsitektur & kontrak API
└── HANDOFF.md                # Dokumen serah terima ini
```

---

## 3. Hasil Eksekusi Pengujian Otomatis

Perintah yang dijalankan: `node --test`
```
TAP version 13
# Subtest: RBAC: Super Admin has full system permissions
ok 1 - RBAC: Super Admin has full system permissions
# Subtest: RBAC: Inventory Staff cannot approve movements or manage users
ok 2 - RBAC: Inventory Staff cannot approve movements or manage users
# Subtest: Stock Rules: Prevent negative stock on goods issue (OUT)
ok 3 - Stock Rules: Prevent negative stock on goods issue (OUT)
# Subtest: Idempotency: Re-submitting the same idempotencyKey returns existing movement without duplicate deduction
ok 4 - Idempotency: Re-submitting the same idempotencyKey returns existing movement without duplicate deduction
# Subtest: Domain Separation: Consumable items cannot be registered as unique serialized asset units
ok 5 - Domain Separation: Consumable items cannot be registered as unique serialized asset units
# Subtest: Transfer Mutation: Total stock across warehouses remains conserved
ok 6 - Transfer Mutation: Total stock across warehouses remains conserved
1..6
# tests 6
# suites 0
# pass 6
# fail 0
```
