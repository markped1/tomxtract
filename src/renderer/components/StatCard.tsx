import React, { useEffect, useRef, useState } from 'react';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  suffix?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color = 'cyan', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    if (start === end) return;

    const duration = 600;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(start + (end - start) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevValue.current = end;
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  const colorClasses: Record<string, { bg: string; text: string; glow: string }> = {
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', glow: 'shadow-glow-cyan' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', glow: 'shadow-glow-green' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', glow: '' },
    yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', glow: '' },
  };

  const c = colorClasses[color] || colorClasses.cyan;

  return (
    <div className={`bg-cyber-card rounded-xl border border-gray-700/50 p-5 hover:border-gray-600 transition-all duration-300 hover:${c.glow}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">{title}</p>
          <p className={`text-3xl font-bold ${c.text} counter-value font-mono`}>
            {displayValue.toLocaleString()}{suffix}
          </p>
        </div>
        <div className={`${c.bg} p-3 rounded-lg`}>
          <div className={c.text}>{icon}</div>
        </div>
      </div>
    </div>
  );
};
