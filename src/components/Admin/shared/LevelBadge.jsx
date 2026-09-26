import React from 'react';

/**
 * Level Badge Component - Displays score level with color coding.
 *
 * @param {Object} props - Component props.
 * @param {string} props.level - Level key (beginner, intermediate, advanced).
 * @returns {JSX.Element} Badge component.
 */
export default function LevelBadge({ level }) {
  const configured = window.dapAdmin?.settings?.performanceColors || {};
  const redHex = configured.red || '#c02b12';
  const amberHex = configured.amber || '#e76424';
  const goldHex = configured.gold || '#edaf18';
  const greenHex = configured.green || '#069e7b';

  // Color mapping for different levels.
  const colors = {
    red: { bg: `${redHex}18`, text: redHex, border: `${redHex}40` },
    amber: { bg: `${amberHex}18`, text: amberHex, border: `${amberHex}40` },
    gold: { bg: `${goldHex}20`, text: '#B45309', border: `${goldHex}50` },
    green: { bg: `${greenHex}18`, text: greenHex, border: `${greenHex}40` },
    beginner: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
    developing: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
    intermediate: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
    proficient: { bg: `${goldHex}20`, text: '#B45309', border: `${goldHex}50` },
    advanced: { bg: '#D1FAE5', text: '#059669', border: '#A7F3D0' },
    expert: { bg: '#E0E7FF', text: '#4F46E5', border: '#C7D2FE' },
  };

  const levelLower = level?.toLowerCase() || 'unknown';
  const color = colors[levelLower] || { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };

  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '4px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
      }}
      role="status"
    >
      {level || 'Unknown'}
    </span>
  );
}
