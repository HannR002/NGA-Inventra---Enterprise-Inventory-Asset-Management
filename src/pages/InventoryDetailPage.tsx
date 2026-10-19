import React from 'react';
import { Item, AssetUnit } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  Package, 
  Warehouse, 
  QrCode, 
  Layers, 
  DollarSign, 
  Tag, 
  Info, 
  ArrowDownToLine, 
  ArrowUpFromLine 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface InventoryDetailPageProps {
  item: Item;
  assetUnits?: AssetUnit[];
  onClose: () => void;
  onEdit: (item: Item) => void;
  onGoodsReceipt: (item: Item) => void;
  onStockOut: (item: Item) => void;
}

export const InventoryDetailPage: React.FC<InventoryDetailPageProps> = ({
  item,
  assetUnits = [],
  onClose,
  onEdit,
  onGoodsReceipt,
  onStockOut,
}) => {
  const { can } = useAuth();

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const isLow = item.currentStock <= item.minStock;
  const isOut = item.currentStock <= 0;

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {item.sku}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
              item.itemType === 'SERIALIZED_ASSET'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
            }`}>
              {item.itemType === 'SERIALIZED_ASSET' ? 'Aset Bernomor Serial' : 'Barang Habis Pakai (Consumable)'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.name}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description || 'Tidak ada deskripsi'}</p>
        </div>

        <div className="text-right">
          <StatusBadge
            status={isOut ? 'OUT' : isLow ? 'LOW' : 'NORMAL'}
            type="stock"
            size="md"
          />
        </div>
      </div>

      {/* Stock & Valuation Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Kuantitas</span>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {item.currentStock} <span className="text-xs font-normal text-slate-500">{item.unitSymbol}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Biaya Satuan</span>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatIDR(item.unitCost)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Nilai Valuasi</span>
          <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {formatIDR(item.currentStock * item.unitCost)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Titik Reorder</span>
          <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-1">
            {item.reorderPoint} {item.unitSymbol}
          </div>
        </div>
      </div>

      {/* Stock Thresholds Guide */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-2">
        <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-500" />
          Parameter Ambang Batas Stok
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 dark:text-slate-300">
          <div>Minimum: <strong>{item.minStock} {item.unitSymbol}</strong></div>
          <div>Maksimum: <strong>{item.maxStock} {item.unitSymbol}</strong></div>
          <div>Reorder Point: <strong>{item.reorderPoint} {item.unitSymbol}</strong></div>
          <div>Safety Stock: <strong>{item.safetyStock} {item.unitSymbol}</strong></div>
        </div>
      </div>

      {/* Distribution across Warehouses */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Warehouse className="w-4 h-4 text-indigo-500" />
          Distribusi Stok per Gudang
        </h4>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {item.stockBalances && item.stockBalances.length > 0 ? (
            item.stockBalances.map(bal => (
              <div key={bal.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {bal.warehouseName || bal.warehouseCode}
                  </span>
                  <p className="text-[10px] text-slate-400">Kode: {bal.warehouseCode}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {bal.quantity} {item.unitSymbol}
                  </span>
                  {bal.reservedQty > 0 && (
                    <p className="text-[10px] text-amber-500">Direservasi: {bal.reservedQty}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-slate-400">Belum ada saldo stok tercatat di gudang.</div>
          )}
        </div>
      </div>

      {/* If Serialized Asset: Show registered unique asset units */}
      {item.itemType === 'SERIALIZED_ASSET' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-purple-500" />
              Daftar Unit Serial Terdaftar ({assetUnits.length})
            </h4>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {assetUnits.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                Belum ada unit serial yang didaftarkan untuk SKU ini.
              </div>
            ) : (
              assetUnits.map(unit => (
                <div key={unit.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{unit.assetTag}</span>
                      <span className="font-mono text-slate-500 text-[11px]">{unit.serialNumber}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Penanggung Jawab: <strong>{unit.assignedToUserName || 'Belum Ditugaskan'}</strong> {unit.department ? `(${unit.department})` : ''}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <StatusBadge status={unit.status} type="asset" />
                    <span className="text-[10px] text-slate-400">Kondisi: {unit.condition}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Specifications */}
      {item.specifications && Object.keys(item.specifications).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Spesifikasi Teknis</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(item.specifications).map(([key, val]) => (
              <div key={key} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60">
                <span className="text-slate-400 block text-[10px]">{key}</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {can('items:update') && (
          <button
            onClick={() => onEdit(item)}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Edit Informasi Barang
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {can('movements:in') && (
            <button
              onClick={() => onGoodsReceipt(item)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Barang Masuk</span>
            </button>
          )}

          {can('movements:out') && item.currentStock > 0 && (
            <button
              onClick={() => onStockOut(item)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              <span>Barang Keluar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
