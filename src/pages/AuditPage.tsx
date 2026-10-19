import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { api } from '../services/api';
import { History, Shield, Search, Eye } from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadAudit();
  }, []);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs(100);
      setLogs(res.auditLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity.toLowerCase().includes(search.toLowerCase()) ||
    (l.userName && l.userName.toLowerCase().includes(search.toLowerCase())) ||
    (l.entityId && l.entityId.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" />
          Jejak Audit Digital (Enterprise Audit Trail)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Catatan kronologis immutable untuk seluruh perubahan data, mutasi stok, dan otorisasi dokumen
        </p>
      </div>

      {/* Logs Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aksi, entitas, atau nama operator..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-400">{filteredLogs.length} rekaman audit</span>
        </div>

        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Waktu (Timestamp)</th>
                <th className="py-2.5 px-3">Tindakan (Action)</th>
                <th className="py-2.5 px-3">Entitas & ID</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3 text-right">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                    {new Date(l.createdAt).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{l.entity}</span>
                    {l.entityId && (
                      <span className="text-[10px] font-mono text-slate-400 ml-1.5">({l.entityId})</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                    {l.userName || 'System'}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                    {l.ipAddress || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setSelectedLog(l)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail JSON Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Rincian Payload Audit Log"
        subtitle={`ID: ${selectedLog?.id}`}
        maxWidth="md"
      >
        {selectedLog && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
              <div>Aksi: <strong className="text-slate-900 dark:text-slate-100">{selectedLog.action}</strong></div>
              <div>Entitas: <strong className="text-slate-900 dark:text-slate-100">{selectedLog.entity}</strong></div>
              <div>Pengguna: <strong className="text-slate-900 dark:text-slate-100">{selectedLog.userName}</strong></div>
              <div>Waktu: <strong className="text-slate-900 dark:text-slate-100">{new Date(selectedLog.createdAt).toLocaleString('id-ID')}</strong></div>
            </div>

            <div>
              <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Payload JSON:</span>
              <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
                {JSON.stringify(selectedLog.detailsJson, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
