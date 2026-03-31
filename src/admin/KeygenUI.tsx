import React, { useState, useEffect, useCallback } from 'react';
import { Key, Copy, Check, Shield, RefreshCw, Trash2, Ban, RotateCcw, Plus, Search, Clock, Zap } from 'lucide-react';
import { GlowButton } from '../renderer/components/GlowButton';

interface LicenseRow {
  key: string;
  status: 'available' | 'active' | 'revoked';
  machine_id: string | null;
  is_demo: boolean;
  duration_days: number;
  created_at: string;
  activated_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: 'text-green-400 bg-green-400/10 border-green-400/20',
  active: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  revoked: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function KeygenUI() {
  const [tab, setTab] = useState<'generate' | 'keys'>('generate');
  const [machineId, setMachineId] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState('');
  
  // Generation state
  const [batchCount, setBatchCount] = useState(10);
  const [isDemo, setIsDemo] = useState(false);
  const [durationDays, setDurationDays] = useState(7);
  
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
    const result = await api.syncKeys({ count: batchCount, isDemo, durationDays });
    if (result.success) {
      setSyncStatus(`${result.keys.length} keys synced to Supabase!`);
      setGeneratedKey(result.keys[0]);
      if (tab === 'keys') loadKeys();
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
    const matchStatus = statusFilter === 'all' || k.status === statusFilter || (statusFilter === 'demo' && k.is_demo);
    return matchSearch && matchStatus;
  });

  const stats = {
    total: keys.length,
    available: keys.filter(k => k.status === 'available').length,
    active: keys.filter(k => k.status === 'active').length,
    demo: keys.filter(k => k.is_demo).length,
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#e5e7eb] font-sans selection:bg-cyan-500/30 overflow-hidden flex flex-col">
      {/* Premium Header */}
      <div className="drag-region border-b border-white/5 bg-[#111827]/50 backdrop-blur-md px-6 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/10 w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
            <Shield className="w-6 h-6 text-cyan-400 glow-text" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter uppercase text-white glow-text">TomXtractor <span className="text-cyan-400">Admin</span></h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Secure License Server Online</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-1 bg-[#0b0f19] p-1 rounded-xl border border-white/5 no-drag">
          {(['generate', 'keys'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                tab === t 
                  ? 'bg-cyan-500 text-[#0b0f19] shadow-lg shadow-cyan-500/20' 
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Generate Tab */}
        {tab === 'generate' && (
          <div className="p-8 max-w-2xl mx-auto space-y-8 animate-slide-up">
            {/* License Type Selector */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setIsDemo(false)}
                className={`p-6 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-3 group ${
                  !isDemo 
                    ? 'bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/5' 
                    : 'bg-[#161b2c] border-white/5 hover:border-white/10'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${!isDemo ? 'bg-cyan-400 text-[#0b0f19]' : 'bg-gray-800 text-gray-500'}`}>
                  <Zap className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className={`text-xs font-black uppercase tracking-wider ${!isDemo ? 'text-white' : 'text-gray-500'}`}>Full License</h3>
                  <p className="text-[10px] text-gray-400 mt-1">Unlimited access, no expiration</p>
                </div>
              </button>

              <button 
                onClick={() => setIsDemo(true)}
                className={`p-6 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-3 group ${
                  isDemo 
                    ? 'bg-yellow-500/10 border-yellow-500/40 shadow-lg shadow-yellow-500/5' 
                    : 'bg-[#161b2c] border-white/5 hover:border-white/10'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isDemo ? 'bg-yellow-400 text-[#0b0f19]' : 'bg-gray-800 text-gray-500'}`}>
                  <Clock className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h3 className={`text-xs font-black uppercase tracking-wider ${isDemo ? 'text-white' : 'text-gray-500'}`}>Demo License</h3>
                  <p className="text-[10px] text-gray-400 mt-1">Limited time trial access</p>
                </div>
              </button>
            </div>

            {/* Config Panel */}
            <div className="bg-[#161b2c]/50 backdrop-blur-sm rounded-3xl border border-white/5 p-8 space-y-8 cyber-card">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">Configuration</h2>
                <div className="h-px flex-1 mx-6 bg-gradient-to-r from-cyan-500/50 to-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    <span>Batch Quantity</span>
                    <span className="text-cyan-400">{batchCount} Keys</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={batchCount}
                    onChange={e => setBatchCount(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                {isDemo && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-left-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-500 tracking-wider">
                      <span>Demo Duration</span>
                      <span className="text-yellow-400">{durationDays} Days</span>
                    </div>
                    <select
                        value={durationDays}
                        onChange={e => setDurationDays(Number(e.target.value))}
                        className="w-full bg-[#0b0f19] border border-white/10 rounded-xl py-2 px-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    >
                        <option value={1}>24 Hours (1 Day)</option>
                        <option value={3}>72 Hours (3 Days)</option>
                        <option value={7}>168 Hours (7 Days)</option>
                        <option value={14}>336 Hours (14 Days)</option>
                        <option value={30}>720 Hours (30 Days)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <GlowButton 
                  onClick={syncBatchKeys}
                  disabled={syncing}
                  variant={isDemo ? 'warning' : 'primary'}
                  className="w-full justify-center py-4 rounded-2xl"
                >
                  {syncing ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span className="font-black text-xs uppercase tracking-widest">Generate & Sync to Supabase</span>
                    </>
                  )}
                </GlowButton>
                {syncStatus && (
                  <div className={`mt-4 text-center text-[10px] font-black uppercase tracking-wider py-2 rounded-lg border ${
                    syncStatus.includes('Error') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'
                  }`}>
                    {syncStatus}
                  </div>
                )}
              </div>
            </div>

            {/* Key Preview */}
            {generatedKey && (
              <div className="bg-cyan-500/5 rounded-3xl border border-cyan-500/20 p-6 space-y-4 animate-slide-up">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-cyan-400 tracking-tighter">New Key Ready</span>
                  <span className="text-[8px] text-gray-500 font-mono">ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 bg-black/40 rounded-2xl py-5 px-6 font-mono text-2xl font-black tracking-[0.2em] text-white border border-white/5 text-center shadow-inner">
                    {generatedKey}
                  </div>
                  <button
                    onClick={() => copy(generatedKey, 'gen')}
                    className="bg-[#161b2c] hover:bg-[#1e253a] px-5 rounded-2xl border border-white/5 transition-all active:scale-95 group"
                  >
                    {copied === 'gen' ? (
                      <Check className="w-6 h-6 text-green-400" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Copy className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[7px] font-black text-gray-500">COPY</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keys Tab */}
        {tab === 'keys' && (
          <div className="p-8 space-y-6 animate-slide-up">
            {/* Advanced Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Database', value: stats.total, color: 'text-white', icon: Shield },
                { label: 'Available Keys', value: stats.available, color: 'text-green-400', icon: Zap },
                { label: 'Active Devices', value: stats.active, color: 'text-cyan-400', icon: Key },
                { label: 'Demo / Trials', value: stats.demo, color: 'text-yellow-400', icon: Clock },
              ].map(s => (
                <div key={s.label} className="bg-[#161b2c]/50 backdrop-blur-sm rounded-2xl border border-white/5 p-5 relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className={`text-3xl font-black ${s.color} tracking-tighter`}>{s.value}</div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">{s.label}</div>
                  </div>
                  <s.icon className={`absolute -right-4 -bottom-4 w-16 h-16 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity ${s.color}`} />
                </div>
              ))}
            </div>

            {/* Filter Hub */}
            <div className="flex gap-4 items-center">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="SEARCH KEYS OR HARDWARE IDS..."
                  className="w-full bg-[#161b2c] border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-[10px] font-black uppercase text-white tracking-widest focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all placeholder:text-gray-600"
                />
              </div>
              
              <div className="flex bg-[#161b2c] p-1 rounded-2xl border border-white/10">
                {['all', 'available', 'active', 'demo'].map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                      statusFilter === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <button
                onClick={loadKeys}
                disabled={loadingKeys}
                className="w-12 h-12 flex items-center justify-center bg-[#161b2c] border border-white/10 rounded-2xl hover:bg-white/5 transition-colors group"
              >
                <RefreshCw className={`w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors ${loadingKeys ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>

            {/* Table Core */}
            <div className="bg-[#161b2c]/30 backdrop-blur-sm rounded-3xl border border-white/10 overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] bg-black/20">
                      <th className="px-6 py-5">Security Key</th>
                      <th className="px-6 py-5">Type</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5">Machine Anchor</th>
                      <th className="px-6 py-5 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {loadingKeys ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-500/50" />
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-4">Consulting Supabase...</p>
                        </td>
                      </tr>
                    ) : filteredKeys.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">No matching records found</td>
                      </tr>
                    ) : (
                      filteredKeys.map(row => (
                        <tr key={row.key} className="group hover:bg-white/[0.03] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-black text-cyan-400 tracking-wider bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/20">{row.key}</span>
                              <button 
                                onClick={() => copy(row.key, row.key)} 
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-white/5 rounded-lg"
                              >
                                {copied === row.key ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-600 hover:text-white" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {row.is_demo ? (
                              <div className="flex items-center gap-2 text-yellow-500">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-tight">DEMO ({row.duration_days}D)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-cyan-500">
                                <Zap className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-tight">FULL</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${STATUS_COLORS[row.status]}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-[10px] text-gray-500 block max-w-[120px] truncate">
                              {row.machine_id || 'NOT REGISTERED'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {row.status !== 'revoked' ? (
                                <button
                                  onClick={() => handleRevoke(row.key)}
                                  disabled={actionLoading === row.key + '-revoke'}
                                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/5 text-gray-600 hover:text-red-400 hover:bg-red-500/20 transition-all border border-transparent hover:border-red-500/30 disabled:opacity-30"
                                >
                                  {actionLoading === row.key + '-revoke' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRestore(row.key)}
                                  disabled={actionLoading === row.key + '-restore'}
                                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-500/5 text-gray-600 hover:text-green-400 hover:bg-green-500/20 transition-all border border-transparent hover:border-green-500/30 disabled:opacity-30"
                                >
                                  {actionLoading === row.key + '-restore' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(row.key)}
                                disabled={actionLoading === row.key + '-delete'}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-gray-600 hover:text-white transition-all border border-transparent hover:border-white/20 disabled:opacity-30"
                              >
                                {actionLoading === row.key + '-delete' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
          </div>
        )}
      </div>
    </div>
  );
}
