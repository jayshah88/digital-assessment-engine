import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAssessmentStore } from '@store/assessmentStore';
import { useContentStore } from '@store/contentStore';

export default function SubmittingScreen() {
  const [stepIdx, setStepIdx] = React.useState(0);
  const { getLabel } = useContentStore();

  const steps = [
    getLabel('message_submitting_step_1', { fallback: 'Analysing your responses…' }),
    getLabel('message_submitting_step_2', { fallback: 'Calculating dimension scores…' }),
    getLabel('message_submitting_step_3', { fallback: 'Generating recommendations…' }),
    getLabel('message_submitting_step_4', { fallback: 'Preparing your report…' }),
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx(i => Math.min(i + 1, steps.length - 1));
    }, 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dap-submitting">
      {/* Animated rings */}
      <div className="dap-submitting__rings">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="dap-submitting__ring"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, delay: i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        <div className="dap-submitting__center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="dap-submitting__spinner"
          />
        </div>
      </div>

      <motion.div
        key={stepIdx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="dap-submitting__step"
      >
        {steps[stepIdx]}
      </motion.div>

      {/* Progress dots */}
      <div className="dap-submitting__dots">
        {steps.map((_, i) => (
          <motion.div
            key={i}
            className={`dap-submitting__dot ${i <= stepIdx ? 'active' : ''}`}
            animate={{ scale: i === stepIdx ? 1.3 : 1 }}
          />
        ))}
      </div>
    </div>
  );
}
