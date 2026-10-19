import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { 
  Settings, 
  Database, 
  Shield, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Server, 
  Terminal, 
  ExternalLink,
  Cpu,
  Layers,
  Activity
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { can } = useAuth();
  const toast = useNotification();
  const [statusData, setStatusData] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testingDb, setTestingDb] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, healthRes] = await Promise.allSettled([
        api.getSystemStatus(),
        api.getHealth()
      ]);
      if (statusRes.status === 'fulfilled') setStatusData(statusRes.value);
      if (healthRes.status === 'fulfilled') setHealthData(healthRes.value);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingDb(true);
      const health = await api.getHealth();
      setHealthData(health);
      if (health.database?.status === 'CONNECTED') {
        toast.success(
          'Koneksi Berhasil!', 
          `Terhubung ke MySQL (${health.database.host}) v${health.database.databaseVersion} - Latency: ${health.database.latencyMs}ms`
        );
      } else {
        toast.warning(
          'Status Database', 
          health.database?.error || 'Database MySQL Hostinger belum terkonfigurasi pada environment ini.'
        );
      }
    } catch (err: any) {
      toast.error('Gagal Menguji Koneksi', err.message);
    } finally {
      setTestingDb(false);
    }
  };

  const handleResetSeed = async () => {
    try {
      await api.resetSeed();
      toast.success('Database Di-reset', 'Seluruh data telah dikembalikan ke kondisi awal (seed).');
      loadData();
    } catch (err: any) {
      toast.error('Gagal Reset Seed', err.message);
    }
  };

  const dbState = healthData?.database?.status || statusData?.databaseStatus?.connectionState || 'NOT_CONFIGURED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            Pengaturan Sistem & Integrasi Hostinger MySQL
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi koneksi database MySQL, Prisma ORM, health check realtime, dan arsitektur deployment Hostinger
          </p>
        </div>

        <button
          onClick={handleTestConnection}
          disabled={testingDb}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testingDb ? 'animate-spin' : ''}`} />
          {testingDb ? 'Menguji Koneksi...' : 'Uji Koneksi Realtime'}
        </button>
      </div>

      {/* Database Diagnostic Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              dbState === 'CONNECTED'
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                : dbState === 'DISCONNECTED'
                ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Status Integrasi Hostinger MySQL
                {dbState === 'CONNECTED' && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" /> Live Query OK
                  </span>
                )}
                {dbState === 'DISCONNECTED' && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    <XCircle className="w-3 h-3" /> Terputus / Firewall
                  </span>
                )}
                {dbState === 'NOT_CONFIGURED' && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3" /> Belum Dikonfigurasi
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arsitektur: Prisma Client ORM + Connection Manager (Dual-Mode Fail-Safe)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Active Engine:</span>
            <span className="px-2.5 py-1 rounded-lg font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              {healthData?.activeEngine || statusData?.activeEngine || 'STANDALONE_STORE'}
            </span>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 text-[11px] block">Database Host:</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate block">
              {healthData?.database?.host || statusData?.databaseStatus?.host || 'localhost (Hostinger)'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 text-[11px] block">Database Version:</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate block">
              {healthData?.database?.databaseVersion || 'MySQL 8.0 / MariaDB 10.x'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 text-[11px] block">Query Latency:</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 block">
              {healthData?.database?.latencyMs !== null && healthData?.database?.latencyMs !== undefined
                ? `${healthData.database.latencyMs} ms`
                : 'N/A (Offline)'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-500 text-[11px] block">Database Name:</span>
            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 truncate block">
              {healthData?.database?.databaseName || 'inventra_db'}
            </span>
          </div>
        </div>

        {/* Diagnostic Message */}
        {healthData?.database?.error && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Catatan Koneksi Jaringan:
            </div>
            <p className="text-[11px] leading-relaxed">
              {healthData.database.error}
            </p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
              *CATATAN HOSTINGER: Hostinger Remote MySQL secara default memblokir IP dinamis Google Cloud Run. Ketika aplikasi dideploy langsung di Hostinger (VPS atau Node.js Web App), backend akan terhubung ke <code>localhost:3306</code> dengan latensi &lt;1ms tanpa firewall issue.
            </p>
          </div>
        )}

        {/* Schema & Migration Artifacts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-500" />
              Spesifikasi Skema & Migrasi:
            </span>
            <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Prisma Client Schema:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">prisma/schema.prisma</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Direct DDL Migration:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">migrations/init_mysql.sql</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tabel Terpetakan:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">15 Entitas Relasional</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Idempotency & Atomic Locking:</span>
                <span className="font-semibold text-emerald-600">Aktif (Zero Race Condition)</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-500" />
              Paket Hostinger Deployment:
            </span>
            <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Target Rekomendasi:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Hostinger KVM VPS / Cloud</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Process Manager:</span>
                <span className="font-mono">PM2 (hostinger/ecosystem.config.cjs)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Web Server Proxy:</span>
                <span className="font-mono">Nginx / Passenger (.htaccess)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Runtime Node.js:</span>
                <span className="font-semibold text-indigo-600">v20.x atau v22.x LTS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step-by-step Command Box */}
        <div className="p-4 rounded-xl bg-slate-900 text-slate-300 text-xs font-mono space-y-2">
          <div className="text-slate-400 font-sans text-xs font-semibold flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Perintah Deployment Hostinger & Migrasi Database:
          </div>
          <div className="space-y-1 text-[11px] text-emerald-400">
            <p className="text-slate-400"># 1. Jalankan migrasi schema ke MySQL Hostinger</p>
            <p className="text-white">npx prisma migrate deploy</p>
            <p className="text-slate-400"># ATAU import langsung SQL script via Hostinger phpMyAdmin</p>
            <p className="text-white">mysql -u [USER] -p[PASS] -h localhost [DB_NAME] &lt; migrations/init_mysql.sql</p>
            <p className="text-slate-400"># 2. Build aset frontend produksi</p>
            <p className="text-white">npm run build</p>
            <p className="text-slate-400"># 3. Jalankan server dengan PM2</p>
            <p className="text-white">pm2 start hostinger/ecosystem.config.cjs --env production</p>
          </div>
        </div>
      </div>

      {/* Security Architecture */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-500" />
          Protokol Keamanan & Integritas Data Enterprise
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
              Autentikasi Terisolasi (PBKDF2)
            </span>
            <p className="text-slate-500 text-[11px]">
              Celah demo-role header telah ditutup total. Password di-hash menggunakan PBKDF2-SHA512 dengan salt acak 16-byte kriptografis.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
              Idempotency Key Transaksi
            </span>
            <p className="text-slate-500 text-[11px]">
              Setiap transaksi mutasi memiliki Idempotency Key unik yang terdaftar pada indeks unik database untuk mencegah eksekusi ganda.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">
              Pencegahan Stok Minus Atomic
            </span>
            <p className="text-slate-500 text-[11px]">
              Menggunakan transaksi ACID Prisma dengan row locking; transaksi keluar otomatis digagalkan seketika jika saldo tidak mencukupi.
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone: Reset Seed */}
      {can('settings:manage') && (
        <div className="p-6 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Reset Data ke Status Seed Awal
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                Mengembalikan seluruh data transaksi, master barang, dan aset ke data seed standar perusahaan.
              </p>
            </div>

            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors"
            >
              Reset Data Seed
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetSeed}
        title="Konfirmasi Reset Data Seed"
        message="Tindakan ini akan mengembalikan seluruh persediaan, transaksi mutasi, dan aset ke data demo default. Tindakan ini akan dicatat dalam audit trail."
        confirmLabel="Ya, Reset Database"
        variant="danger"
        requireReason
      />
    </div>
  );
};
