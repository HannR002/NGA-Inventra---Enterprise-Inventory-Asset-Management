# NGA INVENTRA - Enterprise Inventory & Serialized Asset Management System

**Versi:** 1.0.0-phase1  
**Status Implementasi:** FASE 1 SELESAI (Arsitektur Backend, Domain Modeling, Database Migrations, UI Enterprise, Unit Tests Terverifikasi)  
**Database Readiness:** MySQL 8.0 DDL & Prisma Schema Siap; Engine Hybrid Server Active.

---

## 1. Ringkasan Eksekutif

NGA INVENTRA adalah sistem manajemen inventaris dan aset tetap kelas enterprise yang dirancang khusus untuk memecahkan kompleksitas persediaan multi-gudang, pemisahan mutlak antara **barang habis pakai (consumable stock)** dengan **unit aset bernomor seri unik (serialized asset)**, serta penegakan integritas data melalui transaksi atomik, row-locking, pencegahan stok negatif, dan audit trail digital.

---

## 2. Fitur Utama yang Telah Diimplementasikan

| Modul | Status | Keterangan Fungsional |
|---|---|---|
| **Dashboard Analytics** | ✅ Berjalan Penuh | KPI valuasi total, rasio perputaran stok, chart pergerakan bulanan, grafik distribusi kategori, notifikasi stok minimum. |
| **Master Barang & SKU** | ✅ Berjalan Penuh | Manajemen SKU/Barcode, klasifikasi `CONSUMABLE` vs `SERIALIZED_ASSET`, ambang batas minimum/safety stock, reorder point, dan valuasi unit. |
| **Pemisahan Domain Aset** | ✅ Berjalan Penuh | Satu SKU aset dapat menaungi multi-unit fisik dengan Asset Tag & Serial Number unik, penanggung jawab (custodian), riwayat mutasi, dan kondisi fisik. |
| **Barang Masuk (Inbound)** | ✅ Berjalan Penuh | Input penerimaan barang via PO/Surat Jalan, proteksi idempotency key (anti-double submit), kalkulasi penambahan stok gudang otomatis. |
| **Barang Keluar (Outbound)** | ✅ Berjalan Penuh | Validasi ketat pencegahan stok negatif di level server & UI, alokasi departemen, update saldo gudang otomatis. |
| **Mutasi Antar Gudang** | ✅ Berjalan Penuh | Transfer stok dari gudang asal ke tujuan dengan prinsip pelestarian total persediaan (conservation of stock). |
| **Stock Opname** | ✅ Berjalan Penuh | Rekonsiliasi hitung fisik vs saldo sistem, kalkulasi otomatis selisih unit dan nilai varians rupiah (discrepancy value). |
| **Permintaan Barang (Requisitions)** | ✅ Berjalan Penuh | Pengajuan permohonan barang internal divisi dengan multi-tier approval workflow. |
| **RBAC & Matriks Izin** | ✅ Berjalan Penuh | 5 Peran: Super Admin, Warehouse Manager, Inventory Staff, Asset Custodian, Auditor dengan 16 hak akses terisolasi. |
| **Audit Trail Digital** | ✅ Berjalan Penuh | Pencatatan kronologis otomatis seluruh aksi sensitif dengan timestamp, operator ID, IP address, dan payload JSON. |
| **Diagnostik MySQL 8** | ✅ Berjalan Penuh | Konfigurasi connection string, schema Prisma (`prisma/schema.prisma`), DDL migration (`migrations/init_mysql.sql`), dan stack Docker phpMyAdmin. |

---

## 3. Akun Demo & Kredensial Pengujian

Password telah di-hash menggunakan **PBKDF2-SHA512** dengan 16-byte cryptographic salt (bukan plaintext):

| Peran (Role) | Email Login | Password Demo | Cakupan Akses |
|---|---|---|---|
| **Super Admin** | `admin@nga-inventra.com` | `AdminSecurePass2026!` | Hak akses penuh ke seluruh modul, konfigurasi, dan pengguna |
| **Warehouse Manager** | `manager@nga-inventra.com` | `ManagerPass2026!` | Otorisasi mutasi stok, transfer, persetujuan opname, laporan |
| **Inventory Staff** | `staff@nga-inventra.com` | `StaffPass2026!` | Input barang masuk (inbound) & barang keluar (outbound) |
| **Asset Custodian** | `custodian@nga-inventra.com` | `CustodianPass2026!` | Registrasi nomor seri aset, serah terima penanggung jawab |
| **Internal Auditor** | `auditor@nga-inventra.com` | `AuditorPass2026!` | Read-only audit trail digital dan laporan finansial |

---

## 4. Panduan Menjalankan Sistem

### Mode Pengembangan (Current Container):
```bash
# Server Express + Vite di port 3000
npm run dev

# Menjalankan Unit Tests (node:test)
npm test
```

### Menjalankan Stack MySQL 8 & phpMyAdmin di Mesin Lokal:
```bash
# 1. Start MySQL 8 & phpMyAdmin via Docker
docker compose up -d

# 2. Akses phpMyAdmin
# URL: http://localhost:8080
# Username: root
# Password: rootpassword

# 3. Jalankan migrasi Prisma
npx prisma migrate dev --name init_mysql
```

---

## 5. Ringkasan Pengujian Otomatis (Node:test)

6 unit test logika inti telah dieksekusi dan **100% LULUS**:
1. `RBAC: Super Admin has full system permissions`: **PASS**
2. `RBAC: Inventory Staff cannot approve movements or manage users`: **PASS**
3. `Stock Rules: Prevent negative stock on goods issue (OUT)`: **PASS**
4. `Idempotency: Re-submitting same key returns existing without duplicate deduction`: **PASS**
5. `Domain Separation: Consumable items cannot be registered as unique serialized asset units`: **PASS**
6. `Transfer Mutation: Total stock across warehouses remains conserved`: **PASS**
