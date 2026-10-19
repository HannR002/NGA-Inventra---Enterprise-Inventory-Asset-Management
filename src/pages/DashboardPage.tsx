import React, { useEffect, useState } from 'react';
import { 
  Package, 
  DollarSign, 
  AlertTriangle, 
  QrCode, 
  Warehouse, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ArrowLeftRight, 
  PlusCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { BarChart, DonutChart } from '../components/common/SimpleChart';
import { StatusBadge } from '../components/common/StatusBadge';
import { api } from '../services/api';
import { DashboardMetrics } from '../types';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
  onOpenAddItem: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenAddItem }) => {
  const { can } = useAuth();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  // Categories distribution for donut chart
  const categoryChartItems = [
    { label: 'IT Hardware & Peripherals', count: 18, color: '#6366f1' },
    { label: 'Packaging & Consumables', count: 547, color: '#f59e0b' },
    { label: 'Networking Equipment', count: 51, color: '#10b981' },
    { label: 'Safety & PPE', count: 47, color: '#ec4899' },
    { label: 'Material Handling Equipment', count: 2, color: '#06b6d4' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: Enterprise Welcome & Quick Actions */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              NGA INVENTRA CORE PLATFORM
            </span>
            <span className="text-xs text-slate-400">CDC Jakarta • Live Cluster</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Ringkasan Operasional Inventaris & Aset
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Sistem manajemen persediaan terintegrasi dengan pemisahan eksplisit barang habis pakai (consumable) dan aset bernomor serial unik.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          {can('movements:in') && (
            <button
              onClick={() => onNavigate('goods-receipt')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-102"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Barang Masuk</span>
            </button>
          )}

          {can('movements:out') && (
            <button
              onClick={() => onNavigate('stock-out')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-all hover:scale-102"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>Barang Keluar</span>
            </button>
          )}

          {can('movements:transfer') && (
            <button
              onClick={() => onNavigate('transfer')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-all hover:scale-102"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Transfer</span>
            </button>
          )}

          {can('items:create') && (
            <button
              onClick={onOpenAddItem}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all hover:scale-102"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Master Barang</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Valuasi Stok"
          value={formatIDR(data.summary.totalStockValuation)}
          subtitle={`${data.summary.totalItems} SKU terdaftar aktif`}
          icon={<DollarSign className="w-5 h-5 text-indigo-500" />}
          trend={{ value: '+14.2% MoM', isPositive: true }}
          highlight
        />

        <StatCard
          title="Peringatan Stok Minimum"
          value={data.summary.lowStockCount}
          subtitle={`${data.summary.outOfStockCount} SKU persediaan habis total`}
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          trend={{ value: 'Perlu Reorder Segera', isPositive: false }}
        />

        <StatCard
          title="Aset Bernomor Serial"
          value={data.summary.activeAssetUnits}
          subtitle={`${data.summary.inMaintenanceAssets} unit dalam maintenance`}
          icon={<QrCode className="w-5 h-5 text-emerald-500" />}
          trend={{ value: '100% Terlacak', isPositive: true }}
        />

        <StatCard
          title="Gudang & Cabang"
          value={data.summary.totalWarehouses}
          subtitle="Jakarta CDC, SBY, BPP, MED"
          icon={<Warehouse className="w-5 h-5 text-blue-500" />}
        />
      </div>

      {/* Charts & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Movement Trends Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Aktivitas Mutasi Gudang 6 Bulan Terakhir
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Volume barang masuk (inbound) vs barang keluar (outbound) dalam satuan unit
              </p>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Laporan Lengkap</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <BarChart
            data={data.movementTrends.map(t => ({
              label: t.month,
              value1: t.in,
              value2: t.out,
            }))}
            legend1="Barang Masuk"
            legend2="Barang Keluar"
          />
        </div>

        {/* Right: Category Distribution Donut Chart */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Distribusi Kategori
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Komposisi persediaan per kategori inventaris
            </p>
          </div>

          <div className="py-4">
            <DonutChart items={categoryChartItems} />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Aset Serial Terbanyak</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Apple MacBook & Zebra Scanner</span>
          </div>
        </div>
      </div>

      {/* Low Stock Watchlist & Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Watchlist */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daftar Peringatan Stok Kritis (Under Reorder Point)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Perlu dibuatkan Purchase Order atau transfer dari gudang cadangan
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Lihat Semua
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {data.lowStockItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Semua stok barang berada di atas ambang batas aman.
              </div>
            ) : (
              data.lowStockItems.map((item) => {
                const percent = Math.min(Math.round((item.currentStock / item.minStock) * 100), 100);
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {item.sku}
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full ${
                            item.currentStock <= 5 ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                        <span>Sisa: <strong className="text-slate-900 dark:text-slate-100">{item.currentStock} {item.unitSymbol}</strong></span>
                        <span>Batas Minimum: {item.minStock} {item.unitSymbol}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('goods-receipt')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors shrink-0"
                    >
                      Restock PO
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Stock Movement Activities */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Riwayat Mutasi Terkini
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Transaksi persediaan terverifikasi row-locking & audit trail
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Audit Trail
            </button>
          </div>

          <div className="space-y-3 flex-1">
            {data.recentMovements.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada transaksi mutasi yang tercatat.
              </div>
            ) : (
              data.recentMovements.map((mov) => {
                let badgeType: any = 'movement';
                let icon = <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-500" />;
                let typeLabel = 'Barang Masuk';

                if (mov.type === 'OUT') {
                  icon = <ArrowUpFromLine className="w-3.5 h-3.5 text-rose-500" />;
                  typeLabel = 'Barang Keluar';
                } else if (mov.type === 'TRANSFER') {
                  icon = <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />;
                  typeLabel = 'Transfer Antar Gudang';
                }

                return (
                  <div
                    key={mov.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {mov.movementNumber}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {typeLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {mov.notes || `Ref: ${mov.referenceDoc || '-'}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <StatusBadge status={mov.status} type={badgeType} />
                      <div className="text-[10px] text-slate-400 mt-1">
                        Oleh: {mov.createdByName}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
