import React, { useRef, useEffect } from 'react';
import { LogRecord } from '../types';

interface ConsoleLogProps {
  logs: LogRecord[];
  maxHeight?: string;
}

export const ConsoleLog: React.FC<ConsoleLogProps> = ({ logs, maxHeight = '200px' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const levelColors: Record<string, string> = {
    info: 'text-gray-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  const levelPrefixes: Record<string, string> = {
    info: '[INFO]',
    success: '[OK]',
    warning: '[WARN]',
    error: '[ERR]',
  };

  return (
    <div className="bg-[#0a0e17] rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 border-b border-gray-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-gray-500 font-mono ml-2">System Console</span>
      </div>
      <div
        ref={containerRef}
        className="overflow-y-auto p-3 console-text"
        style={{ maxHeight }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-600">
            <span className="text-cyber-accent">$</span> Awaiting engine start...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2 py-0.5 animate-fade-in">
              <span className="text-gray-600 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`shrink-0 ${levelColors[log.level]}`}>
                {levelPrefixes[log.level]}
              </span>
              <span className={levelColors[log.level]}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
