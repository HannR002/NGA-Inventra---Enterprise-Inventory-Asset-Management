import React, { useState, useEffect } from 'react';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Drawer } from '../components/common/Drawer';
import { InventoryDetailPage } from './InventoryDetailPage';
import { ItemFormModal } from './ItemFormModal';
import { Item, Category, Unit, Supplier, AssetUnit } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { PlusCircle, Download, Eye, Layers, QrCode } from 'lucide-react';

interface InventoryListPageProps {
  onNavigateToReceipt: (item?: Item) => void;
  onNavigateToStockOut: (item?: Item) => void;
}

export const InventoryListPage: React.FC<InventoryListPageProps> = ({
  onNavigateToReceipt,
  onNavigateToStockOut,
}) => {
  const { can } = useAuth();
  const toast = useNotification();

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedItemType, setSelectedItemType] = useState<string>('');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('');

  // Modals & Drawer
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [activeAssetUnits, setActiveAssetUnits] = useState<AssetUnit[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedItemType, selectedStockStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsRes, catsRes, unitsRes, supsRes] = await Promise.all([
        api.getItems({
          categoryId: selectedCategory || undefined,
          itemType: selectedItemType || undefined,
          stockStatus: selectedStockStatus || undefined,
          limit: 100,
        }),
        api.getCategories(),
        api.getUnits(),
        api.getSuppliers(),
      ]);
      setItems(itemsRes.items);
      setCategories(catsRes.categories);
      setUnits(unitsRes.units);
      setSuppliers(supsRes.suppliers);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (item: Item) => {
    try {
      const res = await api.getItem(item.id);
      setActiveItem(res.item);
      setActiveAssetUnits(res.assetUnits);
      setIsDrawerOpen(true);
    } catch (err: any) {
      toast.error('Gagal Membuka Detail', err.message);
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setIsFormModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleExportCSV = () => {
    const headers = ['SKU', 'Barcode', 'Nama Barang', 'Kategori', 'Tipe', 'Stok', 'Satuan', 'Biaya Unit (Rp)', 'Total Valuasi (Rp)'];
    const rows = items.map(i => [
      i.sku,
      i.barcode || '',
      `"${i.name.replace(/"/g, '""')}"`,
      i.categoryName || '',
      i.itemType,
      i.currentStock,
      i.unitSymbol || '',
      i.unitCost,
      i.currentStock * i.unitCost,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventra_master_barang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Ekspor Berhasil', `${items.length} master barang berhasil diekspor ke format CSV.`);
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const columns: Column<Item>[] = [
    {
      header: 'SKU & Barcode',
      accessor: 'sku',
      sortable: true,
      className: 'w-44 font-mono',
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100">{item.sku}</div>
          {item.barcode && (
            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>{item.barcode}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Nama Barang & Kategori',
      accessor: 'name',
      sortable: true,
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</span>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {item.categoryName || 'Tanpa Kategori'}
          </div>
        </div>
      ),
    },
    {
      header: 'Tipe Domain',
      accessor: 'itemType',
      sortable: true,
      className: 'w-36',
      render: (item) => (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
          item.itemType === 'SERIALIZED_ASSET'
            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
        }`}>
          {item.itemType === 'SERIALIZED_ASSET' ? <QrCode className="w-3 h-3 text-purple-500" /> : <Layers className="w-3 h-3 text-slate-500" />}
          {item.itemType === 'SERIALIZED_ASSET' ? 'Serialized Unit' : 'Consumable'}
        </span>
      ),
    },
    {
      header: 'Tingkat Persediaan',
      accessor: 'currentStock',
      sortable: true,
      className: 'w-48',
      render: (item) => {
        const percent = Math.min(Math.round((item.currentStock / Math.max(item.minStock * 2, 10)) * 100), 100);
        const isCritical = item.currentStock <= item.safetyStock;
        const isLow = item.currentStock <= item.minStock;

        return (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between font-bold text-xs">
              <span className={isCritical ? 'text-rose-600 dark:text-rose-400' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}>
                {item.currentStock} {item.unitSymbol}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Min: {item.minStock}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                style={{ width: `${percent}%` }}
                className={`h-full rounded-full transition-all ${
                  isCritical ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Biaya Satuan',
      accessor: 'unitCost',
      sortable: true,
      className: 'w-32',
      render: (item) => (
        <span className="font-mono text-slate-700 dark:text-slate-300">
          {formatIDR(item.unitCost)}
        </span>
      ),
    },
    {
      header: 'Status',
      className: 'w-28 text-center',
      render: (item) => {
        const status = item.currentStock <= 0 ? 'OUT' : item.currentStock <= item.minStock ? 'LOW' : 'NORMAL';
        return <StatusBadge status={status} type="stock" />;
      },
    },
    {
      header: 'Aksi',
      className: 'w-20 text-right',
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetail(item);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
          title="Lihat Detail Item"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const filterControls = (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      {/* Category Dropdown */}
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">Semua Kategori</option>
        {categories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Item Type Dropdown */}
      <select
        value={selectedItemType}
        onChange={(e) => setSelectedItemType(e.target.value)}
        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">Semua Tipe</option>
        <option value="CONSUMABLE">Consumable (Habis Pakai)</option>
        <option value="SERIALIZED_ASSET">Serialized Asset (Aset Tetap)</option>
      </select>

      {/* Stock Status Dropdown */}
      <select
        value={selectedStockStatus}
        onChange={(e) => setSelectedStockStatus(e.target.value)}
        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">Semua Status Stok</option>
        <option value="normal">Stok Aman (Normal)</option>
        <option value="low">Peringatan (Low Stock)</option>
        <option value="out">Habis Total (Out of Stock)</option>
      </select>
    </div>
  );

  const tableActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCSV}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Ekspor CSV</span>
      </button>

      {can('items:create') && (
        <button
          onClick={() => {
            setEditingItem(null);
            setIsFormModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-102"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Tambah Barang</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Katalog Master Barang & Persediaan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manajemen SKU, parameter ambang batas minimum, dan pemisahan unit aset serial
          </p>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={items}
        keyField="id"
        searchPlaceholder="Cari berdasarkan SKU, nama barang, atau barcode..."
        isLoading={loading}
        filters={filterControls}
        actions={tableActions}
        onRowClick={handleOpenDetail}
      />

      {/* Slide-over Detail Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Detail Spesifikasi & Stok Barang"
        subtitle={`SKU: ${activeItem?.sku || ''}`}
        width="lg"
      >
        {activeItem && (
          <InventoryDetailPage
            item={activeItem}
            assetUnits={activeAssetUnits}
            onClose={() => setIsDrawerOpen(false)}
            onEdit={handleEdit}
            onGoodsReceipt={(it) => {
              setIsDrawerOpen(false);
              onNavigateToReceipt(it);
            }}
            onStockOut={(it) => {
              setIsDrawerOpen(false);
              onNavigateToStockOut(it);
            }}
          />
        )}
      </Drawer>

      {/* Create / Edit Form Modal */}
      <ItemFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSaved={loadData}
        editingItem={editingItem}
        categories={categories}
        units={units}
        suppliers={suppliers}
      />
    </div>
  );
};
