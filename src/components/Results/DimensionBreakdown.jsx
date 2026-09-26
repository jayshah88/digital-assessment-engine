import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useContentStore } from '../../store/contentStore';

/**
 * Dimension Breakdown Component
 * Displays 12 dimensions with scores, progress bars, and interpretations
 * 
 * @param {Object} props
 * @param {Array} props.blocks - Array of dimension/block objects
 * @param {Object} props.blockScores - Scores per block { block_id: { raw, max, pct } }
 * @returns {JSX.Element}
 */
export default function DimensionBreakdown({ blocks, blockScores }) {
  const { getPerformanceColors } = useContentStore();
  const perfColors = getPerformanceColors();
  // Sort dimensions by score (lowest first) to show priority gaps
  const sortedDimensions = React.useMemo(() => {
    if (!blocks || !blockScores) return [];
    
    return blocks
      .map(block => {
        const scoreData = blockScores[block.id] || { raw: 0, max: 1, pct: 0 };
        const scoreRatio = scoreData.max > 0 ? scoreData.raw / scoreData.max : 0;
        
        return {
          id: block.id,
          title: block.title || `Dimension ${block.id}`,
          raw: scoreData.raw,
          max: scoreData.max,
          pct: scoreData.pct,
          scoreRatio,
          color: block.color || '#6366F1',
          // Priority gap: score 0-1 (less than ~17% of max)
          isPriorityGap: scoreRatio <= 0.17,
        };
      })
      .sort((a, b) => a.scoreRatio - b.scoreRatio);
  }, [blocks, blockScores]);

  // Get lowest 3 dimensions for highlighting
  const lowestDimensions = sortedDimensions.slice(0, 3);
  const lowestIds = new Set(lowestDimensions.map(d => d.id));

  if (sortedDimensions.length === 0) {
    return (
      <div className="dap-dim-breakdown__empty">
        <Info size={32} className="dap-dim-breakdown__empty-icon" />
        <p>No dimension data available</p>
      </div>
    );
  }

  return (
    <div className="dap-dim-breakdown">
      <h3 className="dap-dim-breakdown__header">
        <span className="dap-dim-breakdown__count">
          {sortedDimensions.length}
        </span>
        Dimension Breakdown
      </h3>

      {/* Priority Gaps Warning */}
      {sortedDimensions.some(d => d.isPriorityGap) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="dap-dim-breakdown__alert"
        >
          <AlertTriangle size={20} color={perfColors.red} className="dap-dim-breakdown__alert-icon" />
          <div>
            <p className="dap-dim-breakdown__alert-title">
              Priority Gaps Identified
            </p>
            <p className="dap-dim-breakdown__alert-text">
              Dimensions with scores of 0–1 represent critical gaps that should be addressed before engineering begins.
            </p>
          </div>
        </motion.div>
      )}

      {/* Lowest Dimensions Summary */}
      <div className="dap-dim-breakdown__lowest">
        <p className="dap-dim-breakdown__lowest-title">
          Lowest Scoring Dimensions (Focus Areas)
        </p>
        <div className="dap-dim-breakdown__lowest-list">
          {lowestDimensions.map((dim, index) => (
            <div 
              key={dim.id}
              className="dap-dim-breakdown__lowest-item"
            >
              <span 
                className="dap-dim-breakdown__lowest-rank"
                style={{
                  background: index === 0 ? perfColors.red : index === 1 ? perfColors.amber : perfColors.gold,
                  color: '#fff'
                }}
              >
                {index + 1}
              </span>
              <span className="dap-dim-breakdown__lowest-title-text">{dim.title}</span>
              <span className="dap-dim-breakdown__lowest-score">
                {Math.round(dim.raw)}/{Math.round(dim.max)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* All Dimensions Grid */}
      <div className="dap-dim-grid">
        {sortedDimensions.map((dim, index) => (
          <motion.div
            key={dim.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`dap-dim-card ${dim.isPriorityGap ? 'dap-dim-card--priority' : ''}`}
          >
            <div className="dap-dim-card__header">
              <h4 className="dap-dim-card__title">
                {dim.title}
              </h4>
              {dim.isPriorityGap && (
                <span className="dap-dim-card__badge">
                  Gap
                </span>
              )}
              {lowestIds.has(dim.id) && !dim.isPriorityGap && (
                <span className="dap-dim-card__badge dap-dim-card__badge--warning">
                  Low
                </span>
              )}
            </div>

            {/* Score Display */}
            <div className="dap-dim-card__score-row">
              <span className="dap-dim-card__score" style={{ color: dim.color }}>
                {Math.round(dim.raw)}
              </span>
              <span className="dap-dim-card__max">
                / {Math.round(dim.max)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="dap-dim-card__progress-bg">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dim.pct}%` }}
                transition={{ duration: 0.8, delay: index * 0.05 }}
                className="dap-dim-card__progress-fill"
                style={{ background: dim.isPriorityGap ? perfColors.red : dim.color }}
              />
            </div>

            {/* Interpretation for Priority Gaps */}
            {dim.isPriorityGap && (
              <p className="dap-dim-card__interpretation dap-dim-card__interpretation--critical">
                Critical gap — address before engineering begins to avoid costly rework.
              </p>
            )}

            {/* Checkmark for high performers */}
            {dim.pct >= 80 && (
              <div className="dap-dim-card__success">
                <CheckCircle size={14} color={perfColors.green} />
                <span className="dap-dim-card__success-text">
                  Strong performance
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
