import React from 'react';

interface GlowButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger' | 'warning' | 'secondary' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export const GlowButton: React.FC<GlowButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const variants: Record<string, string> = {
    primary: 'bg-cyber-accent/20 text-cyber-accent border-cyber-accent/50 hover:bg-cyber-accent/30 hover:shadow-glow-cyan',
    danger: 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30 hover:shadow-glow-red',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/30',
    secondary: 'bg-gray-700/50 text-gray-300 border-gray-600 hover:bg-gray-600/50',
    success: 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30 hover:shadow-glow-green',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`glow-btn font-medium rounded-lg border transition-all duration-300 flex items-center gap-2 ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {children}
    </button>
  );
};
