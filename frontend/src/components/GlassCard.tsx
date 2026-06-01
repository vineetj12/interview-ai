import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hoverGlow?: boolean;
}

export default function GlassCard({ children, className = '', style = {}, onClick, hoverGlow = false }: Props) {
  const hoverClass = onClick ? 'clickable-glass-card' : '';
  const glowClass = hoverGlow ? 'glow-glass-card' : '';

  return (
    <div
      onClick={onClick}
      className={`glass-module ${hoverClass} ${glowClass} ${className}`}
      style={{
        padding: '24px',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderTopColor: 'rgba(255, 255, 255, 0.15)',
        borderLeftColor: 'rgba(255, 255, 255, 0.15)',
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        ...style
      }}
    >
      {children}
    </div>
  );
}
