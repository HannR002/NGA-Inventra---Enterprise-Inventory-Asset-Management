# Laporan Audit Keamanan Aplikasi — NGA INVENTRA

Dokumen ini mendokumentasikan hasil audit postur keamanan sistem **NGA INVENTRA Enterprise Inventory & Serialized Asset Management** terhadap standar **OWASP Application Security Verification Standard (ASVS)** dan arsitektur cloud serverless Vercel.

---

## 1. Matriks Kepatuhan Keamanan OWASP

| Area Keamanan | Standar / Kontrol | Implementasi pada NGA INVENTRA | Status Audit |
| :--- | :--- | :--- | :--- |
| **Password Storage** | OWASP Password Storage Cheat Sheet | PBKDF2-HMAC-SHA512 dengan **210.000 iterasi** & 16-byte cryptographically secure random salt | **COMPLIANT (PASS)** |
| **Hash Migration** | OWASP Gradual Upgrading Strategy | Fungsi `needsRehash` mendeteksi hash format lama (1.000 / 10.000 iterasi) saat login berhasil dan meng-upgradenya secara transparan ke 210.000 iterasi | **COMPLIANT (PASS)** |
| **Timing Attack Defense** | Constant-Time String/Buffer Check | Verifikasi hash dan validasi tanda tangan JWT menggunakan `crypto.timingSafeEqual` | **COMPLIANT (PASS)** |
| **Token Authentication** | Stateless HMAC-SHA256 JWT | Masa kedaluwarsa 24 jam (`exp`), klaim terverifikasi, payload sanitized tanpa data sensitif | **COMPLIANT (PASS)** |
| **Privilege Escalation** | Server-Side RBAC Enforcement | Middleware `requirePermission` memvalidasi hak akses peran (`SUPER_ADMIN`, `WAREHOUSE_MANAGER`, `INVENTORY_STAFF`, `ASSET_CUSTODIAN`, `AUDITOR`) di server | **COMPLIANT (PASS)** |
| **Bypass Headers** | Elimination of Demo Backdoors | Header `x-demo-role` telah **dihapus total** dari backend dan frontend. Setiap request wajib memiliki token `Authorization: Bearer <JWT>` | **COMPLIANT (PASS)** |
| **Production Guards** | Fail-Safe Startup Validation | Server menolak boot di mode produksi (`NODE_ENV=production` atau `VERCEL=1`) jika `JWT_SECRET` kosong, kurang dari 32 karakter, atau menggunakan kunci default | **COMPLIANT (PASS)** |
| **Injection Defense** | Parameterized SQL Queries | Seluruh query dieksekusi melalui **Prisma ORM** yang menerapkan query parameterization 100%, kebal terhadap SQL Injection | **COMPLIANT (PASS)** |
| **Log Sanitization** | Sensitive Data Masking | Middleware logger menyensor password (`[REDACTED]`) dan token sebelum dicatat ke log | **COMPLIANT (PASS)** |
| **API Boundary Defense** | Strict 404 Routing | Rute `/api/*` yang tidak dikenal mengembalikan JSON error 404, tidak pernah membocorkan file HTML frontend | **COMPLIANT (PASS)** |

---

## 2. Temuan Audit Khusus & Solusi yang Telah Diterapkan

### Temuan 1: Celah Demo Role Header Bypass (`x-demo-role`)
- **Tingkat Risiko**: TINGGI (*High*)
- **Deskripsi Lama**: Terdapat kode di mana jika token tidak disertakan, server dev membaca header `x-demo-role` untuk memberikan session instan.
- **Tindakan Perbaikan**: Seluruh logika `x-demo-role` di `server/security/auth.ts` dan pengiriman header di `src/services/api.ts` telah dicabut secara permanen. Jika token tidak disertakan, server segera mengembalikan `HTTP 401 Unauthorized`.

### Temuan 2: Endpoint Peralihan Peran Instan (`/api/auth/switch-role`)
- **Tingkat Risiko**: MEDIUM (*Medium*)
- **Deskripsi**: Fitur switch role untuk kemudahan demonstrasi dapat dieksploitasi untuk eskalasi hak akses jika terbuka di produksi.
- **Tindakan Perbaikan**: Ditambahkan pengecekan eksplisit di `server/app.ts`: jika `isProduction` bernilai `true` (atau `VERCEL=1`), endpoint langsung membalas `HTTP 403 SWITCH_ROLE_DISABLED_IN_PROD` tanpa mengeksekusi token signing.

### Temuan 3: Kunci Cadangan JWT Default di Serverless
- **Tingkat Risiko**: KRITIS (*Critical*)
- **Deskripsi**: Jika `JWT_SECRET` lupa diisi di Vercel Environment Variables, server tidak boleh menggunakan string bawaan repository.
- **Tindakan Perbaikan**: `server/security/auth.ts` melempar *fatal exception* pada saat module load di mode produksi jika `process.env.JWT_SECRET` tidak diisi atau memiliki panjang di bawah 32 karakter.

---

## 3. Kebijakan Manajemen Kredensial & Repositori

1. **Pemeriksaan Berkas Sensitif**:
   - Berkas `.env` tidak ada dalam git tracking dan terdaftar dalam `.gitignore`.
   - Berkas `.env.example` hanya memuat template konfigurasi tanpa kredensial nyata.
2. **Kerahasiaan Kredensial Database**:
   - URL database lengkap tidak pernah ditampilkan di antarmuka web, health check, maupun git commit.
   - Endpoint `/api/system/status` menyensor user dan password database menjadi `mysql://user:****@host:port/dbname`.
