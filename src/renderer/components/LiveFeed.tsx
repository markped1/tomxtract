import React, { useRef, useEffect } from 'react';
import { ExtractionEvent } from '../types';

interface LiveFeedProps {
  events: ExtractionEvent[];
  maxHeight?: string;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ events, maxHeight = '300px' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  const getEventColor = (type: string) => {
    switch (type) {
      case 'email-found': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'proxy-switched': return 'text-yellow-400';
      case 'complete': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'email-found': return '✉';
      case 'error': return '✗';
      case 'proxy-switched': return '⟲';
      case 'page-scanned': return '◎';
      case 'crawling': return '⟳';
      case 'complete': return '✓';
      case 'started': return '▶';
      case 'paused': return '⏸';
      case 'stopped': return '⏹';
      default: return '•';
    }
  };

  return (
    <div className="bg-cyber-card rounded-xl border border-gray-700/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-gray-300">Live Extraction Feed</span>
        </div>
        <span className="text-xs text-gray-600 font-mono">{events.length} events</span>
      </div>
      <div
        ref={containerRef}
        className="overflow-y-auto p-3 space-y-1 console-text"
        style={{ maxHeight }}
      >
        {events.length === 0 ? (
          <div className="text-gray-600 text-center py-4">
            No activity yet. Start extraction to see live events.
          </div>
        ) : (
          events.map((event, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 py-1 ${getEventColor(event.type)} animate-fade-in`}
            >
              <span className="shrink-0 w-4 text-center">{getEventIcon(event.type)}</span>
              <span className="text-gray-600 shrink-0">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span className="break-all">{event.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
