import React, { useState, useEffect } from 'react';
import { User, RoleType } from '../types';
import { api } from '../services/api';
import { Users, ShieldCheck, Check, X, UserCheck } from 'lucide-react';

export const UsersRolesPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers();
      setUsers(res.users);
      setRolePermissions(res.rolePermissions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const capabilities = [
    { code: 'items:read', label: 'Melihat Katalog Master Barang', module: 'Inventaris' },
    { code: 'items:create', label: 'Membuat Master Barang Baru', module: 'Inventaris' },
    { code: 'items:update', label: 'Mengubah Data & Ambang Batas SKU', module: 'Inventaris' },
    { code: 'movements:in', label: 'Memproses Barang Masuk (PO/Inbound)', module: 'Mutasi' },
    { code: 'movements:out', label: 'Memproses Barang Keluar (Goods Issue)', module: 'Mutasi' },
    { code: 'movements:transfer', label: 'Memproses Mutasi Antar Gudang', module: 'Mutasi' },
    { code: 'movements:approve', label: 'Otorisasi & Approval Dokumen Mutasi', module: 'Mutasi' },
    { code: 'assets:read', label: 'Melihat Register Aset Serial', module: 'Aset' },
    { code: 'assets:create', label: 'Mendaftarkan Unit Aset Serial Baru', module: 'Aset' },
    { code: 'assets:assign', label: 'Mengalokasikan Penanggung Jawab Aset', module: 'Aset' },
    { code: 'opname:create', label: 'Menjalankan Hitung Fisik Stock Opname', module: 'Kontrol' },
    { code: 'opname:adjust', label: 'Persetujuan Penyesuaian Selisih Opname', module: 'Kontrol' },
    { code: 'requests:approve', label: 'Otorisasi Permintaan Barang Unit', module: 'Permintaan' },
    { code: 'reports:export', label: 'Mengunduh Laporan Valuasi & Finansial', module: 'Governance' },
    { code: 'audit:read', label: 'Memeriksa Jejak Audit Trail Digital', module: 'Governance' },
    { code: 'settings:manage', label: 'Konfigurasi Sistem & Database Engine', module: 'Admin' },
  ];

  const roles: RoleType[] = [
    'SUPER_ADMIN',
    'WAREHOUSE_MANAGER',
    'INVENTORY_STAFF',
    'ASSET_CUSTODIAN',
    'AUDITOR',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Manajemen Pengguna & Matriks Hak Akses (RBAC)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Struktur otorisasi berbasis peran (Role-Based Access Control) yang diverifikasi di setiap endpoint API server
        </p>
      </div>

      {/* User Directory */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-indigo-500" />
          Direktori Pengguna Sistem
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map(u => (
            <div key={u.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center shrink-0">
                {u.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate block">{u.name}</span>
                <span className="text-[11px] text-slate-500 truncate block">{u.email}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                    {u.role.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">{u.department}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role-Permission Matrix */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              Matriks Izin Peran Sistem (Role-Permission Matrix)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pemetaan hak akses operasi data per peran pengguna
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 min-w-[240px]">Kemampuan & Izin Sistem</th>
                <th className="py-3 px-3 text-center min-w-[100px]">Super Admin</th>
                <th className="py-3 px-3 text-center min-w-[120px]">Warehouse Mgr</th>
                <th className="py-3 px-3 text-center min-w-[120px]">Inventory Staff</th>
                <th className="py-3 px-3 text-center min-w-[110px]">Asset Custodian</th>
                <th className="py-3 px-3 text-center min-w-[90px]">Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {capabilities.map((cap) => (
                <tr key={cap.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">{cap.label}</span>
                    <span className="font-mono text-[10px] text-slate-400">{cap.code} • {cap.module}</span>
                  </td>

                  {roles.map(r => {
                    const hasCap = r === 'SUPER_ADMIN' || (rolePermissions[r] && rolePermissions[r].includes(cap.code));
                    return (
                      <td key={r} className="py-2.5 px-3 text-center">
                        {hasCap ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center mx-auto">
                            <X className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
