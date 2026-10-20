# Laporan Hasil Pengujian & Verifikasi — NGA INVENTRA

Dokumen ini memuat catatan eksekusi pengujian otomatis (*automated testing*), verifikasi integritas data, dan validasi build sistem **NGA INVENTRA Enterprise Inventory & Serialized Asset Management**.

---

## 1. Ringkasan Eksekutif Hasil Pengujian

| Kategori Pengujian | Jumlah Kasus Uji | Status Hasil |
| :--- | :--- | :--- |
| **Unit & Integration Tests (`node --test`)** | 16 Kasus Uji | **16 PASS (100%)** |
| **TypeScript Typecheck (`tsc --noEmit`)** | Seluruh Codebase | **PASS (0 Errors)** |
| **Production Bundle Compilation (`npm run build`)** | Frontend + Backend | **PASS (Clean Build)** |
| **Vercel Serverless Function Handler (`api/index.ts`)** | Import & Signature Check | **PASS (Exported Handler)** |
| **Live Remote MySQL Query (`SELECT 1`)** | Runtime AI Studio -> External DB | **BLOCKED (Menunggu Kredensial Pengguna)** |

---

## 2. Rincian Eksekusi 16 Kasus Uji Otomatis

Pengujian dijalankan langsung melalui Node.js Test Runner:

```text
TAP version 13
# Subtest: Database URL: Safely parse credentials and mask passwords without leaks
ok 1 - Database URL: Safely parse credentials and mask passwords without leaks  ---  duration_ms: 1.24  type: 'test'  ...
# Subtest: OWASP Security: 210,000-iteration PBKDF2-SHA512 password hashing, timing-safe verification, and legacy hash migration
ok 2 - OWASP Security: 210,000-iteration PBKDF2-SHA512 password hashing, timing-safe verification, and legacy hash migration  ---  duration_ms: 379.91  type: 'test'  ...
# Subtest: Security: Stateless JWT generation and verification
ok 3 - Security: Stateless JWT generation and verification  ---  duration_ms: 0.92  type: 'test'  ...
# Subtest: Schema Alignment: init_mysql.sql and prisma/migrations/20261018000000_init_mysql/migration.sql align with Prisma schema mappings
ok 4 - Schema Alignment: init_mysql.sql and prisma/migrations/20261018000000_init_mysql/migration.sql align with Prisma schema mappings  ---  duration_ms: 0.78  type: 'test'  ...
# Subtest: Stock Transaction Atomicity & Rollback: Multi-item failure preserves initial balance
ok 5 - Stock Transaction Atomicity & Rollback: Multi-item failure preserves initial balance  ---  duration_ms: 5.00  type: 'test'  ...
# Subtest: Concurrency Protection: Simultaneous stock deductions prevent overdrawing below zero
ok 6 - Concurrency Protection: Simultaneous stock deductions prevent overdrawing below zero  ---  duration_ms: 16.05  type: 'test'  ...
# Subtest: Serialized Asset Domain Consistency: Stock balance and asset units cannot diverge
ok 7 - Serialized Asset Domain Consistency: Stock balance and asset units cannot diverge  ---  duration_ms: 2.16  type: 'test'  ...
# Subtest: Idempotency & Duplicate Prevention: Re-submitting same idempotencyKey returns existing movement without extra deduction
ok 8 - Idempotency & Duplicate Prevention: Re-submitting same idempotencyKey returns existing movement without extra deduction  ---  duration_ms: 8.42  type: 'test'  ...
# Subtest: Transfer Mutation Conservation: Stock transferred between warehouses preserves total global balance
ok 9 - Transfer Mutation Conservation: Stock transferred between warehouses preserves total global balance  ---  duration_ms: 3.68  type: 'test'  ...
# Subtest: Stock Opname & Discrepancy Reconciliation: Records variance and adjusts stock accurately
ok 10 - Stock Opname & Discrepancy Reconciliation: Records variance and adjusts stock accurately  ---  duration_ms: 6.63  type: 'test'  ...
# Subtest: RBAC: Super Admin has full system permissions
ok 11 - RBAC: Super Admin has full system permissions  ---  duration_ms: 0.89  type: 'test'  ...
# Subtest: RBAC: Inventory Staff cannot approve movements or manage users
ok 12 - RBAC: Inventory Staff cannot approve movements or manage users  ---  duration_ms: 0.24  type: 'test'  ...
# Subtest: Stock Rules: Prevent negative stock on goods issue (OUT)
ok 13 - Stock Rules: Prevent negative stock on goods issue (OUT)  ---  duration_ms: 7.14  type: 'test'  ...
# Subtest: Idempotency: Re-submitting the same idempotencyKey returns existing movement without duplicate deduction
ok 14 - Idempotency: Re-submitting the same idempotencyKey returns existing movement without duplicate deduction  ---  duration_ms: 6.30  type: 'test'  ...
# Subtest: Domain Separation: Consumable items cannot be registered as unique serialized asset units
ok 15 - Domain Separation: Consumable items cannot be registered as unique serialized asset units  ---  duration_ms: 2.81  type: 'test'  ...
# Subtest: Transfer Mutation: Total stock across warehouses remains conserved
ok 16 - Transfer Mutation: Total stock across warehouses remains conserved  ---  duration_ms: 2.89  type: 'test'  ...

1..16
# tests 16
# pass 16
# fail 0
# cancelled 0
# skipped 0
# duration_ms: 852.46
```

---

## 3. Matriks Hasil Pengujian Terperinci

| No | Nama Kasus Uji | Cakupan Modul | Kriteria Keberhasilan | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Database URL Parsing & Masking** | `server/db/connection.ts` | Password tidak pernah bocor ke string masked; host, port, db terurai benar. | **PASS** |
| 2 | **OWASP PBKDF2 Password Hashing** | `server/security/auth.ts` | 210.000 iterasi terverifikasi, salt acak kriptografis 16-byte, backward compatibility hash lama. | **PASS** |
| 3 | **Stateless JWT Validation** | `server/security/auth.ts` | Token valid dapat didekode; token rusak (*tampered*) ditolak seketika. | **PASS** |
| 4 | **Schema Alignment (17 Tables)** | `prisma/schema.prisma` & `migrations` | 17 tabel MySQL identik dengan `@map` Prisma tanpa anomali. | **PASS** |
| 5 | **Transaction Atomicity & Rollback** | `server/db/store.ts` & `mysqlRepository.ts` | Jika item kedua gagal karena stok kurang, item pertama batal dipotong (*rollback*). | **PASS** |
| 6 | **Concurrency Protection** | `server/db/store.ts` & `mysqlRepository.ts` | 3 mutasi paralel meminta 30 unit dari stok 15; hanya 1 berhasil, sisa ditolak, stok tidak pernah minus. | **PASS** |
| 7 | **Serialized Asset Consistency** | `server/db/store.ts` & `mysqlRepository.ts` | Item bertipe `CONSUMABLE` ditolak jika didaftarkan sebagai serial asset; jumlah serial aktif selaras. | **PASS** |
| 8 | **Idempotency Multi-Submit** | `server/db/store.ts` & `mysqlRepository.ts` | Request ganda dengan `idempotencyKey` yang sama mengembalikan transaksi awal tanpa pemotongan dobel. | **PASS** |
| 9 | **Transfer Stock Conservation** | `server/db/store.ts` & `mysqlRepository.ts` | Mutasi transfer antar 2 gudang mempertahankan jumlah total inventaris global. | **PASS** |
| 10 | **Stock Opname Reconciliation** | `server/db/store.ts` & `mysqlRepository.ts` | Selisih fisik vs sistem dicatat; mutasi `ADJUSTMENT` merekonsiliasi stok sesuai data opname. | **PASS** |
| 11 | **RBAC: Super Admin Privileges** | `server/security/auth.ts` | Memiliki akses ke modul item, warehouse, movement, asset, opname, settings. | **PASS** |
| 12 | **RBAC: Inventory Staff Limits** | `server/security/auth.ts` | Dilarang menyetujui mutasi transfer (`movements:approve`) atau mengelola pengguna. | **PASS** |
| 13 | **Negative Stock Prevention (OUT)** | `server/db/store.ts` | Menolak transaksi pengeluaran barang jika kuantitas melebihi stok tersedia di gudang asal. | **PASS** |
| 14 | **Idempotency Return Value Check** | `server/db/store.ts` | Memastikan kembalian transaksi identik dengan ID mutasi awal. | **PASS** |
| 15 | **Domain Type Enforcement** | `server/db/store.ts` | Validasi tipe `CONSUMABLE` vs `SERIALIZED_ASSET` pada level business rules. | **PASS** |
| 16 | **Transfer Balance Conservation** | `server/db/store.ts` | Memastikan saldo gudang asal berkurang dan saldo gudang tujuan bertambah sesuai kuantitas. | **PASS** |

---

## 4. Status Pengujian yang Diberi Label BLOCKED

| Item Pengujian | Penyebab BLOCKED | Tindakan yang Diperlukan |
| :--- | :--- | :--- |
| **Live Remote MySQL Query via TCP/SSL** | Variabel lingkungan `DATABASE_URL` belum diberikan/dikonfigurasi pada lingkungan AI Studio. | Pengguna mengonfigurasikan `DATABASE_URL` ke database cloud target ketika sudah siap melakukan pengujian langsung. |
| **Vercel Preview Deployment Smoke Test** | Akun Vercel belum diotorisasi di dalam session AI Studio (tidak ada token Vercel CLI). | Pengguna melakukan import repositori via dashboard Vercel sesuai panduan `VERCEL_DEPLOYMENT_GUIDE.md`. |
