import React, { useState } from 'react';
import { 
  Search, 
  Sun, 
  Moon, 
  Bell, 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  Menu,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleType } from '../../types';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onToggleMobileSidebar: () => void;
  lowStockCount?: number;
  onNavigate: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCommandPalette,
  onToggleMobileSidebar,
  lowStockCount = 2,
  onNavigate,
}) => {
  const { user, role, switchRole, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const roles: Array<{ role: RoleType; label: string }> = [
    { role: 'SUPER_ADMIN', label: 'Super Admin' },
    { role: 'WAREHOUSE_MANAGER', label: 'Warehouse Manager' },
    { role: 'INVENTORY_STAFF', label: 'Inventory Staff' },
    { role: 'ASSET_CUSTODIAN', label: 'Asset Custodian' },
    { role: 'AUDITOR', label: 'Auditor' },
  ];

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between transition-colors">
      {/* Left: Mobile hamburger & Global Search Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs transition-all shadow-xs"
          aria-label="Pencarian Cepat"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cari menu, SKU, atau serial...</span>
          <span className="inline sm:hidden">Cari...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Role Switcher, Database status indicator, Notification, Theme, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Role Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100/50 transition-colors shadow-2xs"
            aria-label="Ganti Role Pengguna"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">Peran:</span>
            <span>{role.replace('_', ' ')}</span>
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Simulasi Peran Enterprise
              </div>
              <div className="space-y-1">
                {roles.map(r => (
                  <button
                    key={r.role}
                    onClick={() => {
                      switchRole(r.role);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                      role === r.role
                        ? 'bg-indigo-500 text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{r.label}</span>
                    {role === r.role && <span className="text-[10px] uppercase font-bold tracking-widest">Aktif</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Database Diagnostic Indicator */}
        <button
          onClick={() => onNavigate('settings')}
          title="Status Engine Database & MySQL"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          aria-label="Database Status"
        >
          <Database className="w-4 h-4 text-emerald-500" />
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
            aria-label="Notifikasi Peringatan"
          >
            <Bell className="w-4 h-4" />
            {lowStockCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Notifikasi Stok & Audit</span>
                <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 px-1.5 py-0.5 rounded font-bold">
                  {lowStockCount} Peringatan
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div 
                  onClick={() => { onNavigate('inventory'); setShowNotifications(false); }}
                  className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 cursor-pointer hover:opacity-90"
                >
                  <p className="font-semibold text-amber-900 dark:text-amber-200 text-xs">Stok di bawah batas minimum</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Kertas Thermal Roll (12 unit) & Rompi Safety (5 unit) butuh reorder segera.
                  </p>
                </div>
                <div 
                  onClick={() => { onNavigate('audit'); setShowNotifications(false); }}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Audit Trail Siap</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Seluruh mutasi tercatat dengan timestamp dan digital identifier.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={theme === 'dark' ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Avatar & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-500 text-white flex items-center justify-center text-xs font-bold ring-2 ring-indigo-500/20">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-4 h-4" />
            )}
          </div>
          <button
            onClick={logout}
            title="Keluar / Reset Sesi"
            className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
