import React, { useState, useEffect, useCallback } from 'react';
import { GlowButton } from '../components/GlowButton';
import { LiveFeed } from '../components/LiveFeed';
import { DataTable } from '../components/DataTable';
import { ExtractionConfig, ExtractionEvent, EmailRecord } from '../types';

export const Extract: React.FC = () => {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [config, setConfig] = useState<ExtractionConfig>({
    keywords: [],
    threads: 3,
    depth: 5,
    timeout: 30,
    proxyMode: 'rotating',
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [events, setEvents] = useState<ExtractionEvent[]>([]);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [showMoreKeywords, setShowMoreKeywords] = useState(false);

  useEffect(() => {
    // Delay loading heavy data to prioritize input responsiveness
    const timer = setTimeout(() => {
        loadEmails();
        checkRunningStatus();
    }, 500);

    const checkRunningStatus = async () => {
      if (window.electronAPI) {
        const stats = await window.electronAPI.getStats();
        if (stats.activeJobs > 0) setIsRunning(true);
      }
    };

    let cleanup: (() => void) | undefined;
    if (window.electronAPI) {
      cleanup = window.electronAPI.onExtractionEvent((_event, data) => {
        setEvents((prev) => [...prev.slice(-200), data]); // Limit to 200 events for performance
        if (data.type === 'email-found' && data.data) {
          setEmails((prev) => [...prev, data.data]);
        }
        if (data.type === 'complete' || data.type === 'stopped') {
          setIsRunning(false);
          setIsPaused(false);
        }
      });
    }
    return () => {
        clearTimeout(timer);
        cleanup?.();
    };
  }, []);

  const loadEmails = async () => {
    try {
      if (window.electronAPI) {
        const e = await window.electronAPI.getEmails();
        setEmails(e);
      }
    } catch (err) {}
  };

  const addKeyword = () => {
    const lines = newKeyword.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 0) {
      const uniqueNewKeys = lines.filter(k => !keywords.includes(k));
      setKeywords([...keywords, ...uniqueNewKeys]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const importKeywords = async () => {
    try {
      if (window.electronAPI) {
        const filePath = await window.electronAPI.openFileDialog();
        if (filePath) {
          // File reading handled by main process
        }
      }
    } catch (err) {}
  };

  const startExtraction = async () => {
    if (keywords.length === 0) return;
    try {
      setIsRunning(true);
      setEvents([]);
      const extractionConfig = { ...config, keywords };
      if (window.electronAPI) {
        await window.electronAPI.startExtraction(extractionConfig);
      }
    } catch (err) {
      setIsRunning(false);
    }
  };

  const pauseExtraction = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.pauseExtraction();
        setIsPaused(!isPaused);
      }
    } catch (err) {}
  };

  const stopExtraction = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.stopExtraction();
        setIsRunning(false);
        setIsPaused(false);
      }
    } catch (err) {}
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Extraction Engine</h1>
        <p className="text-sm text-gray-500 mt-1">Configure and run email extraction jobs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Controls */}
        <div className="space-y-4">
          {/* Keyword Input */}
          <div className="bg-cyber-card rounded-xl border border-gray-700/50 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyber-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
              Keywords / Targets
            </h3>

            <div className="space-y-3 mb-3">
              <textarea
                rows={4}
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Paste keywords / domains (one per line)..."
                className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-xs text-cyber-text placeholder-gray-600 focus:outline-none focus:border-cyber-accent/50 custom-scrollbar"
              />
              <GlowButton onClick={addKeyword} className="w-full justify-center py-2">
                Add {newKeyword.split('\n').filter(k => k.trim()).length || 1} Keyword(s)
              </GlowButton>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={importKeywords} className="text-xs text-gray-500 hover:text-cyber-accent transition-colors">
                Import from file
              </button>
              <button onClick={() => setKeywords([])} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                Clear all
              </button>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
              {keywords.length === 0 ? (
                <div className="text-xs text-gray-600 py-4 text-center">
                  <p>Add keywords to extract emails.</p>
                  <p className="mt-1 text-gray-700">Examples:</p>
                  <button onClick={() => setKeywords(['restaurants in lagos'])} className="text-cyber-accent/60 hover:text-cyber-accent text-xs mt-1">restaurants in lagos</button>
                  <br />
                  <button onClick={() => setKeywords((p) => [...p, 'construction companies dubai'])} className="text-cyber-accent/60 hover:text-cyber-accent text-xs">construction companies dubai</button>
                  <br />
                  <button onClick={() => setKeywords((p) => [...p, 'digital agencies usa'])} className="text-cyber-accent/60 hover:text-cyber-accent text-xs">digital agencies usa</button>
                </div>
              ) : (
                <>
                  {keywords.slice(0, showMoreKeywords ? undefined : 20).map((kw, i) => (
                    <div key={i} className="flex items-center justify-between bg-cyber-bg rounded-lg px-3 py-1.5 group">
                      <span className="text-xs text-gray-300 font-mono truncate mr-2">{kw}</span>
                      <button
                        onClick={() => removeKeyword(kw)}
                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <line x1="6" y1="6" x2="18" y2="18" />
                          <line x1="6" y1="18" x2="18" y2="6" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {keywords.length > 20 && (
                    <button 
                        onClick={() => setShowMoreKeywords(!showMoreKeywords)}
                        className="w-full text-[10px] text-cyber-accent hover:text-cyber-accent/80 py-2 transition-colors uppercase font-bold tracking-widest"
                    >
                        {showMoreKeywords ? '↑ Show Less' : `↓ Show All (${keywords.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Extraction Config */}
          <div className="bg-cyber-card rounded-xl border border-gray-700/50 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyber-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Extraction Settings
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Threads</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.threads}
                  onChange={(e) => setConfig({ ...config, threads: parseInt(e.target.value) || 1 })}
                  className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text focus:outline-none focus:border-cyber-accent/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Search Depth (pages per keyword)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={config.depth}
                  onChange={(e) => setConfig({ ...config, depth: parseInt(e.target.value) || 1 })}
                  className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text focus:outline-none focus:border-cyber-accent/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Timeout (seconds)</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={config.timeout}
                  onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 30 })}
                  className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text focus:outline-none focus:border-cyber-accent/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Proxy Mode</label>
                <select
                  value={config.proxyMode}
                  onChange={(e) => setConfig({ ...config, proxyMode: e.target.value as 'none' | 'rotating' })}
                  className="w-full bg-cyber-bg border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text focus:outline-none focus:border-cyber-accent/50"
                >
                  <option value="none">None</option>
                  <option value="rotating">Rotating</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 mt-4">
              <div className="flex gap-2">
                <GlowButton
                  onClick={startExtraction}
                  disabled={isRunning || keywords.length === 0}
                  variant="primary"
                  className="flex-1 justify-center animate-pulse-glow h-12"
                >
                  {isRunning ? '⟳ Engine Running...' : '▶ Start Extraction'}
                </GlowButton>
                <GlowButton
                  onClick={pauseExtraction}
                  disabled={!isRunning}
                  variant="warning"
                  className="w-12 flex justify-center items-center h-12"
                >
                  {isPaused ? '▶' : '⏸'}
                </GlowButton>
              </div>
              
              <GlowButton
                onClick={stopExtraction}
                disabled={!isRunning}
                variant="danger"
                className="w-full justify-center h-12 font-bold flex items-center gap-2 border-2 border-red-500/50 hover:bg-red-500/20"
              >
                <div className="w-4 h-4 rounded bg-white/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white" />
                </div>
                {isRunning ? '🛑 STOP EXTRACTION NOW' : 'Stop Engine'}
              </GlowButton>
            </div>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="lg:col-span-2 space-y-4">
          <LiveFeed events={events} maxHeight="250px" />
          <DataTable emails={emails} />
        </div>
      </div>
    </div>
  );
};
