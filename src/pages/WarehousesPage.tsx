import React, { useState, useEffect } from 'react';
import { Warehouse } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Modal } from '../components/common/Modal';
import { Warehouse as WarehouseIcon, PlusCircle, MapPin, Box, UserCheck } from 'lucide-react';

export const WarehousesPage: React.FC = () => {
  const { can } = useAuth();
  const toast = useNotification();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    code: `WH-LOC-0${Math.floor(5 + Math.random() * 5)}`,
    name: '',
    branch: '',
    address: '',
    capacityCbm: 5000,
  });

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const res = await api.getWarehouses();
      setWarehouses(res.warehouses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.branch) {
      toast.error('Validasi Gagal', 'Kode, nama, dan cabang wajib diisi.');
      return;
    }
    try {
      await api.createWarehouse(form);
      toast.success('Gudang Ditambahkan', `Gudang ${form.name} berhasil dibuat.`);
      setIsModalOpen(false);
      setForm({
        code: `WH-LOC-0${Math.floor(5 + Math.random() * 5)}`,
        name: '',
        branch: '',
        address: '',
        capacityCbm: 5000,
      });
      loadWarehouses();
    } catch (err: any) {
      toast.error('Gagal Membuat Gudang', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <WarehouseIcon className="w-5 h-5 text-indigo-500" />
            Master Gudang, Cabang & Lokasi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pusat distribusi logistik, kapasitas kubikasi (CBM), dan penanggung jawab operasional cabang
          </p>
        </div>

        {can('warehouses:create') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-102"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Tambah Gudang Baru</span>
          </button>
        )}
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {warehouses.map(wh => (
          <div
            key={wh.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {wh.code}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {wh.name}
                </h3>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {wh.branch}
                </span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Aktif Operasional" />
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{wh.address}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kapasitas: <strong className="text-slate-900 dark:text-slate-100">{wh.capacityCbm.toLocaleString()} CBM</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mgr: <strong className="text-slate-900 dark:text-slate-100">{wh.managerName || 'Dewi Kartika'}</strong></span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Warehouse Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tambah Fasilitas Gudang / Cabang"
        subtitle="Daftarkan entitas fisik pergudangan baru ke jaringan logistik"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kode Gudang *</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm(p => ({ ...p, code: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Cabang / Hub *</label>
              <input
                type="text"
                required
                value={form.branch}
                onChange={(e) => setForm(p => ({ ...p, branch: e.target.value }))}
                placeholder="e.g. Bali Regional Hub"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Fasilitas Gudang *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Denpasar Distribution Center"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Alamat Lengkap</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Jl. Bypass Ngurah Rai..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kapasitas (CBM)</label>
            <input
              type="number"
              value={form.capacityCbm}
              onChange={(e) => setForm(p => ({ ...p, capacityCbm: parseInt(e.target.value, 10) || 1000 }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30"
            >
              Simpan Gudang
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
