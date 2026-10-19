import React, { useState, useEffect } from 'react';
import { Warehouse, Supplier, Item, StockMovement } from '../types';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  ArrowDownToLine, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  History, 
  Building,
  CheckCircle2
} from 'lucide-react';

interface GoodsReceiptPageProps {
  preselectedItem?: Item | null;
}

export const GoodsReceiptPage: React.FC<GoodsReceiptPageProps> = ({ preselectedItem }) => {
  const toast = useNotification();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [referenceDoc, setReferenceDoc] = useState(`PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [idempotencyKey, setIdempotencyKey] = useState(`IDEMP-IN-${Date.now()}`);
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Array<{ itemId: string; quantity: number; unitCost: number }>>([
    { itemId: '', quantity: 10, unitCost: 0 }
  ]);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      setLoading(true);
      const [whRes, supRes, itemRes, movRes] = await Promise.all([
        api.getWarehouses(),
        api.getSuppliers(),
        api.getItems({ limit: 100 }),
        api.getMovements({ type: 'IN' }),
      ]);
      setWarehouses(whRes.warehouses);
      setSuppliers(supRes.suppliers);
      setItems(itemRes.items);
      setRecentMovements(movRes.movements);

      if (whRes.warehouses[0]) {
        setTargetWarehouseId(whRes.warehouses[0].id);
      }
      if (supRes.suppliers[0]) {
        setSupplierId(supRes.suppliers[0].id);
      }
      if (preselectedItem) {
        setRows([{ itemId: preselectedItem.id, quantity: 20, unitCost: preselectedItem.unitCost }]);
      } else if (itemRes.items[0]) {
        setRows([{ itemId: itemRes.items[0].id, quantity: 10, unitCost: itemRes.items[0].unitCost }]);
      }
    } catch (err) {
      console.error('Error loading prerequisites:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    const firstItem = items[0];
    setRows(prev => [...prev, { itemId: firstItem?.id || '', quantity: 10, unitCost: firstItem?.unitCost || 0 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, itemId: string) => {
    const matched = items.find(i => i.id === itemId);
    setRows(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        itemId,
        unitCost: matched?.unitCost || 0,
      };
      return copy;
    });
  };

  const handleQtyChange = (index: number, quantity: number) => {
    setRows(prev => {
      const copy = [...prev];
      copy[index].quantity = Math.max(1, quantity);
      return copy;
    });
  };

  const handleCostChange = (index: number, unitCost: number) => {
    setRows(prev => {
      const copy = [...prev];
      copy[index].unitCost = Math.max(0, unitCost);
      return copy;
    });
  };

  const totalValuation = rows.reduce((acc, r) => acc + (r.quantity * r.unitCost), 0);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWarehouseId) {
      toast.error('Validasi Gagal', 'Gudang tujuan wajib dipilih.');
      return;
    }
    if (rows.some(r => !r.itemId || r.quantity <= 0)) {
      toast.error('Validasi Gagal', 'Setiap baris harus memiliki barang dan kuantitas lebih dari 0.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createMovement({
        type: 'IN',
        targetWarehouseId,
        supplierId: supplierId || undefined,
        referenceDoc,
        idempotencyKey,
        notes,
        details: rows.map(r => ({
          itemId: r.itemId,
          quantity: r.quantity,
          unitCost: r.unitCost,
        })),
      });

      toast.success(
        'Barang Masuk Berhasil Diproses',
        `Nomor Mutasi: ${res.movement.movementNumber}. Stok gudang telah diperbarui dan dicatat dalam audit log.`
      );

      // Refresh movements and prepare next form
      const movRes = await api.getMovements({ type: 'IN' });
      setRecentMovements(movRes.movements);
      setIdempotencyKey(`IDEMP-IN-${Date.now()}`);
      setReferenceDoc(`PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setNotes('');
    } catch (err: any) {
      toast.error('Gagal Memproses Transaksi', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ArrowDownToLine className="w-5 h-5 text-indigo-500" />
          Barang Masuk (Goods Receipt / Inbound)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Penerimaan fisik barang ke gudang dari Purchase Order supplier dengan jaminan idempotency & audit trail
        </p>
      </div>

      {/* Main Inbound Form */}
      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nomor Referensi (PO / DO) *
            </label>
            <input
              type="text"
              required
              value={referenceDoc}
              onChange={(e) => setReferenceDoc(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Gudang Penerima (Destination) *
            </label>
            <select
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Supplier Pengirim
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>Idempotency Key</span>
              <span className="text-[10px] text-emerald-600 font-mono">Anti-Double Submit</span>
            </label>
            <input
              type="text"
              readOnly
              value={idempotencyKey}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Dynamic Item Rows */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Daftar Barang Masuk
            </h3>
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baris</span>
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, idx) => {
              const matchedItem = items.find(i => i.id === row.itemId);
              const subtotal = row.quantity * row.unitCost;

              return (
                <div key={idx} className="p-3.5 grid grid-cols-12 gap-3 items-center bg-slate-50/30 dark:bg-slate-800/20 text-xs">
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-[10px] text-slate-400 mb-1 sm:hidden">Pilih Barang</label>
                    <select
                      value={row.itemId}
                      onChange={(e) => handleItemChange(idx, e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      {items.map(it => (
                        <option key={it.id} value={it.id}>
                          [{it.sku}] {it.name} (Stok: {it.currentStock} {it.unitSymbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-5 sm:col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-1 sm:hidden">Kuantitas</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => handleQtyChange(idx, parseInt(e.target.value, 10) || 1)}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-center"
                    />
                  </div>

                  <div className="col-span-7 sm:col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-1 sm:hidden">Biaya Satuan (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={row.unitCost}
                      onChange={(e) => handleCostChange(idx, parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>

                  <div className="col-span-10 sm:col-span-2 font-mono font-bold text-slate-900 dark:text-slate-100 text-right">
                    {formatIDR(subtotal)}
                  </div>

                  <div className="col-span-2 sm:col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      disabled={rows.length === 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes & Summary */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex-1 w-full max-w-md">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan Penerimaan / Keterangan Berita Acara:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Diterima lengkap sesuai surat jalan fisik nomor SJ-991"
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-6 self-end md:self-center">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Nilai Penerimaan</span>
              <div className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                {formatIDR(totalValuation)}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-102 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Memproses...' : 'Konfirmasi Barang Masuk'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Historical Inbound Receipts Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-500" />
          Riwayat Transaksi Barang Masuk Terakhir
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">No. Mutasi</th>
                <th className="py-2.5 px-3">No. Referensi (PO)</th>
                <th className="py-2.5 px-3">Gudang Tujuan</th>
                <th className="py-2.5 px-3">Diterima Oleh</th>
                <th className="py-2.5 px-3">Waktu Transaksi</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">Belum ada riwayat transaksi barang masuk.</td>
                </tr>
              ) : (
                recentMovements.map(mov => (
                  <tr key={mov.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {mov.movementNumber}
                    </td>
                    <td className="py-3 px-3 font-mono">{mov.referenceDoc || '-'}</td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {mov.targetWarehouseName}
                    </td>
                    <td className="py-3 px-3">{mov.createdByName}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(mov.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <StatusBadge status={mov.status} type="movement" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
