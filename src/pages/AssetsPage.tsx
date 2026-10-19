import React, { useState, useEffect } from 'react';
import { AssetUnit, Item, Warehouse, User, AssetStatus, AssetCondition } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { Drawer } from '../components/common/Drawer';
import { 
  QrCode, 
  PlusCircle, 
  UserCheck, 
  Wrench, 
  RotateCcw, 
  Building, 
  Eye,
  Calendar
} from 'lucide-react';

export const AssetsPage: React.FC = () => {
  const { can, user } = useAuth();
  const toast = useNotification();

  const [assets, setAssets] = useState<AssetUnit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('');

  // Modals
  const [activeAsset, setActiveAsset] = useState<AssetUnit | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Form states
  const [newAsset, setNewAsset] = useState({
    assetTag: `AST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    serialNumber: `SN-${Date.now().toString().slice(-8)}`,
    itemId: '',
    warehouseId: '',
    status: 'AVAILABLE' as AssetStatus,
    condition: 'NEW' as AssetCondition,
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCost: 25000000,
    notes: 'Unit aset baru diterima di gudang.',
  });

  const [assignForm, setAssignForm] = useState({
    assignedToUserId: '',
    department: 'Engineering',
    status: 'ASSIGNED' as AssetStatus,
    condition: 'GOOD' as AssetCondition,
    notes: 'Penyerahan aset kepada karyawan.',
  });

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedCondition]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [astRes, itemRes, whRes, usrRes] = await Promise.all([
        api.getAssets({
          status: selectedStatus || undefined,
          condition: selectedCondition || undefined,
        }),
        api.getItems({ itemType: 'SERIALIZED_ASSET', limit: 100 }),
        api.getWarehouses(),
        api.getUsers(),
      ]);
      setAssets(astRes.assets);
      setItems(itemRes.items);
      setWarehouses(whRes.warehouses);
      setUsers(usrRes.users);

      if (itemRes.items[0]) setNewAsset(p => ({ ...p, itemId: itemRes.items[0].id }));
      if (whRes.warehouses[0]) setNewAsset(p => ({ ...p, warehouseId: whRes.warehouses[0].id }));
      if (usrRes.users[0]) setAssignForm(p => ({ ...p, assignedToUserId: usrRes.users[0].id }));
    } catch (err) {
      console.error('Failed to load assets data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.assetTag || !newAsset.serialNumber || !newAsset.itemId || !newAsset.warehouseId) {
      toast.error('Validasi Gagal', 'Semua field wajib diisi.');
      return;
    }

    try {
      await api.createAsset(newAsset);
      toast.success('Aset Terdaftar', `Unit aset ${newAsset.assetTag} (${newAsset.serialNumber}) berhasil didaftarkan.`);
      setIsCreateModalOpen(false);
      setNewAsset({
        assetTag: `AST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        serialNumber: `SN-${Date.now().toString().slice(-8)}`,
        itemId: items[0]?.id || '',
        warehouseId: warehouses[0]?.id || '',
        status: 'AVAILABLE',
        condition: 'NEW',
        purchaseDate: new Date().toISOString().slice(0, 10),
        purchaseCost: 25000000,
        notes: 'Unit aset baru diterima di gudang.',
      });
      loadData();
    } catch (err: any) {
      toast.error('Gagal Mendaftarkan Aset', err.message);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAsset) return;

    try {
      await api.updateAssetStatus(activeAsset.id, assignForm);
      toast.success('Status Aset Diperbarui', `Status ${activeAsset.assetTag} berhasil diubah ke ${assignForm.status}.`);
      setIsAssignModalOpen(false);
      loadData();
      if (isDetailDrawerOpen) {
        const refreshed = await api.getAsset(activeAsset.id);
        setActiveAsset(refreshed.asset);
      }
    } catch (err: any) {
      toast.error('Gagal Memperbarui Aset', err.message);
    }
  };

  const openAssignModal = (asset: AssetUnit) => {
    setActiveAsset(asset);
    setAssignForm({
      assignedToUserId: asset.assignedToUserId || users[0]?.id || '',
      department: asset.department || 'Operations',
      status: asset.assignedToUserId ? 'ASSIGNED' : 'ASSIGNED',
      condition: asset.condition,
      notes: 'Penyerahan aset kepada pegawai.',
    });
    setIsAssignModalOpen(true);
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const columns: Column<AssetUnit>[] = [
    {
      header: 'Asset Tag & Serial No.',
      accessor: 'assetTag',
      sortable: true,
      className: 'w-48 font-mono',
      render: (a) => (
        <div>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">{a.assetTag}</span>
          <div className="text-[11px] text-slate-500 font-normal">{a.serialNumber}</div>
        </div>
      ),
    },
    {
      header: 'Perangkat / Model Induk',
      accessor: 'itemName',
      sortable: true,
      render: (a) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{a.itemName}</span>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{a.itemSku}</div>
        </div>
      ),
    },
    {
      header: 'Penanggung Jawab (Custodian)',
      accessor: 'assignedToUserName',
      sortable: true,
      className: 'w-48',
      render: (a) => (
        <div>
          {a.assignedToUserName ? (
            <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
              <UserCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate">{a.assignedToUserName}</span>
            </div>
          ) : (
            <span className="text-slate-400 italic">Belum ditugaskan (In Pool)</span>
          )}
          {a.department && (
            <div className="text-[10px] text-slate-400 mt-0.5">{a.department}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Gudang / Lokasi',
      accessor: 'warehouseName',
      sortable: true,
      className: 'w-40',
      render: (a) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-slate-100">{a.warehouseName}</span>
          {a.locationCode && (
            <div className="text-[10px] text-slate-400">Rak: {a.locationCode}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Kondisi',
      accessor: 'condition',
      sortable: true,
      className: 'w-28 text-center',
      render: (a) => <StatusBadge status={a.condition} type="condition" />,
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      className: 'w-36 text-center',
      render: (a) => <StatusBadge status={a.status} type="asset" />,
    },
    {
      header: 'Aksi',
      className: 'w-24 text-right',
      render: (a) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setActiveAsset(a);
              setIsDetailDrawerOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Lihat Detail & Barcode"
          >
            <Eye className="w-4 h-4" />
          </button>
          {can('assets:assign') && (
            <button
              onClick={() => openAssignModal(a)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Ganti Penanggung Jawab / Status"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const filterControls = (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <select
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
      >
        <option value="">Semua Status Aset</option>
        <option value="AVAILABLE">Tersedia di Gudang (Available)</option>
        <option value="ASSIGNED">Sedang Digunakan (Assigned)</option>
        <option value="IN_MAINTENANCE">Dalam Perawatan (Maintenance)</option>
        <option value="DISPOSED">Dihapusbukukan</option>
      </select>

      <select
        value={selectedCondition}
        onChange={(e) => setSelectedCondition(e.target.value)}
        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
      >
        <option value="">Semua Kondisi Fisik</option>
        <option value="NEW">Baru (New)</option>
        <option value="EXCELLENT">Sangat Baik (Excellent)</option>
        <option value="GOOD">Baik (Good)</option>
        <option value="FAIR">Cukup / Usang (Fair)</option>
        <option value="DAMAGED">Rusak (Damaged)</option>
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-500" />
            Aset Tetap & Bernomor Serial (Serialized Assets)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pelacakan individual unit aset unik dengan serial number vendor, tag aset, penanggung jawab, dan riwayat mutasi
          </p>
        </div>

        {can('assets:create') && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-102"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Daftarkan Unit Aset</span>
          </button>
        )}
      </div>

      {/* Main DataTable */}
      <DataTable
        columns={columns}
        data={assets}
        keyField="id"
        searchPlaceholder="Cari nomor seri, tag aset, nama item, atau pemegang..."
        isLoading={loading}
        filters={filterControls}
      />

      {/* Register Serialized Asset Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Daftarkan Unit Aset Serial Baru"
        subtitle="Registrasikan nomor seri unik fisik ke dalam katalog aset terdaftar"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateAsset} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Asset Tag Perusahaan *
              </label>
              <input
                type="text"
                required
                value={newAsset.assetTag}
                onChange={(e) => setNewAsset(p => ({ ...p, assetTag: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Serial Number Vendor (SN) *
              </label>
              <input
                type="text"
                required
                value={newAsset.serialNumber}
                onChange={(e) => setNewAsset(p => ({ ...p, serialNumber: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Model Item Induk (Khusus Tipe SERIALIZED_ASSET) *
            </label>
            <select
              value={newAsset.itemId}
              onChange={(e) => setNewAsset(p => ({ ...p, itemId: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              {items.map(it => (
                <option key={it.id} value={it.id}>[{it.sku}] {it.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lokasi Gudang Penempatan *
              </label>
              <select
                value={newAsset.warehouseId}
                onChange={(e) => setNewAsset(p => ({ ...p, warehouseId: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kondisi Fisik Saat Penerimaan
              </label>
              <select
                value={newAsset.condition}
                onChange={(e) => setNewAsset(p => ({ ...p, condition: e.target.value as any }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="NEW">Baru (New)</option>
                <option value="EXCELLENT">Sangat Baik (Excellent)</option>
                <option value="GOOD">Baik (Good)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tanggal Pembelian / Serah Terima
              </label>
              <input
                type="date"
                value={newAsset.purchaseDate}
                onChange={(e) => setNewAsset(p => ({ ...p, purchaseDate: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Biaya Perolehan Aset (Rp)
              </label>
              <input
                type="number"
                value={newAsset.purchaseCost}
                onChange={(e) => setNewAsset(p => ({ ...p, purchaseCost: parseInt(e.target.value, 10) || 0 }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Keterangan / Catatan Fisik
            </label>
            <input
              type="text"
              value={newAsset.notes}
              onChange={(e) => setNewAsset(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Disimpan di lemari besi ruang server CDC"
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30"
            >
              Simpan & Daftarkan Aset
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Custodian / Update Status Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Perbarui Penanggung Jawab & Status Aset"
        subtitle={`Asset Tag: ${activeAsset?.assetTag || ''} (${activeAsset?.serialNumber || ''})`}
        maxWidth="md"
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Status Aset Baru *
            </label>
            <select
              value={assignForm.status}
              onChange={(e) => setAssignForm(p => ({ ...p, status: e.target.value as any }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="ASSIGNED">Diserahkan ke Pegawai (Assigned)</option>
              <option value="AVAILABLE">Dikembalikan ke Pool Gudang (Available)</option>
              <option value="IN_MAINTENANCE">Kirim ke Vendor Servis (In Maintenance)</option>
              <option value="DISPOSED">Hapus Bukukan (Disposed)</option>
            </select>
          </div>

          {assignForm.status === 'ASSIGNED' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Pegawai Penanggung Jawab (Custodian) *
                </label>
                <select
                  value={assignForm.assignedToUserId}
                  onChange={(e) => setAssignForm(p => ({ ...p, assignedToUserId: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Departemen Pengguna
                </label>
                <input
                  type="text"
                  value={assignForm.department}
                  onChange={(e) => setAssignForm(p => ({ ...p, department: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kondisi Fisik Saat Penyerahan
            </label>
            <select
              value={assignForm.condition}
              onChange={(e) => setAssignForm(p => ({ ...p, condition: e.target.value as any }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="NEW">Baru</option>
              <option value="EXCELLENT">Sangat Baik</option>
              <option value="GOOD">Baik</option>
              <option value="FAIR">Cukup / Usang</option>
              <option value="DAMAGED">Rusak</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan Berita Acara Serah Terima (BAST):
            </label>
            <input
              type="text"
              value={assignForm.notes}
              onChange={(e) => setAssignForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30"
            >
              Konfirmasi Perubahan Status
            </button>
          </div>
        </form>
      </Modal>

      {/* Asset Detail Drawer */}
      <Drawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        title="Detail Kartu Identitas Aset Serial"
        subtitle={activeAsset?.assetTag || ''}
        width="md"
      >
        {activeAsset && (
          <div className="space-y-6 text-xs">
            {/* Visual Asset Tag Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-mono text-xs uppercase tracking-widest text-indigo-300 font-bold">
                  NGA INVENTRA PROPERTY
                </span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                  DO NOT REMOVE
                </span>
              </div>

              <div className="space-y-1">
                <span className="font-mono text-2xl font-black tracking-tight text-white block">
                  {activeAsset.assetTag}
                </span>
                <p className="font-mono text-xs text-slate-300">
                  SN: {activeAsset.serialNumber}
                </p>
                <p className="text-xs font-semibold text-white pt-1">
                  {activeAsset.itemName}
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                <span>Gudang: {activeAsset.warehouseName}</span>
                <span className="font-mono text-emerald-400 font-bold">{formatIDR(activeAsset.purchaseCost)}</span>
              </div>
            </div>

            {/* Custodian Info */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                Penanggung Jawab (Custodian Saat Ini)
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {activeAsset.assignedToUserName || 'Tersedia di Gudang (Belum Ditugaskan)'}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Departemen: {activeAsset.department || '-'}
                  </p>
                </div>
                <StatusBadge status={activeAsset.status} type="asset" />
              </div>
            </div>

            {/* Condition & Purchase Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Kondisi Fisik</span>
                <div className="mt-1">
                  <StatusBadge status={activeAsset.condition} type="condition" />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tanggal Pembelian</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                  {activeAsset.purchaseDate || '-'}
                </span>
              </div>
            </div>

            {/* Notes */}
            {activeAsset.notes && (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Catatan Log Aset</span>
                <p className="text-slate-700 dark:text-slate-300">{activeAsset.notes}</p>
              </div>
            )}

            {/* Quick Actions */}
            {can('assets:assign') && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => openAssignModal(activeAsset)}
                  className="w-full py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 text-center transition-all"
                >
                  Ganti Penanggung Jawab / Ubah Status
                </button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
