import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, TrendingUp, Award } from 'lucide-react';
import { useContentStore } from '@store/contentStore';

/**
 * Circular Score Ring Component
 */
function ScoreRing({ score, max, percentage, color = '#4F46E5', size = 140, isPdf = false }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="dap-score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="dap-score-ring__svg">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={isPdf ? { strokeDashoffset } : { strokeDashoffset: circumference }}
          animate={isPdf ? { strokeDashoffset } : undefined}
          whileInView={isPdf ? undefined : { strokeDashoffset }}
          viewport={isPdf ? undefined : { once: true }}
          transition={{ duration: isPdf ? 0 : 1.5, ease: 'easeOut' }}
        />
      </svg>
      {/* Center content */}
      <div className="dap-score-ring__center">
        <div className="dap-score-ring__score">
          {Math.round(score)}<span className="dap-score-ring__max">/{max}</span>
        </div>
        <div className="dap-score-ring__percent" style={{ color: color }}>
          {percentage}%
        </div>
      </div>
    </div>
  );
}

/**
 * Band-Specific Result Component with Score Breakdown
 * Displays score metrics and different copy based on RED/AMBER/GREEN/GOLD band
 * 
 * @param {Object} props
 * @param {Object} props.result - Full result object with score, level, block_scores
 * @param {Array} props.blocks - Array of dimension blocks
 * @param {Function} props.onCTAClick - Handler for CTA button click
 * @returns {JSX.Element}
 */
export default function BandSpecificResult({ result, blocks, onCTAClick, isPdf = false }) {
  const score = result?.total_score || result?.score || 0;
  const totalMax = result?.total_max || result?.scale_max || 48;
  const percentage = totalMax > 0 ? Math.round((score / totalMax) * 100) : 0;
  const level = result?.level || {};
  const blockScores = result?.block_scores || {};

  // Dynamic content from store
  const { bandCopy, getBandCopy, fetchContent, getPerformanceColors, getLabel } = useContentStore();

  // Fetch content on mount if not cached
  useEffect(() => {
    if (!bandCopy) {
      fetchContent();
    }
  }, [bandCopy, fetchContent]);

  // Count completed dimensions
  const completedDimensions = React.useMemo(() => {
    if (!blocks || !blockScores) return 0;
    return blocks.filter(block => {
      const scoreData = blockScores[block.id];
      return scoreData && scoreData.raw > 0;
    }).length;
  }, [blocks, blockScores]);

  const getBandFromScore = (score) => {
    if (score >= 51) return 'green';
    if (score >= 37) return 'gold';
    if (score >= 22) return 'amber';
    return 'red';
  };

  const bandKey = getBandFromScore(score);

  // Get sorted dimensions by score (lowest first)
  const sortedDimensions = React.useMemo(() => {
    if (!blocks || !blockScores) return [];

    return blocks
      .map(block => {
        const scoreData = blockScores[block.id] || { raw: 0, max: 1 };
        const ratio = scoreData.max > 0 ? scoreData.raw / scoreData.max : 0;
        return {
          title: block.title || `Dimension ${block.id}`,
          raw: scoreData.raw,
          max: scoreData.max,
          ratio,
        };
      })
      .sort((a, b) => a.ratio - b.ratio);
  }, [blocks, blockScores]);

  // Get lowest 3 dimension names
  const dim1 = sortedDimensions[0]?.title || 'Architecture';
  const dim2 = sortedDimensions[1]?.title || 'Integration';
  const dim3 = sortedDimensions[2]?.title || 'Compliance';

  // Get dynamic band content with variable substitution
  const dynamicContent = getBandCopy(bandKey, { dim1, dim2, dim3 });

  // Get performance colors from settings store
  const perfColors = getPerformanceColors() || {
    red: '#c02b12',
    amber: '#e76424',
    gold: '#edaf18',
    green: '#069e7b',
  };

  // Helper to convert hex to beautiful, matching translucent shades for background/border
  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Merge with dynamic visual configuration from settings
  const content = {
    red: {
      icon: <AlertTriangle size={24} color={perfColors.red} />,
      bgColor: hexToRgba(perfColors.red, 0.04),
      borderColor: hexToRgba(perfColors.red, 0.15),
      accentColor: perfColors.red,
      ringColor: perfColors.red,
    },
    amber: {
      icon: <TrendingUp size={24} color={perfColors.amber} />,
      bgColor: hexToRgba(perfColors.amber, 0.04),
      borderColor: hexToRgba(perfColors.amber, 0.15),
      accentColor: perfColors.amber,
      ringColor: perfColors.amber,
    },
    green: {
      icon: <Award size={24} color={perfColors.green} />,
      bgColor: hexToRgba(perfColors.green, 0.04),
      borderColor: hexToRgba(perfColors.green, 0.15),
      accentColor: perfColors.green,
      ringColor: perfColors.green,
    },
    gold: {
      icon: <CheckCircle size={24} color={perfColors.gold} />,
      bgColor: hexToRgba(perfColors.gold, 0.04),
      borderColor: hexToRgba(perfColors.gold, 0.15),
      accentColor: perfColors.gold,
      ringColor: perfColors.gold,
    },
  }[bandKey];

  // Merge dynamic text with visual config
  const mergedContent = { ...content, ...dynamicContent };

  return (
    <div className="dap-stat-section">
      {/* Score Breakdown Header */}
      <div className="dap-stat-header">
        <h2 className="dap-stat-header__title">
          {getLabel('section_score_breakdown', { fallback: 'Score Breakdown' })}
        </h2>
        <p className="dap-stat-header__subtitle">
          {getLabel('helper_points_scale', { fallback: `(Based on 0-${totalMax} points scale)`, max: totalMax })}
        </p>
      </div>
 
      {/* Score Metrics Grid */}
      <div className="dap-stat-grid">
        {/* Score Card with Ring */}
        <motion.div
          initial={isPdf ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: isPdf ? 0 : 0.5 }}
          className="dap-stat-card dap-stat-card--row"
        >
          <div>
            <p className="dap-stat-card__label">
              {getLabel('label_readiness_score', { fallback: 'Your Readiness Score' })}
            </p>
          </div>
          <ScoreRing
            score={score}
            max={totalMax}
            percentage={percentage}
            color={mergedContent.ringColor || mergedContent.accentColor}
            size={120}
            isPdf={isPdf}
          />
        </motion.div>
 
        {/* Stats Cards */}
        <motion.div
          initial={isPdf ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: isPdf ? 0 : 0.5, delay: isPdf ? 0 : 0.1 }}
          className="dap-stat-card"
        >
          <p className="dap-stat-card__label">
            {getLabel('label_completed_dimension', { fallback: 'Completed Dimension' })}
          </p>
          <p className="dap-stat-card__value">{completedDimensions}</p>
          <p className="dap-stat-card__sublabel">
            {getLabel('label_of_dimensions', { fallback: `of ${blocks?.length || 12} dimensions`, count: blocks?.length || 12 })}
          </p>
        </motion.div>
 
        <motion.div
          initial={isPdf ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: isPdf ? 0 : 0.5, delay: isPdf ? 0 : 0.2 }}
          className="dap-stat-card"
        >
          <p className="dap-stat-card__label">
            {getLabel('label_total_points', { fallback: 'Total Points' })}
          </p>
          <p className="dap-stat-card__value">{Math.round(score)}</p>
          <p className="dap-stat-card__sublabel">
            {getLabel('label_points_earned', { fallback: 'points earned' })}
          </p>
        </motion.div>
 
        <motion.div
          initial={isPdf ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: isPdf ? 0 : 0.5, delay: isPdf ? 0 : 0.3 }}
          className="dap-stat-card"
        >
          <p className="dap-stat-card__label">
            {getLabel('label_out_of', { fallback: 'Out Of' })}
          </p>
          <p className="dap-stat-card__value">{totalMax}</p>
          <p className="dap-stat-card__sublabel">
            {getLabel('label_maximum_points', { fallback: 'maximum points' })}
          </p>
        </motion.div>
      </div>

      {/* Band Result Card */}
      <motion.div
        initial={isPdf ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: isPdf ? 0 : 0.6, delay: isPdf ? 0 : 0.4 }}
        className="dap-band-card"
        style={{
          background: mergedContent.bgColor,
          border: `2px solid ${mergedContent.borderColor}`
        }}
      >
        {/* Band Badge */}
        <div className="dap-band-card__badge">
          {mergedContent.icon}
          <span
            className="dap-band-card__badge-text"
            style={{ color: mergedContent.accentColor }}
          >
            {mergedContent.band_label || (bandKey === 'red' && 'RED — High Risk') || (bandKey === 'amber' && 'AMBER — Moderate Risk') || (bandKey === 'gold' && 'GOLD — Low Risk') || 'GREEN — Benchmark'}
          </span>
        </div>

        {/* Headline */}
        <h3 className="dap-band-card__headline">
          {mergedContent.headline}
        </h3>

        {/* Description */}
        <p className="dap-band-card__description">
          {mergedContent.description}
        </p>

        {/* Lowest Dimensions Highlight */}
        <p
          className="dap-band-card__highlight"
          style={{ borderLeft: `4px solid ${mergedContent.accentColor}` }}
        >
          {mergedContent.lowest_dimensions}
        </p>
      </motion.div>
    </div>
  );
}
