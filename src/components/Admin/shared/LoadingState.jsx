import React from 'react';

/**
 * Loading State Component
 *
 * @returns {JSX.Element} Loading spinner with text.
 */
export default function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 0',
        gap: '24px',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: '4px solid var(--adap-slate-200)',
          borderTopColor: 'var(--adap-primary)',
          borderRadius: '50%',
          animation: 'adapSpin 1s linear infinite',
        }}
        aria-hidden="true"
      />
      <span
        style={{
          color: 'var(--adap-slate-400)',
          fontSize: '0.9rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
        }}
      >
        Loading…
      </span>
      <style>{`@keyframes adapSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
