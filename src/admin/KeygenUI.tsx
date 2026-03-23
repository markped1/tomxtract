import React, { useState, useEffect } from 'react';
import { Key, Copy, Check, Shield, Cloud, RefreshCw } from 'lucide-react';

export default function KeygenUI() {
  const [machineId, setMachineId] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.getMachineId) {
      api.getMachineId().then(setMachineId);
    }
  }, []);

  const generateKey = () => {
    if (!machineId.trim()) return;

    (window as any).electronAPI.generateKey(machineId).then((key: string) => {
      setLicenseKey(key);
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}-${segment()}`;
  };

  const syncNewKeys = async () => {
    setSyncing(true);
    setSyncStatus('Generating keys...');
    
    // Generate 5 random keys for this batch
    const newKeys = Array.from({ length: 5 }, generateRandomKey);
    
    try {
      const result = await (window as any).electronAPI.syncKeys(newKeys);
      if (result.success) {
        setSyncStatus('Keys synced to Firebase!');
        setLicenseKey(newKeys[0]); // Show the first one
      } else {
        setSyncStatus(`Error: ${result.message}`);
      }
    } catch (err) {
      setSyncStatus('Failed to connect to Firebase.');
    }
    
    setSyncing(false);
    setTimeout(() => setSyncStatus(''), 5000);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#161b2c] rounded-2xl border border-white/10 shadow-2xl p-8 space-y-8 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[80px]" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-[80px]" />

        <div className="text-center space-y-2 relative">
          <div className="bg-blue-500/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TomXtractor 49ja</h1>
          <p className="text-gray-400 text-sm">License Key Generator</p>
        </div>

        <div className="space-y-6 relative">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Machine ID</label>
            <div className="relative group">
              <input
                type="text"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                placeholder="Paste Machine ID here..."
                className="w-full bg-[#0b0f19] border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm group-hover:border-white/20"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={generateKey}
              disabled={!machineId.trim()}
              className="flex-1 bg-[#1e253a] hover:bg-[#252d45] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2 group"
              title="Generate for specific Machine ID"
            >
              <Key className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Local
            </button>

            <button
              onClick={syncNewKeys}
              disabled={syncing}
              className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group"
              title="Generate & Sync 5 keys to Firebase"
            >
              {syncing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Cloud className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              )}
              Generate & Sync
            </button>
          </div>

          {syncStatus && (
            <p className={`text-center text-xs font-semibold ${syncStatus.includes('Error') || syncStatus.includes('Failed') ? 'text-red-400' : 'text-blue-400'} animate-pulse`}>
              {syncStatus}
            </p>
          )}

          {licenseKey && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">License Key</label>
              <div className="relative group">
                <div className="w-full bg-[#0b0f19] border border-blue-500/30 rounded-xl py-4 px-4 text-center font-mono text-xl tracking-widest text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                  {licenseKey}
                </div>
                <button
                  onClick={copyToClipboard}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors border border-white/5"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-400" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">Authorized Personnel Only</p>
        </div>
      </div>
    </div>
  );
}
