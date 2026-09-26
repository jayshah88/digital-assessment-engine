import React from 'react';
import { motion } from 'framer-motion';
import { Target, Shield, Sliders, Clock, Zap } from 'lucide-react';
import { useAssessmentStore } from '@store/assessmentStore';
import { useContentStore } from '@store/contentStore';
import Button from '@components/UI/Button';

const cfg = window.dapConfig || window.dapAdmin || {};

export default function IntroScreen() {
  const { assessment, blocks, allQuestions, startAssessment } = useAssessmentStore();
  const { getLabel } = useContentStore();
  const i18n = cfg.i18n || {};

  const totalQuestions = allQuestions.length;
  const estimatedMins  = Math.max(2, Math.ceil(totalQuestions * 0.5));

  const features = [
    { 
      icon: Target, 
      title: getLabel('intro_feature_1_title', { fallback: 'Strateic Baseline' }), 
      desc: getLabel('intro_feature_1_desc', { fallback: 'A multidimensional audit across 12 critical engineering domains.' }) 
    },
    { 
      icon: Clock, 
      title: getLabel('intro_feature_2_title', { fallback: 'Efficiency Focused' }), 
      desc: getLabel('intro_feature_2_desc', { fallback: 'Validated in ~6 minutes. Optimized for executive time management.' }) 
    },
    { 
      icon: Sliders, 
      title: getLabel('intro_feature_3_title', { fallback: 'Precision Metrics' }), 
      desc: getLabel('intro_feature_3_desc', { fallback: 'High-fidelity capability mapping with actionable investment logic.' }) 
    },
    { 
      icon: Shield, 
      title: getLabel('intro_feature_4_title', { fallback: 'Secure Context' }), 
      desc: getLabel('intro_feature_4_desc', { fallback: 'Enterprise-grade confidentiality standards for strategic data protection.' }) 
    },
  ];

  const containerVars = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
  };

  const itemVars = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.19, 1, 0.22, 1] } }
  };

  return (
    <div className="dap-intro">
      <motion.div
        className="dap-intro__hero"
        variants={containerVars}
        initial="initial"
        animate="animate"
      >
        <motion.p variants={itemVars} className="dap-intro__description">
          {getLabel('intro_description', { fallback: assessment?.description || 'The decisions made before engineering begin have the greatest impact on product schedules, costs, and quality. This 5-minute Product Engineering Readiness Scorecard helps you evaluate your programme across 12 critical engineering dimensions—including requirements clarity, platform reuse, concurrent engineering, compliance, and supply chain readiness. Receive an instant readiness score, identify potential risks early, and get actionable recommendations to improve your chances of delivering on time.' })}
        </motion.p>
      </motion.div>

      <motion.div 
        className="dap-intro__features"
        variants={containerVars}
        initial="initial"
        animate="animate"
      >
        {features.map(({ icon: Icon, title, desc }, i) => (
          <motion.div 
            key={i} 
            className="dap-intro__feature"
            variants={itemVars}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
          >
            <div className="dap-intro__feature-icon">
              <Icon size={24} />
            </div>
            <div className="dap-intro__feature-text">
              <h4>{title}</h4>
              <p className="dap-intro__feature-desc">{desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="dap-intro__cta"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.8 }}
      >
        <Button
          onClick={startAssessment}
          size="xl"
          variant="primary"
          rightIcon={<Zap size={20} fill="currentColor" />}
          className="dap-intro__start-btn"
        >
          {getLabel('button_start', { fallback: 'Start Assessment' })}
        </Button>
        <div className="dap-intro__cta-note">
           {getLabel('intro_cta_note', { fallback: 'HIGH-FIDELITY DASHBOARD ACCESS → RESULTS WITHIN ~3M' })}
        </div>
      </motion.div>
    </div>
  );
}
