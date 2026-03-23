import React, { useState, useMemo } from 'react';
import { EmailRecord } from '../types';

interface DataTableProps {
  emails: EmailRecord[];
  onDelete?: (id: number) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ emails, onDelete }) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof EmailRecord>('foundAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  const filtered = useMemo(() => {
    let data = [...emails];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (e) =>
          e.email.toLowerCase().includes(q) ||
          e.domain.toLowerCase().includes(q) ||
          (e.sourcePage || '').toLowerCase().includes(q) ||
          (e.phone || '').toLowerCase().includes(q) ||
          (e.name || '').toLowerCase().includes(q)
      );
    }
    data.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
    return data;
  }, [emails, search, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page]);

  const handleSort = (field: keyof EmailRecord) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1); // Reset to first page on sort
  };

  const SortIcon = ({ field }: { field: keyof EmailRecord }) => (
    <span className="ml-1 text-gray-600">
      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div className="bg-cyber-card rounded-xl border border-gray-700/50 overflow-hidden">
      {/* Search bar */}
      <div className="p-4 border-b border-gray-700/50 flex items-center justify-between gap-3">
        <div className="flex-1 relative max-w-md">
          <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search emails, domains..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-cyber-bg border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-cyber-text placeholder-gray-600 focus:outline-none focus:border-cyber-accent/50"
          />
        </div>
        
        <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 font-mono">{filtered.length} total</span>
            {totalPages > 1 && (
                <div className="flex items-center gap-1 bg-cyber-bg rounded-lg border border-gray-700 p-1">
                    <button 
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="p-1 text-gray-500 hover:text-cyber-accent disabled:opacity-30"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="text-[10px] text-gray-400 font-mono px-2">Page {page} / {totalPages}</span>
                    <button 
                        disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="p-1 text-gray-500 hover:text-cyber-accent disabled:opacity-30"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
        <table className="data-table w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 sticky top-0 bg-cyber-card z-10 shadow-md">
              <th className="px-4 py-3 cursor-pointer hover:text-gray-300" onClick={() => handleSort('email')}>
                Email Address <SortIcon field="email" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-gray-300" onClick={() => handleSort('domain')}>
                Domain <SortIcon field="domain" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-gray-300" onClick={() => handleSort('sourcePage')}>
                Source Page <SortIcon field="sourcePage" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-gray-300" onClick={() => handleSort('phone')}>
                Phone <SortIcon field="phone" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-gray-300" onClick={() => handleSort('name')}>
                Name <SortIcon field="name" />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-gray-300" onClick={() => handleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th className="px-4 py-3 w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                  No emails found matching your search.
                </td>
              </tr>
            ) : (
              paginatedData.map((email) => (
                <tr key={email.id} className="hover:bg-cyber-accent/5 transition-colors">
                  <td className="px-4 py-3 text-cyber-accent font-mono text-xs">{email.email}</td>
                  <td className="px-4 py-3 text-gray-400">{email.domain}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[150px]" title={email.sourcePage}>{email.sourcePage}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{email.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{email.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      email.status === 'verified' || email.status === 'Active' ? 'bg-green-500/10 text-green-400' :
                      email.status === 'invalid' || email.status === 'Rejected' ? 'bg-red-500/10 text-red-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        email.status === 'verified' || email.status === 'Active' ? 'bg-green-400' :
                        email.status === 'invalid' || email.status === 'Rejected' ? 'bg-red-400' :
                        'bg-gray-400'
                      }`} />
                      {email.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onDelete?.(email.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
