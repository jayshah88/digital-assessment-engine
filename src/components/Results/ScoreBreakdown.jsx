/**
 * ScoreBreakdown — Dimensional Performance Heatmap (v11.0)
 * Modern heatmap UI with gradient scoring, hover interactions, and clear visual hierarchy
 */
import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, TrendingUp, Award } from 'lucide-react';
import { useContentStore } from '../../store/contentStore';

// Get heatmap color based on raw score — uses the defined band ranges
// For per-dimension cards, we compute score from pct * max / 100
const getHeatmapColor = (pct, colors, raw, max) => {
  if (!colors) colors = { gold: '#edaf18', green: '#069e7b', amber: '#e76424', red: '#c02b12' };
  
  let baseColor = colors.red || '#c02b12';
  let label = 'HIGH RISK';
  
  if (pct >= 89.47) {
    baseColor = colors.green || '#069e7b';
    label = 'BENCHMARK';
  } else if (pct >= 64.91) {
    baseColor = colors.gold || '#edaf18';
    label = 'LOW RISK';
  } else if (pct >= 38.60) {
    baseColor = colors.amber || '#e76424';
    label = 'MODERATE RISK';
  }
  
  const darkColor = adjustColor(baseColor, -30);
  
  return {
    bg: baseColor,
    text: '#fff',
    gradient: `linear-gradient(135deg, ${baseColor} 0%, ${darkColor} 100%)`,
    label: label
  };
};

// Helper to darken a hex color for gradients
function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

const getPerformanceLabel = (pct) => {
  if (pct >= 89.47) return { label: 'BENCHMARK', icon: Award };
  if (pct >= 64.91) return { label: 'LOW RISK', icon: CheckCircle2 };
  if (pct >= 38.60) return { label: 'MODERATE RISK', icon: TrendingUp };
  return { label: 'HIGH RISK', icon: AlertCircle };
};

export default function ScoreBreakdown({ blocks, blockScores, isPdf = false }) {
  const { getPerformanceColors, getLabel } = useContentStore();
  const perfColors = getPerformanceColors();

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!blocks || !blockScores) return { avg: 0, gold: 0, red: 0, max: 48 };
    const scores = blocks.map(b => blockScores[b.id]?.pct || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const gold = scores.filter(s => s >= 89.47).length;
    const red = scores.filter(s => s < 38.60).length;
    const max = blocks.reduce((acc, b) => acc + (blockScores[b.id]?.max || 0), 0);
    return { avg, gold, red, max };
  }, [blocks, blockScores]);

  return (
    <div className="dap-heatmap-container">
      {/* Header with Legend */}
      <div className="dap-heatmap-header">
        {/* Legend */}
        <div className="dap-heatmap-legend">
          <span className="dap-heatmap-legend__label">{getLabel('label_performance', { fallback: 'Performance:' })}</span>
          {[
            { color: perfColors.red, label: 'RED' },
            { color: perfColors.amber, label: 'AMBER' },
            { color: perfColors.gold, label: 'GOLD' },
            { color: perfColors.green, label: 'GREEN' },
          ].map(item => (
            <div key={item.label} className="dap-heatmap-legend__item">
              <div 
                className="dap-heatmap-legend__dot" 
                style={{ background: item.color, boxShadow: `0 2px 4px ${item.color}40` }}
              />
              <span className="dap-heatmap-legend__text">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="dap-heatmap-stats">
        <div className="dap-heatmap-stats__item">
          <div className="dap-heatmap-stats__label">{getLabel('label_stats_average', { fallback: 'Average' })}</div>
          <div className="dap-heatmap-stats__value dap-text-slate-900">{Math.round(stats.avg)}%</div>
        </div>
        <div className="dap-heatmap-stats__item dap-heatmap-stats__item--bordered">
          <div className="dap-heatmap-stats__label">{getLabel('label_stats_benchmark', { fallback: 'Benchmark (GOLD)' })}</div>
          <div className="dap-heatmap-stats__value dap-text-gold">{stats.gold}</div>
        </div>
        <div className="dap-heatmap-stats__item dap-heatmap-stats__item--bordered">
          <div className="dap-heatmap-stats__label">{getLabel('label_stats_high_risk', { fallback: 'High Risk (RED)' })}</div>
          <div className="dap-heatmap-stats__value dap-text-danger">{stats.red}</div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="dap-heatmap-grid">
        {(blocks || [])
          .sort((a, b) => (blockScores[b.id]?.pct || 0) - (blockScores[a.id]?.pct || 0))
          .map((block, i) => {
            const scoreData = blockScores[block.id] || { raw: 0, max: 1, pct: 0 };
            const { raw, max, pct } = scoreData;
            const colors = getHeatmapColor(pct, perfColors);
            const perf = getPerformanceLabel(pct);
            const Icon = perf.icon;

            return (
              <motion.div
                key={block.id}
                initial={isPdf ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                animate={isPdf ? { opacity: 1, scale: 1 } : undefined}
                whileInView={isPdf ? undefined : { opacity: 1, scale: 1 }}
                viewport={isPdf ? undefined : { once: true }}
                transition={isPdf ? { duration: 0 } : { delay: i * 0.05 }}
                className="dap-heatmap-card"
              >
                {/* Card Header */}
                <div className="dap-heatmap-card__header">
                  <h4 className="dap-heatmap-card__title">
                    {block.title || `Dimension ${block.id}`}
                  </h4>
                  <div 
                    className="dap-heatmap-card__badge"
                    style={{ background: colors.gradient, color: colors.text }}
                  >
                    <Icon size={12} />
                    <span className="dap-heatmap-card__badge-text">{perf.label}</span>
                  </div>
                </div>

                {/* Score Row */}
                <div className="dap-flex dap-items-center dap-gap-3 dap-mb-3">
                  <span 
                    className="dap-text-3xl dap-font-black"
                    style={{ color: colors.bg, lineHeight: 1 }}
                  >
                    {Math.round(pct)}%
                  </span>
                  <span className="dap-text-sm dap-font-semibold dap-text-slate-400">
                    {raw} / {max} points
                  </span>
                </div>

                {/* Progress Bar */}
                <div 
                  className="dap-heatmap-card__progress"
                >
                  <motion.div
                    initial={isPdf ? { width: `${pct}%` } : { width: 0 }}
                    animate={isPdf ? { width: `${pct}%` } : undefined}
                    whileInView={isPdf ? undefined : { width: `${pct}%` }}
                    viewport={isPdf ? undefined : { once: true }}
                    transition={isPdf ? { duration: 0 } : { duration: 0.8, ease: 'easeOut', delay: i * 0.05 }}
                    className="dap-heatmap-card__progress-bar"
                    style={{ 
                      background: colors.gradient,
                      width: isPdf ? `${pct}%` : undefined
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
      </div>
    </div>
  );
}


/**
 * RecommendationsList — Strategic Insight Roadmap
 */
export function RecommendationsList({ recommendations }) {
  return (
    <div className="dap-flex dap-flex-col dap-gap-4">
      {(recommendations || []).map((rec, i) => {
        if (!rec || !rec.text) return null;

        const parts = rec.text.split('## Investments');
        const observation = (parts[0] || '').trim();
        const investments = (parts[1] || '').trim();
        
        return (
          <motion.div
            key={rec.block_id || i}
            className="dap-rec-card"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12 }}
          >
            <div className="dap-rec-card__number">
              {i + 1}
            </div>
            
            <div className="dap-rec-card__content">
              <h3 className="dap-rec-card__title">
                {(rec.block_title || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
              </h3>
              <div className="dap-text-base dap-text-slate-600 dap-leading-relaxed">
                <p className="dap-rec-card__observation">{observation}</p>
                {investments && (
                  <div className="dap-rec-card__investments">
                    <div className="dap-rec-card__investments-label">Recommended Investments</div>
                    <p className="dap-rec-card__investments-text">{investments}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
