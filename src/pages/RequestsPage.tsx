import React, { useState, useEffect } from 'react';
import { ItemRequest, Item } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { FileText, PlusCircle, CheckCircle, Clock } from 'lucide-react';

export const RequestsPage: React.FC = () => {
  const { can, user } = useAuth();
  const toast = useNotification();
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [department, setDepartment] = useState('Central Operations');
  const [urgency, setUrgency] = useState('NORMAL');
  const [reason, setReason] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [requestedQty, setRequestedQty] = useState(5);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqRes, itemRes] = await Promise.all([
        api.getRequests(),
        api.getItems({ limit: 100 }),
      ]);
      setRequests(reqRes.requests);
      setItems(itemRes.items);
      if (itemRes.items[0]) setSelectedItemId(itemRes.items[0].id);
      if (user?.department) setDepartment(user.department);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Validasi Gagal', 'Alasan pengajuan permohonan wajib diisi.');
      return;
    }

    const matched = items.find(i => i.id === selectedItemId);
    try {
      await api.createRequest({
        department,
        urgency,
        reason,
        details: [
          {
            itemId: selectedItemId,
            itemSku: matched?.sku || '',
            itemName: matched?.name || '',
            requestedQty,
          }
        ],
      });

      toast.success('Permintaan Diajukan', 'Permintaan barang telah dicatat dan menunggu approval manajer.');
      setIsModalOpen(false);
      setReason('');
      loadData();
    } catch (err: any) {
      toast.error('Gagal Mengajukan Permintaan', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            Permintaan Barang & Alur Persetujuan (Item Requisitions)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pengajuan kebutuhan internal divisi/cabang dengan tingkatan urgensi dan verifikasi alokasi
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-102"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Buat Permintaan Barang</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Daftar Dokumen Permintaan</span>
          <span className="text-xs text-slate-400">{requests.length} pengajuan</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {requests.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Belum ada pengajuan permintaan barang. Klik tombol di atas untuk membuat permohonan baru.
            </div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {req.requestNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {req.department}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      req.urgency === 'URGENT' || req.urgency === 'HIGH'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {req.urgency}
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{req.reason}</p>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>Pemohon: {req.requestedByName}</span>
                    <span>•</span>
                    <span>Waktu: {new Date(req.createdAt).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <StatusBadge status={req.status} type="movement" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Form Pengajuan Permintaan Barang"
        subtitle="Isi kebutuhan permohonan persediaan untuk operasional departemen"
        maxWidth="md"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Departemen *</label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tingkat Urgensi</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="LOW">Rendah (Low)</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Tinggi (High)</option>
                <option value="URGENT">Mendesak (Urgent)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Barang yang Diminta *</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              {items.map(it => (
                <option key={it.id} value={it.id}>[{it.sku}] {it.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kuantitas Permintaan *</label>
            <input
              type="number"
              min="1"
              value={requestedQty}
              onChange={(e) => setRequestedQty(parseInt(e.target.value, 10) || 1)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Alasan Permintaan *</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan kebutuhan pengadaan atau peruntukan operasional..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
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
              Kirim Permintaan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
