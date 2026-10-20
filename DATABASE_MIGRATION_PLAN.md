# Rencana Migrasi Database Terstandar — NGA INVENTRA

Dokumen ini mendefinisikan prosedur resmi migrasi basis data **NGA INVENTRA** ke database MySQL target menggunakan **Prisma Migrate** sebagai satu-satunya mekanisme migrasi yang sah (*Single Source of Truth*).

---

## 1. Standarisasi Mekanisme Migrasi Tunggal

Untuk mencegah kerusakan skema (*schema drift*) dan anomali data:

- **Perintah Resmi Tunggal**: **`npx prisma migrate deploy`**
- **Berkas Baseline Resmi**: `prisma/migrations/20261018000000_init_mysql/migration.sql`
- **Konfigurasi Provider**: `prisma/migrations/migration_lock.toml` (`provider = "mysql"`)

### Larangan Keras:
1. **Dilarang menggunakan `prisma db push`** pada database staging maupun produksi. Perintah `db push` tidak mencatat riwayat migrasi pada tabel `_prisma_migrations`, mengabaikan riwayat perubahan, dan berisiko menghapus kolom/tabel (*data loss*).
2. **Dilarang menggabungkan import SQL manual dengan Prisma Migrate** secara acak. Seluruh struktur database harus tercatat dalam riwayat migrasi Prisma.

---

## 2. Verifikasi Keselarasan 17 Tabel Relasional (Zero Drift)

Skema Prisma (`prisma/schema.prisma`) dan berkas migrasi SQL (`prisma/migrations/20261018000000_init_mysql/migration.sql`) telah diverifikasi identik 100% pada 17 entitas tabel:

| No | Nama Tabel MySQL | Model Prisma | Tipe & Relasi Kunci |
| :--- | :--- | :--- | :--- |
| 1 | `users` | `User` | Primary key `id`, unique `email`, enum `RoleType` |
| 2 | `categories` | `Category` | Unique `code`, relasi 1:N ke `items` |
| 3 | `units` | `Unit` | Unique `symbol`, relasi 1:N ke `items` |
| 4 | `suppliers` | `Supplier` | Unique `code`, relasi 1:N ke `items` & `stock_movements` |
| 5 | `warehouses` | `Warehouse` | Unique `code`, relasi ke `users` (manager) & `locations` |
| 6 | `warehouse_locations` | `WarehouseLocation` | Unique composite `(warehouseId, code)` |
| 7 | `items` | `Item` | Unique `sku`, unique `barcode`, pemisahan `itemType` |
| 8 | `stock_balances` | `WarehouseStock` | Unique composite `(itemId, warehouseId)`, `CHECK (quantity >= 0)` |
| 9 | `stock_movements` | `StockMovement` | Unique `movementNumber`, unique `idempotencyKey` |
| 10 | `stock_movement_details` | `StockMovementDetail` | Foreign key cascade ke `stock_movements` |
| 11 | `asset_units` | `SerializedAsset` | Unique `assetTag`, unique `serialNumber`, foreign key ke `items` |
| 12 | `asset_assignments` | `AssetAssignment` | Riwayat peminjaman aset serialized dengan kondisi fisik |
| 13 | `stock_opnames` | `StockOpname` | Unique `opnameNumber`, jadwal opname per gudang |
| 14 | `stock_opname_details` | `StockOpnameDetail` | Selisih fisik vs sistem, nilai diskrepansi finansial |
| 15 | `item_requests` | `ItemRequest` | Permintaan barang dari departemen internal |
| 16 | `item_request_details` | `ItemRequestDetail` | Daftar item dan kuantitas yang diminta |
| 17 | `audit_logs` | `AuditLog` | Audit trail immutable dengan metadata JSON dan user ID |

---

## 3. Prosedur Eksekusi Migrasi Langkah demi Langkah

### Tahap 1: Backup Database (Bila Menggunakan Database dengan Data Eksisting)
Sebelum menjalankan migrasi pada basis data yang sudah memiliki data:
```bash
# Lakukan logical dump lengkap menggunakan mysqldump
mysqldump -u <USER> -p -h <HOST> -P <PORT> --single-transaction --routines --triggers <DATABASE_NAME> > backup_before_migration_$(date +%F).sql
```

### Tahap 2: Eksekusi Migrasi Prisma
Dari terminal lokal atau runner CI/CD:
```bash
# 1. Pastikan variabel lingkungan DATABASE_URL terpasang
export DATABASE_URL="mysql://<USER>:<PASS>@<HOST>:<PORT>/<DATABASE>?sslaccept=strict"

# 2. Periksa status migrasi terlebih dahulu (dry-run check)
npx prisma migrate status

# 3. Terapkan migrasi ke database
npx prisma migrate deploy
```

Hasil yang diharapkan pada terminal:
```text
Prisma schema loaded from prisma/schema.prisma
Datasource "db": MySQL database "..." at "..."

1 migration found in prisma/migrations

Applying migration `20261018000000_init_mysql`

The following migration has been applied:

migrations/
  └─ 20261018000000_init_mysql/
      └─ migration.sql

All migrations have been successfully applied.
```

### Tahap 3: Verifikasi Integritas Pasca-Migrasi
Periksa apakah tabel `_prisma_migrations` telah terbentuk pada database target dengan query:
```sql
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations;
```

---

## 4. Rencana Rollback (Contingency Plan)

Jika terjadi kendala saat eksekusi migrasi:

1. **Rollback Database Bersih (Staging Baru)**:
   Jika database baru mengalami kegagalan, lakukan drop database dan buat ulang:
   ```sql
   DROP DATABASE <DATABASE_NAME>;
   CREATE DATABASE <DATABASE_NAME> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. **Rollback Database yang Memiliki Data**:
   Pulihkan dari file dump yang telah dibuat pada Tahap 1:
   ```bash
   mysql -u <USER> -p -h <HOST> -P <PORT> <DATABASE_NAME> < backup_before_migration_*.sql
   ```
