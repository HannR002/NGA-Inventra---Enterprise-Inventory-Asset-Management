import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { RoleType } from '../types';
import { ShieldCheck, Lock, Mail, ArrowRight, Info } from 'lucide-react';

interface LoginDemoPageProps {
  onSuccess: () => void;
}

export const LoginDemoPage: React.FC<LoginDemoPageProps> = ({ onSuccess }) => {
  const { login, switchRole } = useAuth();
  const toast = useNotification();

  const [email, setEmail] = useState('admin@nga-inventra.com');
  const [password, setPassword] = useState('AdminSecurePass2026!');
  const [submitting, setSubmitting] = useState(false);

  const demoAccounts = [
    { role: 'SUPER_ADMIN' as RoleType, email: 'admin@nga-inventra.com', pass: 'AdminSecurePass2026!', label: 'Super Admin', desc: 'Akses penuh ke semua modul sistem' },
    { role: 'WAREHOUSE_MANAGER' as RoleType, email: 'manager@nga-inventra.com', pass: 'ManagerPass2026!', label: 'Warehouse Manager', desc: 'Approval mutasi & otorisasi transfer stok' },
    { role: 'INVENTORY_STAFF' as RoleType, email: 'staff@nga-inventra.com', pass: 'StaffPass2026!', label: 'Inventory Staff', desc: 'Input barang masuk (PO) & barang keluar' },
    { role: 'ASSET_CUSTODIAN' as RoleType, email: 'custodian@nga-inventra.com', pass: 'CustodianPass2026!', label: 'Asset Custodian', desc: 'Pengelolaan aset & serah terima serial' },
    { role: 'AUDITOR' as RoleType, email: 'auditor@nga-inventra.com', pass: 'AuditorPass2026!', label: 'Internal Auditor', desc: 'Read-only audit trail & laporan valuasi' },
  ];

  const handleSelectDemoAccount = async (acc: typeof demoAccounts[0]) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    try {
      setSubmitting(true);
      await login(acc.email, acc.pass);
      toast.success('Login Berhasil', `Masuk sebagai ${acc.label} (${acc.email})`);
      onSuccess();
    } catch (err: any) {
      toast.error('Login Gagal', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await login(email, password);
      toast.success('Login Berhasil', `Selamat datang kembali di NGA INVENTRA.`);
      onSuccess();
    } catch (err: any) {
      toast.error('Autentikasi Gagal', err.message || 'Email atau password salah.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Icon */}
        <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 items-center justify-center font-black text-lg text-white shadow-xl shadow-indigo-500/30 mb-4">
          NI
        </div>
        <h2 className="text-2xl font-black tracking-tight font-mono">
          NGA INVENTRA
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Enterprise Inventory & Serialized Asset Management Platform
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-slate-800/90 border border-slate-700/80 py-8 px-6 shadow-2xl rounded-3xl backdrop-blur space-y-6">
          {/* Demo Notice Banner */}
          <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-xs text-indigo-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Simulasi Akun Enterprise:</strong> Klik salah satu peran di bawah untuk login instan dengan kredensial terenkripsi (PBKDF2).
            </p>
          </div>

          {/* Quick Demo Role Buttons */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Pilih Profil Masuk:
            </span>
            <div className="grid grid-cols-1 gap-2">
              {demoAccounts.map(acc => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleSelectDemoAccount(acc)}
                  className="w-full text-left p-3 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-indigo-950/50 hover:border-indigo-500 transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-200 group-hover:text-indigo-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      {acc.label}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{acc.desc}</div>
                  </div>
                  <span className="text-[11px] text-indigo-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    Masuk ↵
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-700"></div>
            <span className="flex-shrink mx-4 text-[10px] uppercase font-bold text-slate-500">atau manual</span>
            <div className="flex-grow border-t border-slate-700"></div>
          </div>

          {/* Manual Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Email Perusahaan</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 hover:scale-101"
            >
              <span>{submitting ? 'Memverifikasi...' : 'Masuk ke Platform'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
