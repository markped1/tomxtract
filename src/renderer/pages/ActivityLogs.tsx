import React, { useState, useEffect } from 'react';
import { ConsoleLog } from '../components/ConsoleLog';
import { LogRecord } from '../types';

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadLogs();
    const iv = setInterval(loadLogs, 5000);
    return () => clearInterval(iv);
  }, []);

  const loadLogs = async () => {
    try {
      if (window.electronAPI) setLogs(await window.electronAPI.getLogs());
    } catch {}
  };

  const filtered = logs.filter((l) => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Activity Logs</h1>
        <p className="text-sm text-gray-500 mt-1">System events and crawler history</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-cyber-card rounded-lg p-1 border border-gray-700/50">
          {['all','info','success','warning','error'].map((lv) => (
            <button key={lv} onClick={() => setFilter(lv)}
              className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-all ${filter === lv ? 'bg-cyber-accent/20 text-cyber-accent' : 'text-gray-500 hover:text-gray-300'}`}>
              {lv}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search logs..." className="flex-1 bg-cyber-card border border-gray-700 rounded-lg px-3 py-2 text-sm text-cyber-text placeholder-gray-600 focus:outline-none focus:border-cyber-accent/50" />
        <span className="text-xs text-gray-600 font-mono">{filtered.length} entries</span>
      </div>
      <ConsoleLog logs={filtered} maxHeight="600px" />
    </div>
  );
};
