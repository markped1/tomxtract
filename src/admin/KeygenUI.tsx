import React, { useState, useEffect, useCallback } from 'react';
import { Key, Copy, Check, Shield, RefreshCw, Trash2, Ban, RotateCcw, Plus, Search } from 'lucide-react';

interface LicenseRow {
  key: string;
  status: 'available' | 'active' | 'revoked';
  machine_id: string | null;
  created_at: string;
  activated_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'text-green-400 bg-green-400/10 border-green-400/20',
  active: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  revoked: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function KeygenUI() {
  const [tab, setTab] = useState<'generate' | 'keys'>('generate');
  const [machineId, setMachineId] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState('');
  const [batchCount, setBatchCount] = useState(5);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [keys, setKeys] = useState<LicenseRow[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const api = (window as any).electronAPI;

  useEffect(() => {
    api?.getMachineId?.().then(setMachineId);
  }, []);

  useEffect(() => {
    if (tab === 'keys') loadKeys();
  }, [tab]);

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    const result = await api.listKeys();
    if (result.success) setKeys(result.data);
    else setSyncStatus(`Error: ${result.message}`);
    setLoadingKeys(false);
  }, []);

  const generateLocalKey = async () => {
    if (!machineId.trim()) return;
    const key = await api.generateKey(machineId);
    setGeneratedKey(key);
  };

  const syncBatchKeys = async () => {
    setSyncing(true);
    setSyncStatus('Generating & syncing keys...');
    const result = await api.syncKeys(batchCount);
    if (result.success) {
      setSyncStatus(`${result.keys.length} keys synced to Supabase!`);
      setGeneratedKey(result.keys[0]);
    } else {
      setSyncStatus(`Error: ${result.message}`);
    }
    setSyncing(false);
    setTimeout(() => setSyncStatus(''), 5000);
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleRevoke = async (key: string) => {
    setActionLoading(key + '-revoke');
    await api.revokeKey(key);
    await loadKeys();
    setActionLoading(null);
  };

  const handleRestore = async (key: string) => {
    setActionLoading(key + '-restore');
    await api.restoreKey(key);
    await loadKeys();
    setActionLoading(null);
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Permanently delete key ${key}?`)) return;
    setActionLoading(key + '-delete');
    await api.deleteKey(key);
    await loadKeys();
    setActionLoading(null);
  };

  const filteredKeys = keys.filter(k => {
    const matchSearch = k.key.includes(search.toUpperCase()) || (k.machine_id || '').includes(search);
    const matchStatus = statusFilter === 'all' || k.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: keys.length,
    available: keys.filter(k => k.status === 'available').length,
    active: keys.filter(k => k.status === 'active').length,
    revoked: keys.filter(k => k.status === 'revoked').length,
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white font-sans">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
        <div className="bg-blue-500/20 w-9 h-9 rounded-xl flex items-center justify-center border border-blue-500/30">
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold">TomXtractor 49ja</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">License Admin</p>
        </div>
        <div className="ml-auto flex gap-2">
          {(['generate', 'keys'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t === 'keys' ? `Keys (${stats.total})` : t}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Tab */}
      {tab === 'generate' && (
        <div className="p-6 max-w-lg mx-auto space-y-6 mt-4">
          {/* Local key gen */}
          <div className="bg-[#161b2c] rounded-2xl border border-white/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">Generate for Machine ID</h2>
            <input
              type="text"
              value={machineId}
              onChange={e => setMachineId(e.target.value)}
              placeholder="Paste Machine ID..."
              className="w-full bg-[#0b0f19] border border-white/10 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <button
              onClick={generateLocalKey}
              disabled={!machineId.trim()}
              className="w-full bg-[#1e253a] hover:bg-[#252d45] disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4" /> Generate Local Key
            </button>
          </div>

          {/* Batch sync */}
          <div className="bg-[#161b2c] rounded-2xl border border-white/10 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">Batch Generate & Sync to Supabase</h2>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400 whitespace-nowrap">Key count:</label>
              <input
                type="number"
                min={1}
                max={100}
                value={batchCount}
                onChange={e => setBatchCount(Number(e.target.value))}
                className="w-24 bg-[#0b0f19] border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button
              onClick={syncBatchKeys}
              disabled={syncing}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate & Sync {batchCount} Keys
            </button>
            {syncStatus && (
              <p className={`text-center text-xs font-semibold ${syncStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {syncStatus}
              </p>
            )}
          </div>

          {/* Generated key display */}
          {generatedKey && (
            <div className="bg-[#161b2c] rounded-2xl border border-blue-500/30 p-4">
              <label className="text-xs text-gray-400 uppercase tracking-wider">Generated Key</label>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-[#0b0f19] rounded-xl py-3 px-4 font-mono text-lg tracking-widest text-blue-400 text-center">
                  {generatedKey}
                </div>
                <button
                  onClick={() => copy(generatedKey, 'gen')}
                  className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 transition-colors"
                >
                  {copied === 'gen' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keys Tab */}
      {tab === 'keys' && (
        <div className="p-6 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-white' },
              { label: 'Available', value: stats.available, color: 'text-green-400' },
              { label: 'Active', value: stats.active, color: 'text-blue-400' },
              { label: 'Revoked', value: stats.revoked, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-[#161b2c] rounded-xl border border-white/10 p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search key or machine ID..."
                className="w-full bg-[#161b2c] border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#161b2c] border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </select>
            <button
              onClick={loadKeys}
              disabled={loadingKeys}
              className="bg-[#161b2c] border border-white/10 rounded-xl px-3 hover:bg-white/5 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loadingKeys ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table */}
          <div className="bg-[#161b2c] rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Key</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Machine ID</th>
                  <th className="text-left px-4 py-3">Activated</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingKeys ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading keys...
                    </td>
                  </tr>
                ) : filteredKeys.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">No keys found</td>
                  </tr>
                ) : (
                  filteredKeys.map(row => (
                    <tr key={row.key} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-blue-300">{row.key}</span>
                          <button onClick={() => copy(row.key, row.key)} className="opacity-0 group-hover:opacity-100 hover:opacity-100">
                            {copied === row.key ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500 hover:text-gray-300" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[row.status]}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[180px] truncate">
                        {row.machine_id || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {row.activated_at ? new Date(row.activated_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {row.status !== 'revoked' ? (
                            <button
                              onClick={() => handleRevoke(row.key)}
                              disabled={actionLoading === row.key + '-revoke'}
                              title="Revoke key"
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                            >
                              {actionLoading === row.key + '-revoke'
                                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                : <Ban className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(row.key)}
                              disabled={actionLoading === row.key + '-restore'}
                              title="Restore key"
                              className="p-1.5 rounded-lg hover:bg-green-500/10 text-gray-500 hover:text-green-400 transition-colors disabled:opacity-40"
                            >
                              {actionLoading === row.key + '-restore'
                                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                : <RotateCcw className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(row.key)}
                            disabled={actionLoading === row.key + '-delete'}
                            title="Delete permanently"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                          >
                            {actionLoading === row.key + '-delete'
                              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
