import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'stock' | 'movement' | 'asset' | 'condition' | 'general';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'general', size = 'sm' }) => {
  let label = status;
  let color = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  const s = status.toUpperCase();

  if (type === 'stock') {
    if (s === 'IN_STOCK' || s === 'NORMAL') {
      label = 'Tersedia';
      color = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
    } else if (s === 'LOW' || s === 'LOW_STOCK') {
      label = 'Stok Rendah';
      color = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
    } else if (s === 'OUT' || s === 'OUT_OF_STOCK' || s === 'CRITICAL') {
      label = 'Stok Habis / Kritis';
      color = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
    }
  } else if (type === 'movement') {
    if (s === 'COMPLETED' || s === 'APPROVED') {
      label = s === 'COMPLETED' ? 'Selesai' : 'Disetujui';
      color = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
    } else if (s === 'PENDING' || s === 'SUBMITTED' || s === 'IN_PROGRESS') {
      label = s === 'IN_PROGRESS' ? 'Berjalan' : 'Menunggu Approval';
      color = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
    } else if (s === 'DRAFT') {
      label = 'Draf';
      color = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    } else if (s === 'REJECTED' || s === 'CANCELLED') {
      label = s === 'REJECTED' ? 'Ditolak' : 'Dibatalkan';
      color = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
    }
  } else if (type === 'asset') {
    if (s === 'AVAILABLE') {
      label = 'Tersedia di Gudang';
      color = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
    } else if (s === 'ASSIGNED') {
      label = 'Digunakan (Assigned)';
      color = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800';
    } else if (s === 'IN_MAINTENANCE') {
      label = 'Maintenance / Servis';
      color = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
    } else if (s === 'DISPOSED' || s === 'LOST') {
      label = s === 'DISPOSED' ? 'Dihapusbukukan' : 'Hilang';
      color = 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  } else if (type === 'condition') {
    if (s === 'NEW' || s === 'EXCELLENT') {
      label = s === 'NEW' ? 'Baru' : 'Sangat Baik';
      color = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
    } else if (s === 'GOOD') {
      label = 'Baik';
      color = 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800';
    } else if (s === 'FAIR') {
      label = 'Cukup / Usang';
      color = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
    } else if (s === 'DAMAGED') {
      label = 'Rusak';
      color = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
    }
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${padding} ${color}`}>
      {label}
    </span>
  );
};
