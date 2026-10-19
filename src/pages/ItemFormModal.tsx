import React, { useState, useEffect } from 'react';
import { Modal } from '../components/common/Modal';
import { Item, Category, Unit, Supplier, ItemType } from '../types';
import { api } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { Sparkles, Layers, QrCode } from 'lucide-react';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingItem?: Item | null;
  categories: Category[];
  units: Unit[];
  suppliers: Supplier[];
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingItem,
  categories,
  units,
  suppliers,
}) => {
  const toast = useNotification();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    categoryId: '',
    unitId: '',
    supplierId: '',
    itemType: 'CONSUMABLE' as ItemType,
    minStock: 10,
    maxStock: 500,
    reorderPoint: 20,
    safetyStock: 5,
    unitCost: 0,
    unitPrice: 0,
    initialStock: 0,
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        sku: editingItem.sku,
        barcode: editingItem.barcode || '',
        name: editingItem.name,
        description: editingItem.description || '',
        categoryId: editingItem.categoryId,
        unitId: editingItem.unitId,
        supplierId: editingItem.supplierId || '',
        itemType: editingItem.itemType,
        minStock: editingItem.minStock,
        maxStock: editingItem.maxStock,
        reorderPoint: editingItem.reorderPoint,
        safetyStock: editingItem.safetyStock,
        unitCost: editingItem.unitCost,
        unitPrice: editingItem.unitPrice,
        initialStock: editingItem.currentStock,
      });
    } else {
      setFormData({
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        barcode: `899${Math.floor(100000000 + Math.random() * 900000000)}`,
        name: '',
        description: '',
        categoryId: categories[0]?.id || '',
        unitId: units[0]?.id || '',
        supplierId: suppliers[0]?.id || '',
        itemType: 'CONSUMABLE',
        minStock: 10,
        maxStock: 500,
        reorderPoint: 20,
        safetyStock: 5,
        unitCost: 50000,
        unitPrice: 65000,
        initialStock: 25,
      });
    }
  }, [editingItem, isOpen, categories, units, suppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name || !formData.categoryId || !formData.unitId) {
      toast.error('Validasi Gagal', 'SKU, Nama Barang, Kategori, dan Satuan wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingItem) {
        await api.updateItem(editingItem.id, formData);
        toast.success('Barang Diperbarui', `Informasi untuk '${formData.name}' berhasil disimpan.`);
      } else {
        await api.createItem(formData);
        toast.success('Barang Terdaftar', `Barang '${formData.name}' berhasil ditambahkan ke inventaris.`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Gagal Menyimpan', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSKU = () => {
    const prefix = formData.itemType === 'SERIALIZED_ASSET' ? 'SKU-AST' : 'SKU-CON';
    const catCode = categories.find(c => c.id === formData.categoryId)?.code || 'GEN';
    const rand = Math.floor(100 + Math.random() * 900);
    setFormData(prev => ({
      ...prev,
      sku: `${prefix}-${catCode}-${rand}`,
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? 'Edit Master Barang' : 'Tambah Master Barang Baru'}
      subtitle="Definisikan identitas barang, tipe kuantitas atau serial unik, serta ambang batas stok"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Item Type Selector Banner */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
            Klasifikasi Domain Barang:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                formData.itemType === 'CONSUMABLE'
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
              }`}
            >
              <input
                type="radio"
                name="itemType"
                checked={formData.itemType === 'CONSUMABLE'}
                onChange={() => setFormData(p => ({ ...p, itemType: 'CONSUMABLE' }))}
                className="mt-1 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Consumable / Stock Item
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Persediaan berbasis kuantitas total (kabel, lakban, toner, helm, packaging).
                </p>
              </div>
            </label>

            <label
              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                formData.itemType === 'SERIALIZED_ASSET'
                  ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-1 ring-purple-500'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
              }`}
            >
              <input
                type="radio"
                name="itemType"
                checked={formData.itemType === 'SERIALIZED_ASSET'}
                onChange={() => setFormData(p => ({ ...p, itemType: 'SERIALIZED_ASSET' }))}
                className="mt-1 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" />
                  Serialized Asset Unit
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Aset tetap perusahaan dengan serial number dan penanggung jawab per unit.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Basic Identifiers: SKU & Barcode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Nomor SKU (Stock Keeping Unit) *
              </label>
              <button
                type="button"
                onClick={handleAutoSKU}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Auto Gen
              </button>
            </div>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={(e) => setFormData(p => ({ ...p, sku: e.target.value }))}
              placeholder="e.g. SKU-CON-NET-001"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Barcode / EAN-13
            </label>
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData(p => ({ ...p, barcode: e.target.value }))}
              placeholder="e.g. 899100200301"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Item Name */}
        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nama Barang Lengkap *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Kabel UTP Belden Cat6 305M Roll"
            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Category, Unit, Supplier */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kategori *
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData(p => ({ ...p, categoryId: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Satuan (UoM) *
            </label>
            <select
              value={formData.unitId}
              onChange={(e) => setFormData(p => ({ ...p, unitId: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Supplier Utama
            </label>
            <select
              value={formData.supplierId}
              onChange={(e) => setFormData(p => ({ ...p, supplierId: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Pilih Supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quantities & Thresholds */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <span className="font-bold text-slate-800 dark:text-slate-200 block mb-2">
            Ambang Batas & Titik Pemesanan Ulang:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Min. Stok (Safety)</label>
              <input
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) => setFormData(p => ({ ...p, minStock: parseInt(e.target.value, 10) || 0 }))}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Maks. Stok</label>
              <input
                type="number"
                min="0"
                value={formData.maxStock}
                onChange={(e) => setFormData(p => ({ ...p, maxStock: parseInt(e.target.value, 10) || 0 }))}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Reorder Point</label>
              <input
                type="number"
                min="0"
                value={formData.reorderPoint}
                onChange={(e) => setFormData(p => ({ ...p, reorderPoint: parseInt(e.target.value, 10) || 0 }))}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            {!editingItem && (
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Stok Awal CDC</label>
                <input
                  type="number"
                  min="0"
                  value={formData.initialStock}
                  onChange={(e) => setFormData(p => ({ ...p, initialStock: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>
        </div>

        {/* Pricing / Valuation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Biaya Perolehan / Unit Cost (Rp)
            </label>
            <input
              type="number"
              min="0"
              value={formData.unitCost}
              onChange={(e) => setFormData(p => ({ ...p, unitCost: parseInt(e.target.value, 10) || 0 }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nilai Buku / Harga Jual (Rp)
            </label>
            <input
              type="number"
              min="0"
              value={formData.unitPrice}
              onChange={(e) => setFormData(p => ({ ...p, unitPrice: parseInt(e.target.value, 10) || 0 }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Daftarkan Barang'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
