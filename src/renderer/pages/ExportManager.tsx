import React, { useState, useEffect } from 'react';
import { GlowButton } from '../components/GlowButton';
import { EmailRecord } from '../types';

export const ExportManager: React.FC = () => {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [format, setFormat] = useState<'csv' | 'txt' | 'xlsx'>('csv');
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState({
    email: true,
    domain: true,
    sourcePage: true,
    phone: true,
    name: true,
    status: true,
    foundAt: true,
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      if (window.electronAPI) {
        const e = await window.electronAPI.getEmails();
        setEmails(e);
      }
    } catch (err) {}
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const columns = Object.entries(selectedColumns)
        .filter(([, enabled]) => enabled)
        .map(([col]) => col);

      if (window.electronAPI) {
        const result = await window.electronAPI.exportData(format, {
          columns,
          removeDuplicates,
          format,
        });
        if (result) {
          alert(`Exported successfully to: ${result}`);
        }
      }
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
    setExporting(false);
  };

  const toggleColumn = (col: keyof typeof selectedColumns) => {
    setSelectedColumns((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  const uniqueCount = new Set(emails.map((e) => e.email.toLowerCase())).size;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-cyber-text">Export Manager</h1>
        <p className="text-sm text-gray-500 mt-1">Export extracted email data in multiple formats</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Settings */}
        <div className="space-y-4">
          <div className="bg-cyber-card rounded-xl border border-gray-700/50 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Export Format</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['csv', 'txt', 'xlsx'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`py-3 rounded-lg text-sm font-medium uppercase transition-all ${
                    format === f
                      ? 'bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/50 shadow-glow-cyan'
                      : 'bg-cyber-bg text-gray-400 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-cyber-card rounded-xl border border-gray-700/50 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Select Columns</h3>
            <div className="space-y-2">
              {(Object.keys(selectedColumns) as (keyof typeof selectedColumns)[]).map((col) => (
                <label key={col} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedColumns[col]}
                    onChange={() => toggleColumn(col)}
                    className="w-4 h-4 rounded border-gray-600 bg-cyber-bg text-cyber-accent focus:ring-cyber-accent/50"
                  />
                  <span className="text-sm text-gray-400 group-hover:text-cyber-text capitalize">
                    {col.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-cyber-card rounded-xl border border-gray-700/50 p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={removeDuplicates}
                onChange={(e) => setRemoveDuplicates(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-cyber-bg text-cyber-accent focus:ring-cyber-accent/50"
              />
              <div>
                <span className="text-sm text-gray-300">Remove Duplicates</span>
                <p className="text-xs text-gray-600 mt-0.5">
                  {emails.length} total emails, {uniqueCount} unique
                </p>
              </div>
            </label>
          </div>

          <GlowButton onClick={handleExport} disabled={exporting || emails.length === 0} className="w-full justify-center">
            {exporting ? 'Exporting...' : `Export ${removeDuplicates ? uniqueCount : emails.length} Emails as ${format.toUpperCase()}`}
          </GlowButton>
        </div>

        {/* Preview */}
        <div className="bg-cyber-card rounded-xl border border-gray-700/50 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Preview (first 10)</h3>
          <div className="overflow-x-auto">
            <table className="data-table w-full text-xs">
              <thead>
                <tr className="text-left uppercase tracking-wider text-gray-500">
                  {selectedColumns.email && <th className="px-3 py-2">Email</th>}
                  {selectedColumns.domain && <th className="px-3 py-2">Domain</th>}
                  {selectedColumns.sourcePage && <th className="px-3 py-2">Source</th>}
                  {selectedColumns.phone && <th className="px-3 py-2">Phone</th>}
                  {selectedColumns.name && <th className="px-3 py-2">Name</th>}
                  {selectedColumns.status && <th className="px-3 py-2">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {emails.slice(0, 10).map((email) => (
                  <tr key={email.id} className="hover:bg-cyber-accent/5">
                    {selectedColumns.email && <td className="px-3 py-2 text-cyber-accent font-mono">{email.email}</td>}
                    {selectedColumns.domain && <td className="px-3 py-2 text-gray-400">{email.domain}</td>}
                    {selectedColumns.sourcePage && <td className="px-3 py-2 text-gray-500 truncate max-w-[150px]">{email.sourcePage}</td>}
                    {selectedColumns.phone && <td className="px-3 py-2 text-gray-400">{email.phone || '—'}</td>}
                    {selectedColumns.name && <td className="px-3 py-2 text-gray-400">{email.name || '—'}</td>}
                    {selectedColumns.status && <td className="px-3 py-2 text-gray-400">{email.status}</td>}
                  </tr>
                ))}
                {emails.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-600">No data to export</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
