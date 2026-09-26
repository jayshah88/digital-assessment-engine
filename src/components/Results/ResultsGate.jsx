import React from 'react';
import { motion } from 'framer-motion';
import { Lock, TrendingUp, Zap, ArrowRight, BarChart3 } from 'lucide-react';
import { useAssessmentStore } from '@store/assessmentStore';
import { ScoreRing } from '@components/Charts/RadarChart';
import Button from '@components/UI/Button';

const cfg = window.dapConfig || window.dapAdmin || {};

/**
 * ResultsGate — Executive Strategic Bridge (Pinnacle v10.10)
 */
export default function ResultsGate() {
  const { result, assessment } = useAssessmentStore();
  const i18n = cfg.i18n || {};

  // Get raw score points (0-48 scale)
  const rawScore = result?.total_score || result?.score || result?.sum || 0;
  const totalMax = result?.total_max || 48;
  // Calculate percentage based on 48 total points (0-100%)
  const percentage = totalMax > 0 ? Math.round((rawScore / totalMax) * 100) : 0;
  const level = result?.level || {};
  const blockScores = result?.block_scores || {};

  return (
    <div className="dap-gate">
      {/* 10/10 Monumental Teaser Card */}
      <motion.div
        className="dap-card dap-gate__card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
      >
        <div className="dap-gate__badge-custom">
          Verification Complete
        </div>

        <div className="dap-gate__score-wrap">
          <ScoreRing score={percentage} color="#2c8c7f" size={240} animated />
        </div>

        <h2 className="dap-gate__title">
          Capability Baseline Established
        </h2>
        <p className="dap-gate__description">
          Your engineering maturity has been quantified at <span className="dap-gate__points">{percentage}%</span>.
          <span className="dap-gate__points-label">
            {Math.round(rawScore)} / {Math.round(totalMax)} REGULATORY POINTS
          </span>
        </p>
      </motion.div>

      {/* 10/10 Call to Action Card */}
      <motion.div
        className="dap-card dap-gate__cta-card"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
      >
        <div className="dap-gate__lock-icon-custom">
          <Lock size={28} />
        </div>

        <h3 className="dap-gate__cta-title">
          {i18n.leadGateTitle || 'Access High-Fidelity Analysis'}
        </h3>
        <p className="dap-gate__cta-subtitle">
          {i18n.leadGateSubtitle || 'Authorize your executive session to unlock the multidimensional capability heatmap and investment roadmap.'}
        </p>

        <div className="dap-gate__perks">
          {[
            'Full Capability Radar Map',
            'Cross-Domain Variance Audit',
            'Strategic Investment Logic',
            'PDF Capability Document'
          ].map((perk) => (
            <div key={perk} className="dap-gate__perk">
              <div className="dap-gate__perk-icon">
                <Zap size={11} fill="currentColor" />
              </div>
              <span className="dap-gate__perk-text">{perk}</span>
            </div>
          ))}
        </div>

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => useAssessmentStore.setState({ phase: 'lead-capture' })}
          rightIcon={<ArrowRight size={20} />}
          className="dap-gate__btn"
        >
          {i18n.leadGateBtn || 'Get Your Detailed Report'}
        </Button>
      </motion.div>
    </div>
  );
}
