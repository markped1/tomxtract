import React, { useState } from 'react';
import { Key, Copy, Check, Shield } from 'lucide-react';

const ENC_KEY = 'TX49JA-ENCRYPTION-KEY-2024-SECURE';
const LICENSE_SECRET = 'TX49JA-LICENSE-SECRET';

export default function KeygenUI() {
  const [machineId, setMachineId] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);

  const generateKey = () => {
    if (!machineId.trim()) return;

    // We need to use crypto here. Since this runs in the renderer, 
    // we'll use the window.api if available or a web-safe version.
    // For now, let's assume we'll use IPC to generate it securely in the main process
    // or use a pre-shared logic if we can.
    window.electronAPI.generateKey(machineId).then((key: string) => {
      setLicenseKey(key);
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

          <button
            onClick={generateKey}
            disabled={!machineId.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group"
          >
            <Key className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Generate License Key
          </button>

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
