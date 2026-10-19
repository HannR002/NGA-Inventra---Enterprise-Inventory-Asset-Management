import React, { useState, useEffect } from 'react';
import { Warehouse, Item, StockMovement } from '../types';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { ArrowLeftRight, History, CheckCircle2, AlertCircle } from 'lucide-react';

export const StockTransferPage: React.FC = () => {
  const toast = useNotification();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [transferQty, setTransferQty] = useState(10);
  const [referenceDoc, setReferenceDoc] = useState(`TRF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      setLoading(true);
      const [whRes, itemRes, movRes] = await Promise.all([
        api.getWarehouses(),
        api.getItems({ limit: 100 }),
        api.getMovements({ type: 'TRANSFER' }),
      ]);
      setWarehouses(whRes.warehouses);
      setItems(itemRes.items);
      setRecentTransfers(movRes.movements);

      if (whRes.warehouses.length >= 2) {
        setSourceWarehouseId(whRes.warehouses[0].id);
        setTargetWarehouseId(whRes.warehouses[1].id);
      }
      if (itemRes.items[0]) {
        setSelectedItemId(itemRes.items[0].id);
      }
    } catch (err) {
      console.error('Error loading transfer prerequisites:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = items.find(i => i.id === selectedItemId);
  const sourceWh = warehouses.find(w => w.id === sourceWarehouseId);
  const targetWh = warehouses.find(w => w.id === targetWarehouseId);

  const getWhQty = (itemId: string, whId: string) => {
    const item = items.find(i => i.id === itemId);
    const bal = item?.stockBalances?.find(b => b.warehouseId === whId);
    return bal ? bal.quantity : 0;
  };

  const currentSourceQty = selectedItemId && sourceWarehouseId ? getWhQty(selectedItemId, sourceWarehouseId) : 0;
  const currentTargetQty = selectedItemId && targetWarehouseId ? getWhQty(selectedItemId, targetWarehouseId) : 0;

  const isInsufficient = transferQty > currentSourceQty;
  const isSameWarehouse = sourceWarehouseId === targetWarehouseId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSameWarehouse) {
      toast.error('Gudang Tidak Valid', 'Gudang asal dan tujuan tidak boleh sama.');
      return;
    }
    if (isInsufficient) {
      toast.error('Stok Asal Tidak Cukup', `Tersedia di ${sourceWh?.name}: ${currentSourceQty}, diminta: ${transferQty}`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createMovement({
        type: 'TRANSFER',
        sourceWarehouseId,
        targetWarehouseId,
        referenceDoc,
        notes,
        details: [
          {
            itemId: selectedItemId,
            quantity: transferQty,
            notes: `Transfer dari ${sourceWh?.code} ke ${targetWh?.code}`,
          }
        ],
      });

      toast.success(
        'Mutasi Transfer Berhasil Diproses',
        `Nomor Mutasi: ${res.movement.movementNumber}. Total stok persediaan tetap terjaga (konservasi).`
      );

      // Refresh items and transfers
      const [itemRes, movRes] = await Promise.all([
        api.getItems({ limit: 100 }),
        api.getMovements({ type: 'TRANSFER' }),
      ]);
      setItems(itemRes.items);
      setRecentTransfers(movRes.movements);
      setReferenceDoc(`TRF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setNotes('');
    } catch (err: any) {
      toast.error('Gagal Memproses Transfer', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-blue-500" />
          Mutasi Antar Gudang (Inter-Warehouse Transfer)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Relokasi stok fisik antar cabang/depot penyimpanan dengan jaminan pelestarian saldo persediaan (stock conservation).
        </p>
      </div>

      {/* Main Transfer Card */}
      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Warehouse */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3 text-xs">
            <span className="font-bold text-slate-900 dark:text-slate-100 block">
              Gudang Asal (Pengirim)
            </span>
            <select
              value={sourceWarehouseId}
              onChange={(e) => setSourceWarehouseId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>

            <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-400 block">Stok Tersedia di Gudang Asal:</span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                {currentSourceQty} {selectedItem?.unitSymbol}
              </span>
            </div>
          </div>

          {/* Target Warehouse */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3 text-xs">
            <span className="font-bold text-slate-900 dark:text-slate-100 block">
              Gudang Tujuan (Penerima)
            </span>
            <select
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>

            <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-400 block">Stok Saat Ini di Gudang Tujuan:</span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                {currentTargetQty} {selectedItem?.unitSymbol}
              </span>
            </div>
          </div>
        </div>

        {/* Transfer Item & Quantity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pilih Barang untuk Ditransfer *
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              {items.map(it => (
                <option key={it.id} value={it.id}>
                  [{it.sku}] {it.name} (Total: {it.currentStock} {it.unitSymbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kuantitas Transfer *
            </label>
            <input
              type="number"
              min="1"
              value={transferQty}
              onChange={(e) => setTransferQty(parseInt(e.target.value, 10) || 1)}
              className={`w-full p-2.5 rounded-xl border font-bold text-center ${
                isInsufficient
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'
              }`}
            />
          </div>
        </div>

        {/* Simulation Preview: Balances After Transfer */}
        {selectedItem && !isSameWarehouse && (
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 text-xs">
            <span className="font-bold text-blue-900 dark:text-blue-300 block mb-2">
              Pratinjau Saldo Setelah Mutasi Transfer:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block text-[11px]">{sourceWh?.code} (Gudang Asal)</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {currentSourceQty} → {Math.max(0, currentSourceQty - transferQty)} {selectedItem.unitSymbol}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">{targetWh?.code} (Gudang Tujuan)</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {currentTargetQty} → {currentTargetQty + transferQty} {selectedItem.unitSymbol}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Total Persediaan Perusahaan</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedItem.currentStock} {selectedItem.unitSymbol} (Konstan)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Notes & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex-1 w-full max-w-md">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan surat jalan atau nomor armada pengiriman..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || isInsufficient || isSameWarehouse}
            className="px-6 py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/30 transition-all hover:scale-102 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Mentransfer...' : 'Jalankan Mutasi Transfer'}</span>
          </button>
        </div>
      </form>

      {/* Historical Transfers */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-blue-500" />
          Riwayat Transfer Antar Gudang
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">No. Mutasi</th>
                <th className="py-2.5 px-3">Asal</th>
                <th className="py-2.5 px-3">Tujuan</th>
                <th className="py-2.5 px-3">Referensi</th>
                <th className="py-2.5 px-3">Petugas</th>
                <th className="py-2.5 px-3">Waktu</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">Belum ada mutasi transfer antar gudang.</td>
                </tr>
              ) : (
                recentTransfers.map(mov => (
                  <tr key={mov.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {mov.movementNumber}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {mov.sourceWarehouseName}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                      {mov.targetWarehouseName}
                    </td>
                    <td className="py-3 px-3 font-mono">{mov.referenceDoc || '-'}</td>
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
