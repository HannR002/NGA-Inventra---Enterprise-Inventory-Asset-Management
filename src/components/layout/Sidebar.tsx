import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Warehouse, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ArrowLeftRight, 
  QrCode, 
  ClipboardCheck, 
  FileText, 
  BarChart3, 
  Users, 
  Settings, 
  History, 
  Layers,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  lowStockCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  lowStockCount = 2,
}) => {
  const { can } = useAuth();

  const handleNav = (page: string) => {
    onNavigate(page);
    onCloseMobile();
  };

  const menuSections = [
    {
      title: 'Utama',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Inventaris & Logistik',
      items: [
        { 
          id: 'inventory', 
          label: 'Master Barang', 
          icon: <Package className="w-4 h-4" />, 
          badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined,
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
        },
        { id: 'warehouses', label: 'Gudang & Lokasi', icon: <Warehouse className="w-4 h-4" /> },
        { id: 'goods-receipt', label: 'Barang Masuk (In)', icon: <ArrowDownToLine className="w-4 h-4" />, permission: 'movements:in' },
        { id: 'stock-out', label: 'Barang Keluar (Out)', icon: <ArrowUpFromLine className="w-4 h-4" />, permission: 'movements:out' },
        { id: 'transfer', label: 'Mutasi Antar Gudang', icon: <ArrowLeftRight className="w-4 h-4" />, permission: 'movements:transfer' },
      ],
    },
    {
      title: 'Aset Perusahaan',
      items: [
        { 
          id: 'assets', 
          label: 'Aset Bernomor Serial', 
          icon: <QrCode className="w-4 h-4" />,
          badge: 'Serialized',
          badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
        },
      ],
    },
    {
      title: 'Kontrol & Permintaan',
      items: [
        { id: 'stock-opname', label: 'Stock Opname', icon: <ClipboardCheck className="w-4 h-4" />, permission: 'opname:read' },
        { id: 'requests', label: 'Permintaan Barang', icon: <FileText className="w-4 h-4" />, permission: 'requests:read' },
      ],
    },
    {
      title: 'Laporan & Governance',
      items: [
        { id: 'reports', label: 'Laporan & Valuasi', icon: <BarChart3 className="w-4 h-4" />, permission: 'reports:read' },
        { id: 'audit', label: 'Audit Trail', icon: <History className="w-4 h-4" />, permission: 'audit:read' },
        { id: 'users-roles', label: 'Pengguna & Izin', icon: <Users className="w-4 h-4" />, permission: 'users:read' },
        { id: 'settings', label: 'Pengaturan Sistem', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/20">
            NI
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white font-mono">NGA INVENTRA</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 bg-indigo-500/30 text-indigo-300 rounded font-semibold border border-indigo-400/20">
                v1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">Enterprise Asset Management</p>
          </div>
        </div>

        {isOpenMobile && (
          <button 
            onClick={onCloseMobile} 
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
            aria-label="Tutup Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {menuSections.map((section, sIdx) => {
          const visibleItems = section.items.filter(item => !item.permission || can(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className="space-y-1">
              <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {section.title}
              </h4>
              <div className="space-y-0.5 pt-1">
                {visibleItems.map(item => {
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={`transition-transform duration-200 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          isActive ? 'bg-white/20 text-white' : item.badgeColor
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Persistence Architecture Badge */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex items-center justify-between font-semibold text-slate-300 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            MySQL 8 Engine Ready
          </span>
          <span className="text-[10px] text-indigo-400 font-mono">Prisma</span>
        </div>
        <p className="text-[10px] leading-tight text-slate-400">
          Transaksi mutasi stok terlindungi database lock & idempotency.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
            onClick={onCloseMobile}
            aria-hidden="true" 
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-full shadow-2xl z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
