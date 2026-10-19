import React, { useState, useEffect } from 'react';
import { Warehouse, Item, StockMovement } from '../types';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  ArrowUpFromLine, 
  Plus, 
  Trash2, 
  AlertOctagon, 
  History, 
  CheckCircle2 
} from 'lucide-react';

interface StockOutPageProps {
  preselectedItem?: Item | null;
}

export const StockOutPage: React.FC<StockOutPageProps> = ({ preselectedItem }) => {
  const toast = useNotification();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [referenceDoc, setReferenceDoc] = useState(`REQ-OPS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [idempotencyKey, setIdempotencyKey] = useState(`IDEMP-OUT-${Date.now()}`);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [recipientDepartment, setRecipientDepartment] = useState('Central Operations');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Array<{ itemId: string; quantity: number }>>([
    { itemId: '', quantity: 1 }
  ]);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      setLoading(true);
      const [whRes, itemRes, movRes] = await Promise.all([
        api.getWarehouses(),
        api.getItems({ limit: 100 }),
        api.getMovements({ type: 'OUT' }),
      ]);
      setWarehouses(whRes.warehouses);
      setItems(itemRes.items);
      setRecentMovements(movRes.movements);

      if (whRes.warehouses[0]) {
        setSourceWarehouseId(whRes.warehouses[0].id);
      }
      if (preselectedItem) {
        setRows([{ itemId: preselectedItem.id, quantity: 1 }]);
      } else if (itemRes.items[0]) {
        setRows([{ itemId: itemRes.items[0].id, quantity: 1 }]);
      }
    } catch (err) {
      console.error('Error loading prerequisites:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableStock = (itemId: string, whId: string): number => {
    const item = items.find(i => i.id === itemId);
    if (!item) return 0;
    const bal = item.stockBalances?.find(b => b.warehouseId === whId);
    return bal ? bal.quantity : 0;
  };

  const handleAddRow = () => {
    const firstItem = items.find(i => i.currentStock > 0) || items[0];
    setRows(prev => [...prev, { itemId: firstItem?.id || '', quantity: 1 }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, itemId: string) => {
    setRows(prev => {
      const copy = [...prev];
      copy[index] = { itemId, quantity: 1 };
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

  // Check if any row violates negative stock prevention
  const hasNegativeStockViolation = rows.some(r => {
    if (!r.itemId || !sourceWarehouseId) return false;
    const available = getAvailableStock(r.itemId, sourceWarehouseId);
    return r.quantity > available;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWarehouseId) {
      toast.error('Validasi Gagal', 'Gudang asal wajib dipilih.');
      return;
    }

    if (hasNegativeStockViolation) {
      toast.error(
        'Pencegahan Stok Negatif Terpicu',
        'Salah satu kuantitas pengeluaran barang melebihi saldo fisik yang tersedia di gudang tersebut.'
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createMovement({
        type: 'OUT',
        sourceWarehouseId,
        referenceDoc: `${referenceDoc} [Dept: ${recipientDepartment}]`,
        idempotencyKey,
        notes,
        details: rows.map(r => ({
          itemId: r.itemId,
          quantity: r.quantity,
        })),
      });

      toast.success(
        'Barang Keluar Berhasil Diproses',
        `Nomor Mutasi: ${res.movement.movementNumber}. Stok gudang telah dikurangi dengan aman.`
      );

      // Refresh items and movements
      const [itemRes, movRes] = await Promise.all([
        api.getItems({ limit: 100 }),
        api.getMovements({ type: 'OUT' }),
      ]);
      setItems(itemRes.items);
      setRecentMovements(movRes.movements);
      setIdempotencyKey(`IDEMP-OUT-${Date.now()}`);
      setReferenceDoc(`REQ-OPS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setNotes('');
    } catch (err: any) {
      toast.error('Gagal Memproses Pengeluaran Barang', err.message || 'Terjadi kesalahan transaksi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ArrowUpFromLine className="w-5 h-5 text-rose-500" />
          Barang Keluar (Goods Issue / Outbound)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Pengeluaran barang untuk kebutuhan operasional atau pesanan. Dilengkapi pencegahan stok negatif ketat di sisi server.
        </p>
      </div>

      {/* Main Outbound Form */}
      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Gudang Asal Pengeluaran *
            </label>
            <select
              value={sourceWarehouseId}
              onChange={(e) => setSourceWarehouseId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-rose-500"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nomor Surat Permintaan (Requisition) *
            </label>
            <input
              type="text"
              required
              value={referenceDoc}
              onChange={(e) => setReferenceDoc(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Departemen / Unit Pemohon *
            </label>
            <input
              type="text"
              required
              value={recipientDepartment}
              onChange={(e) => setRecipientDepartment(e.target.value)}
              placeholder="e.g. IT Infrastructure Team"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500"
            />
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

        {/* Dynamic Item Rows with Real-time Stock Check */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Barang yang Dikeluarkan
            </h3>
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baris</span>
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, idx) => {
              const matchedItem = items.find(i => i.id === row.itemId);
              const available = getAvailableStock(row.itemId, sourceWarehouseId);
              const isInsufficient = row.quantity > available;

              return (
                <div
                  key={idx}
                  className={`p-3.5 grid grid-cols-12 gap-3 items-center text-xs transition-colors ${
                    isInsufficient
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-l-4 border-l-rose-500'
                      : 'bg-slate-50/30 dark:bg-slate-800/20'
                  }`}
                >
                  <div className="col-span-12 sm:col-span-6">
                    <label className="block text-[10px] text-slate-400 mb-1 sm:hidden">Pilih Barang</label>
                    <select
                      value={row.itemId}
                      onChange={(e) => handleItemChange(idx, e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      {items.map(it => {
                        const whStock = getAvailableStock(it.id, sourceWarehouseId);
                        return (
                          <option key={it.id} value={it.id}>
                            [{it.sku}] {it.name} - Tersedia di gudang ini: {whStock} {it.unitSymbol}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="col-span-5 sm:col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-1 sm:hidden">Kuantitas Keluar</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => handleQtyChange(idx, parseInt(e.target.value, 10) || 1)}
                      className={`w-full p-2 rounded-lg border font-bold text-center ${
                        isInsufficient
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-200'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      }`}
                    />
                  </div>

                  <div className="col-span-5 sm:col-span-3">
                    <div className="text-[11px]">
                      <span>Stok Tersedia: </span>
                      <strong className={available === 0 ? 'text-rose-600 font-bold' : 'text-slate-900 dark:text-slate-100'}>
                        {available} {matchedItem?.unitSymbol}
                      </strong>
                    </div>
                    {isInsufficient && (
                      <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 mt-0.5">
                        <AlertOctagon className="w-3 h-3" /> Kurang {row.quantity - available} unit!
                      </div>
                    )}
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

        {/* Form Footer */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex-1 w-full max-w-md">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Keperluan / Catatan Pengeluaran:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Pengambilan perlengkapan APD teknisi CDC Shift 1"
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || hasNegativeStockViolation}
            className={`px-6 py-2.5 rounded-xl font-semibold shadow-md transition-all hover:scale-102 flex items-center gap-2 ${
              hasNegativeStockViolation
                ? 'bg-slate-400 text-white cursor-not-allowed opacity-60'
                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Memvalidasi Transaksi...' : 'Konfirmasi Pengeluaran Barang'}</span>
          </button>
        </div>
      </form>

      {/* Historical Outbound Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-rose-500" />
          Riwayat Pengeluaran Barang Terakhir
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">No. Mutasi</th>
                <th className="py-2.5 px-3">Gudang Asal</th>
                <th className="py-2.5 px-3">No. Referensi / Departemen</th>
                <th className="py-2.5 px-3">Dikeluarkan Oleh</th>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">Belum ada transaksi pengeluaran barang.</td>
                </tr>
              ) : (
                recentMovements.map(mov => (
                  <tr key={mov.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                      {mov.movementNumber}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {mov.sourceWarehouseName}
                    </td>
                    <td className="py-3 px-3">{mov.referenceDoc || '-'}</td>
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
