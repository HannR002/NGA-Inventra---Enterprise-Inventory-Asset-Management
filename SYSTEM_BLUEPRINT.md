# NGA INVENTRA - System Blueprint & Architecture Specification

## 1. Arsitektur Solusi & Alur Data

```
[ Frontend Client (React 19 + TypeScript) ]
                     │  (HTTP / REST JSON + Bearer Token)
                     ▼
[ Express Server (Node.js 22 + tsx) ]
  ├── Security & Auth Middleware (PBKDF2 Hashing, HMAC Token, RBAC Guard)
  ├── Stock Transaction Engine (Row Locking Simulation, Negative Stock Guard, Idempotency)
  ├── Audit Trail Logger (Immutable mutation recording)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
[ Local Persistent Store ]   [ MySQL 8.0 + Prisma ORM ]
  (.data/inventra-db.json)     (Docker compose + migrations/init_mysql.sql)
```

---

## 2. Pemisahan Domain: Consumable vs Serialized Asset

Aturan domain utama sistem:
1. **Consumable / Stock Item (`itemType = 'CONSUMABLE'`):**
   - Dikelola berbasis kuantitas agregat (`currentStock`, `stock_balances`).
   - Contoh: Kabel UTP (Roll), Kertas Thermal (Roll), Kotak Kardus (Pcs), Rompi Safety (Pcs).
   - Mutasi menambah atau mengurangi kuantitas angka secara langsung.
2. **Serialized Asset Unit (`itemType = 'SERIALIZED_ASSET'`):**
   - Memiliki master SKU/Model induk, namun setiap unit fisik memiliki identitas unik:
     - `assetTag` (e.g. `AST-2026-0001` - unik perusahaan)
     - `serialNumber` (e.g. `SN-APL-C02GF928MD6R` - unik pabrikan)
     - `assignedToUserId` (Pegawai penanggung jawab langsung)
     - `condition` (`NEW`, `EXCELLENT`, `GOOD`, `FAIR`, `DAMAGED`)
     - `status` (`AVAILABLE`, `ASSIGNED`, `IN_MAINTENANCE`, `DISPOSED`, `LOST`)
   - **Constraint:** Unit aset serial HANYA dapat didaftarkan pada item yang bertipe `SERIALIZED_ASSET`.

---

## 3. Data Dictionary & Relasi Entitas (MySQL 8)

| Tabel | Primary Key | Foreign Keys & Index Penting | Keterangan |
|---|---|---|---|
| `users` | `id` (UUID) | UNIQUE: `email` | Kredensial ter-hash PBKDF2, peran RBAC |
| `categories` | `id` (UUID) | UNIQUE: `code` | Klasifikasi inventaris |
| `units` | `id` (UUID) | UNIQUE: `symbol` | Satuan ukur (PCS, BOX, ROLL, SET) |
| `suppliers` | `id` (UUID) | UNIQUE: `code` | Vendor pengadaan barang |
| `warehouses` | `id` (UUID) | UNIQUE: `code`, FK: `managerId -> users` | Fasilitas gudang fisik & kapasitas CBM |
| `warehouse_locations` | `id` (UUID) | FK: `warehouseId`, UNIQUE: `(warehouseId, code)` | Detail lorong, rak, dan rak penyimpanan |
| `items` | `id` (UUID) | UNIQUE: `sku`, `barcode`, FK: `categoryId`, `unitId` | Master SKU, tipe barang, ambang batas stok |
| `stock_balances` | `id` (UUID) | UNIQUE: `(itemId, warehouseId)` | Saldo persediaan fisik per gudang |
| `stock_movements` | `id` (UUID) | UNIQUE: `movementNumber`, `idempotencyKey` | Transaksi mutasi stok (IN, OUT, TRANSFER) |
| `stock_movement_details` | `id` (UUID) | FK: `movementId`, `itemId` | Rincian baris barang mutasi |
| `asset_units` | `id` (UUID) | UNIQUE: `assetTag`, `serialNumber`, FK: `itemId`, `warehouseId`, `assignedToUserId` | Unit fisik aset bernomor serial |
| `asset_assignments` | `id` (UUID) | FK: `assetUnitId`, `assignedToUserId`, `assignedByUserId` | Riwayat serah terima penanggung jawab |
| `stock_opnames` | `id` (UUID) | UNIQUE: `opnameNumber`, FK: `warehouseId` | Rekonsiliasi hitung fisik stock opname |
| `stock_opname_details` | `id` (UUID) | FK: `opnameId`, `itemId` | Selisih fisik vs sistem dan discrepancy value |
| `item_requests` | `id` (UUID) | UNIQUE: `requestNumber`, FK: `requestedByUserId`, `approvedByUserId` | Dokumen permohonan barang internal |
| `audit_logs` | `id` (UUID) | INDEX: `(entity, entityId)`, `createdAt`, FK: `userId` | Jejak audit digital transaksi |

---

## 4. Aturan Bisnis & Mekanisme Integritas

### 1. Pencegahan Stok Negatif (Negative Stock Prohibition)
- Pada transaksi barang keluar (`OUT`) atau transfer (`TRANSFER`), sistem memeriksa saldo stok di gudang asal:
  $$\text{Saldo Tersedia} \ge \text{Kuantitas Permintaan}$$
- Jika kuantitas yang diminta melebihi saldo gudang, transaksi DITOLAK seketika dengan status HTTP 400 dan pesan spesifik: `Stok tidak mencukupi untuk '<item>' di <gudang>. Tersedia: X, diminta: Y`.

### 2. Pencegahan Double Submit (Idempotency Protection)
- Setiap permintaan mutasi stok menyertakan `idempotencyKey`.
- Jika request dengan key yang sama terkirim ulang (akibat double-click atau retry jaringan), sistem mengembalikan data mutasi sebelumnya TANPA mengurangi stok berulang kali.

### 3. Konservasi Stok pada Mutasi Transfer (Stock Conservation)
- Saat stok ditransfer dari Gudang A ke Gudang B:
  $$\Delta \text{Stok Gudang A} = -Q$$
  $$\Delta \text{Stok Gudang B} = +Q$$
  $$\Delta \text{Total Persediaan Perusahaan} = 0$$
- Total stok keseluruhan sistem tetap konstan.

---

## 5. Kontrak API Utama (REST API Specification)

### 1. Autentikasi:
- `POST /api/auth/login`
  - Body: `{ email: string, password: string }`
  - Response 200: `{ token: string, user: User }`
  - Response 401: `{ error: "Email atau password salah." }`
- `GET /api/auth/me`
  - Header: `Authorization: Bearer <token>`
  - Response 200: `{ user: User & { permissions: string[] } }`
- `POST /api/auth/switch-role`
  - Body: `{ role: RoleType }`
  - Response 200: `{ token: string, user: User }`

### 2. Master Barang & Stok:
- `GET /api/items?search=&categoryId=&itemType=&stockStatus=&page=&limit=`
  - Response 200: `{ items: Item[], total: number, page: number, limit: number }`
- `POST /api/items`
  - Body: `{ sku, barcode, name, description, categoryId, unitId, itemType, minStock, maxStock, reorderPoint, unitCost, unitPrice, initialStock }`
  - Response 201: `{ item: Item }`
  - Error 400: `{ error: "SKU '...' sudah terdaftar dalam sistem." }`

### 3. Mutasi Stok (Inbound, Outbound, Transfer):
- `POST /api/movements`
  - Body:
    ```json
    {
      "type": "IN" | "OUT" | "TRANSFER",
      "sourceWarehouseId": "wh-jkt-main",
      "targetWarehouseId": "wh-sby-hub",
      "referenceDoc": "PO-2026-10-089",
      "idempotencyKey": "IDEMP-PO-089",
      "notes": "Catatan pengiriman",
      "details": [
        { "itemId": "itm-01", "quantity": 10, "unitCost": 15000 }
      ]
    }
    ```
  - Response 201: `{ movement: StockMovement }`
  - Error 400 (Jika stok kurang): `{ error: "Stok tidak mencukupi..." }`

### 4. Aset Bernomor Serial:
- `GET /api/assets?status=&condition=&search=`
  - Response 200: `{ assets: AssetUnit[], total: number }`
- `POST /api/assets`
  - Body: `{ assetTag, serialNumber, itemId, warehouseId, condition, purchaseDate, purchaseCost, notes }`
  - Response 201: `{ asset: AssetUnit }`
  - Error 400: `{ error: "Item bertipe CONSUMABLE dan tidak dapat didaftarkan sebagai serialized asset" }`
- `PUT /api/assets/:id/status`
  - Body: `{ status, condition, assignedToUserId, department, notes }`
  - Response 200: `{ asset: AssetUnit }`

### 5. Audit Trail & Diagnostik:
- `GET /api/audit?limit=100` -> `{ auditLogs: AuditLog[] }`
- `GET /api/system/status` -> Diagnostik engine database, connection string, migrasi
