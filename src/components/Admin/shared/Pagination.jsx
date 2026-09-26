import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination Component
 *
 * @param {Object} props - Component props.
 * @param {number} props.page - Current page number.
 * @param {number} props.total - Total number of items.
 * @param {number} props.perPage - Items per page.
 * @param {function} props.onChange - Page change handler.
 * @returns {JSX.Element|null} Pagination component.
 */
export default function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  /**
   * Get visible page numbers with ellipsis logic.
   *
   * @returns {number[]} Array of page numbers to display.
   */
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  /**
   * Generate button styles based on state.
   *
   * @param {boolean} isActive - Whether this is the active page.
   * @param {string|boolean} isNav - Navigation button type.
   * @returns {Object} Style object.
   */
  const buttonStyle = (isActive = false, isNav = false) => ({
    minWidth: isNav ? '68px' : '36px',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid var(--adap-border)',
    background: isActive ? 'var(--adap-primary)' : '#fff',
    color: isActive ? '#fff' : 'var(--adap-slate-700)',
    fontWeight: isActive ? 800 : 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: isActive
      ? '0 4px 12px rgba(79, 70, 229, 0.25)'
      : '0 1px 2px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    opacity: isNav && page === (isNav === 'prev' ? 1 : totalPages) ? 0.5 : 1,
    pointerEvents: isNav && page === (isNav === 'prev' ? 1 : totalPages) ? 'none' : 'auto',
  });

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px clamp(12px, 3vw, 24px)',
        borderTop: '1px solid var(--adap-border)',
        background: 'var(--adap-slate-50)',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--adap-slate-500)' }}>
        Showing{' '}
        <strong style={{ color: 'var(--adap-slate-950)' }}>
          {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)}
        </strong>{' '}
        of <strong style={{ color: 'var(--adap-slate-950)' }}>{total}</strong>
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {/* Previous Button */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          style={buttonStyle(false, 'prev')}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} /> Prev
        </button>

        {/* First Page + Ellipsis */}
        {getPageNumbers()[0] > 1 && (
          <>
            <button onClick={() => onChange(1)} style={buttonStyle(1 === page)} aria-label="Page 1">
              1
            </button>
            {getPageNumbers()[0] > 2 && (
              <span style={{ color: 'var(--adap-slate-400)', fontWeight: 600, padding: '0 8px' }}>
                ...
              </span>
            )}
          </>
        )}

        {/* Page Numbers */}
        {getPageNumbers().map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={buttonStyle(p === page)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ))}

        {/* Last Page + Ellipsis */}
        {getPageNumbers()[getPageNumbers().length - 1] < totalPages && (
          <>
            {getPageNumbers()[getPageNumbers().length - 1] < totalPages - 1 && (
              <span style={{ color: 'var(--adap-slate-400)', fontWeight: 600, padding: '0 8px' }}>
                ...
              </span>
            )}
            <button
              onClick={() => onChange(totalPages)}
              style={buttonStyle(totalPages === page)}
              aria-label={`Page ${totalPages}`}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next Button */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          style={buttonStyle(false, 'next')}
          aria-label="Next page"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
