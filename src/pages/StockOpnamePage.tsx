import React, { useState, useEffect } from 'react';
import { Warehouse, Item, StockOpname } from '../types';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { ClipboardCheck, Plus, CheckCircle2, AlertTriangle, Calculator } from 'lucide-react';

export const StockOpnamePage: React.FC = () => {
  const toast = useNotification();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [auditRows, setAuditRows] = useState<Array<{
    itemId: string;
    itemSku: string;
    itemName: string;
    systemStock: number;
    physicalStock: number;
    unitCost: number;
  }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [whRes, itemRes, opnRes] = await Promise.all([
        api.getWarehouses(),
        api.getItems({ limit: 100 }),
        api.getOpnames(),
      ]);
      setWarehouses(whRes.warehouses);
      setItems(itemRes.items);
      setOpnames(opnRes.opnames);

      if (whRes.warehouses[0]) {
        setSelectedWarehouseId(whRes.warehouses[0].id);
        setupAuditRows(whRes.warehouses[0].id, itemRes.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setupAuditRows = (whId: string, allItems: Item[]) => {
    const rows = allItems.slice(0, 6).map(it => {
      const bal = it.stockBalances?.find(b => b.warehouseId === whId);
      const systemStock = bal ? bal.quantity : it.currentStock;
      return {
        itemId: it.id,
        itemSku: it.sku,
        itemName: it.name,
        systemStock,
        physicalStock: systemStock, // default match
        unitCost: it.unitCost,
      };
    });
    setAuditRows(rows);
  };

  const handleWarehouseChange = (whId: string) => {
    setSelectedWarehouseId(whId);
    setupAuditRows(whId, items);
  };

  const handlePhysicalChange = (index: number, val: number) => {
    setAuditRows(prev => {
      const copy = [...prev];
      copy[index].physicalStock = Math.max(0, val);
      return copy;
    });
  };

  const totalDiscrepancyValue = auditRows.reduce((acc, row) => {
    const diff = row.physicalStock - row.systemStock;
    return acc + (diff * row.unitCost);
  }, 0);

  const totalVariancesCount = auditRows.filter(r => r.physicalStock !== r.systemStock).length;

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSubmitOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId || auditRows.length === 0) {
      toast.error('Validasi Gagal', 'Gudang dan item opname wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createOpname({
        warehouseId: selectedWarehouseId,
        scheduledDate,
        notes,
        details: auditRows,
      });

      toast.success(
        'Stock Opname Disimpan',
        `Nomor Opname: ${res.opname.opnameNumber}. Selisih telah dihitung dan didokumentasikan.`
      );

      const opnRes = await api.getOpnames();
      setOpnames(opnRes.opnames);
      setNotes('');
    } catch (err: any) {
      toast.error('Gagal Menyimpan Opname', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-indigo-500" />
          Stock Opname & Penyesuaian Saldo Fisik
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Rekonsiliasi berkala antara stok tercatat di sistem dengan hitungan fisik lapangan (blind / physical counting)
        </p>
      </div>

      {/* Main Opname Form */}
      <form onSubmit={handleSubmitOpname} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Gudang Objek Pemeriksaan *
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tanggal Pelaksanaan Audit *
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan / Tim Auditor
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Audit Triwulan IV Tim Internal Compliance"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Counting Sheet Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Lembar Hitung Fisik (Sampling Sampling Opname)
            </h3>
            <span className="text-[11px] text-slate-400">
              Ubah nilai "Fisik Lapangan" untuk mensimulasikan selisih
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">SKU & Barang</th>
                  <th className="py-2.5 px-3 text-center">Stok Sistem</th>
                  <th className="py-2.5 px-3 text-center">Fisik Lapangan</th>
                  <th className="py-2.5 px-3 text-center">Selisih Unit</th>
                  <th className="py-2.5 px-3 text-right">Nilai Selisih (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditRows.map((row, idx) => {
                  const diff = row.physicalStock - row.systemStock;
                  const diffVal = diff * row.unitCost;

                  return (
                    <tr key={row.itemId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3">
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold block">{row.itemSku}</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{row.itemName}</span>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                        {row.systemStock}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.physicalStock}
                          onChange={(e) => handlePhysicalChange(idx, parseInt(e.target.value, 10) || 0)}
                          className="w-24 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-center mx-auto"
                        />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded-full ${
                          diff === 0 
                            ? 'text-slate-500 bg-slate-100 dark:bg-slate-800' 
                            : diff > 0 
                            ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60' 
                            : 'text-rose-700 bg-rose-100 dark:bg-rose-950/60'
                        }`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>

                      <td className={`py-3 px-3 text-right font-mono font-bold ${
                        diffVal === 0 
                          ? 'text-slate-500' 
                          : diffVal > 0 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {formatIDR(diffVal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary & Submit */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Item Berselisih</span>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {totalVariancesCount} dari {auditRows.length} item
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Total Nilai Varians</span>
              <div className={`text-base font-black ${
                totalDiscrepancyValue === 0 ? 'text-slate-900 dark:text-slate-100' : totalDiscrepancyValue > 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {formatIDR(totalDiscrepancyValue)}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-102 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Memproses...' : 'Simpan Berita Acara Opname'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
