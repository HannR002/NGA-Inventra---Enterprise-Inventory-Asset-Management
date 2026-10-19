import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Package, 
  Warehouse, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ArrowLeftRight, 
  QrCode, 
  BarChart3, 
  Users, 
  History,
  X 
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose(); // toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    { id: 'dashboard', label: 'Buka Dashboard Analytics', category: 'Navigasi', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'inventory', label: 'Katalog Master Barang & Stok', category: 'Inventaris', icon: <Package className="w-4 h-4" /> },
    { id: 'assets', label: 'Daftar Aset Bernomor Serial (Apple, Dell, Zebra)', category: 'Aset', icon: <QrCode className="w-4 h-4" /> },
    { id: 'goods-receipt', label: 'Input Barang Masuk (Goods Inbound / PO)', category: 'Mutasi', icon: <ArrowDownToLine className="w-4 h-4" /> },
    { id: 'stock-out', label: 'Input Barang Keluar (Goods Issue)', category: 'Mutasi', icon: <ArrowUpFromLine className="w-4 h-4" /> },
    { id: 'transfer', label: 'Mutasi Antar Gudang (CDC Jakarta -> Surabaya)', category: 'Mutasi', icon: <ArrowLeftRight className="w-4 h-4" /> },
    { id: 'warehouses', label: 'Master Gudang & Lokasi Rak', category: 'Inventaris', icon: <Warehouse className="w-4 h-4" /> },
    { id: 'audit', label: 'Periksa Riwayat Audit Trail', category: 'Governance', icon: <History className="w-4 h-4" /> },
    { id: 'users-roles', label: 'Matriks Hak Akses & Peran Pengguna', category: 'Admin', icon: <Users className="w-4 h-4" /> },
  ];

  const filtered = query.trim()
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleSelect = (pageId: string) => {
    onNavigate(pageId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative mx-auto max-w-xl transform rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nama halaman, modul, atau aksi cepat..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Tidak ada hasil yang cocok dengan "{query}"
            </div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                onClick={() => handleSelect(cmd.id)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 group-hover:text-indigo-600 transition-colors">
                    {cmd.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{cmd.label}</div>
                    <div className="text-[10px] text-slate-400">{cmd.category}</div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 font-mono">Buka ↵</span>
              </button>
            ))
          )}
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Tekan <kbd className="px-1 py-0.5 bg-white dark:bg-slate-900 border rounded font-mono">ESC</kbd> untuk keluar</span>
          <span className="font-mono">NGA Inventra Command Palette</span>
        </div>
      </div>
    </div>
  );
};
