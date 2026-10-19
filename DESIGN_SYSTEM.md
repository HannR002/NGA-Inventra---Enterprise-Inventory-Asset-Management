# NGA INVENTRA - Enterprise Design System Specification

## 1. Filosofi Desain
NGA INVENTRA dibangun dengan standar antarmuka SaaS kelas enterprise:
- **Tingkat Kepadatan Informasi Optimal (High Information Density):** Informasi penting seperti SKU, serial number, status stok, dan lokasi gudang tersaji secara terstruktur tanpa visual noise berlebihan.
- **Hierarki Tipografi Tegas:** Memandu mata operator logistik dan auditor finansial secara cepat.
- **Aksessibilitas (WCAG 2.1 AA Compliant):** Rasio kontras tinggi, navigasi keyboard penuh, ARIA live regions untuk notifikasi toast, dan dukungan reduced motion.
- **Dual-Theme Support (Light & Dark Mode):** Kontras konsisten antara latar belakang gelap `slate-950` dan terang `slate-50`.

---

## 2. Token Tipografi

| Kategori | Font Family | Penggunaan | Contoh |
|---|---|---|---|
| **Primary Sans** | `'Plus Jakarta Sans', system-ui, sans-serif` | Heading, body text, label form, tombol navigasi | "Katalog Master Barang & Persediaan" |
| **Monospace** | `'JetBrains Mono', monospace` | SKU, Barcode, Serial Number, Timestamp, Angka Finansial | `SKU-CON-NET-001`, `SN-APL-C02GF928MD6R` |

### Skala Ukuran:
- `text-2xl (24px)`: Heading H1 modul utama
- `text-lg (18px)`: Heading kartu KPI, modal header
- `text-sm (14px)`: Sub-heading, nama barang di tabel
- `text-xs (12px)`: Konten tabel, input label, badge status
- `text-[10px] (10px)`: Metadata pendukung, counter tag, breadcrumb

---

## 3. Palet Warna & Semantik

### Slate (Neutral Base):
- Light mode background: `#f8fafc` (`slate-50`)
- Light mode cards/surfaces: `#ffffff`
- Dark mode background: `#020617` (`slate-950`)
- Dark mode cards/surfaces: `#0f172a` (`slate-900`)
- Text primary: `#0f172a` (`slate-900`) / `#f8fafc` (`slate-100`)
- Text secondary: `#64748b` (`slate-500`) / `#94a3b8` (`slate-400`)

### Brand & Aksen:
- Primary Brand: `Indigo-600` (`#4f46e5`) - Tindakan utama, highlight aktif
- Success: `Emerald-600` (`#059669`) - Stok aman, approval selesai, data tersimpan
- Warning: `Amber-500` (`#f59e0b`) - Stok mendekati reorder point, under maintenance
- Danger / Critical: `Rose-600` (`#e11d48`) - Stok habis, pelanggaran saldo negatif, penolakan
- Serialized Accent: `Purple-600` (`#9333ea`) - Pembeda visual eksklusif untuk aset tetap bernomor serial

---

## 4. Komponen Sistem Antarmuka

### 1. Status Badges (`StatusBadge.tsx`)
Badges menggunakan styling solid-tinted dengan border tipis untuk ketajaman visual:
- `Tersedia`: `bg-emerald-50 text-emerald-700 border-emerald-200`
- `Stok Rendah`: `bg-amber-50 text-amber-700 border-amber-200`
- `Stok Habis / Kritis`: `bg-rose-50 text-rose-700 border-rose-200`
- `Serialized Unit`: `bg-purple-50 text-purple-700 border-purple-200`

### 2. Tabel Data Enterprise (`DataTable.tsx`)
- Fixed header dengan sorting dua arah (asc/desc)
- Pencarian multi-kolom otomatis (SKU, nama, barcode)
- Slot filter custom (kategori, status, tipe barang)
- Skeleton loading saat query berjalan
- Empty state ilustratif dengan call-to-action
- Pagination navigasi cepat per halaman

### 3. Panel Slide-over (`Drawer.tsx`)
Digunakan untuk melihat rincian mendalam barang dan aset serial tanpa memutus konteks tabel utama. Mendukung tombol escape dan backdrop blur halus.

### 4. Dialog Konfirmasi Berisiko (`ConfirmationModal.tsx`)
Digunakan untuk tindakan sensitif (penghapusan, pembatalan mutasi, reset database). Menyertakan input alasan wajib guna memenuhi standar jejak audit internal.

### 5. Toast Notification Portal (`NotificationContext.tsx`)
Live portal di sudut kanan bawah layar dengan warna semantik (sukses, error, peringatan, info) dan durasi auto-dismiss 5 detik.
