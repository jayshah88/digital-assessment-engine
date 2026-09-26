import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Activity } from 'lucide-react';
import { useAssessmentStore }     from '@store/assessmentStore';
import { useContentStore }        from '@store/contentStore';
import clsx                       from 'clsx';
import Button                     from '@components/UI/Button';

import SingleChoice     from './questions/SingleChoice';
import MultiChoice      from './questions/MultiChoice';
import BooleanQuestion  from './questions/BooleanQuestion';
import ScaleQuestion    from './questions/ScaleQuestion';
import TextQuestion     from './questions/TextQuestion';

const QUESTION_COMPONENTS = {
  single:  SingleChoice,
  multi:   MultiChoice,
  boolean: BooleanQuestion,
  scale:   ScaleQuestion,
  text:    TextQuestion,
};

export default function QuestionFlow() {
  const allQuestions   = useAssessmentStore(s => s.allQuestions);
  const currentQuestion = useAssessmentStore(s => s.currentQuestion);
  const answers         = useAssessmentStore(s => s.answers);
  const isSubmitting    = useAssessmentStore(s => s.isLoading);
  
  const setAnswer        = useAssessmentStore(s => s.setAnswer);
  const goNext           = useAssessmentStore(s => s.goNext);
  const goPrev           = useAssessmentStore(s => s.goPrev);
  const submitAssessment = useAssessmentStore(s => s.submitAssessment);
  
  const { getLabel } = useContentStore();

  const containerRef = useRef(null);
  const timerRef     = useRef(null);

  const isLast    = currentQuestion === allQuestions.length - 1;
  const q         = allQuestions[currentQuestion];
  const isAnswered = q && (answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '');

  const handleAnswer = useCallback((questionId, value) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setAnswer(questionId, value);
  }, [setAnswer]);

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentQuestion]);

  if (!q) return null;

  const QuestionComponent = QUESTION_COMPONENTS[q.question_type] || SingleChoice;

  return (
    <div className="dap-flow" ref={containerRef}>
      {/* Precision Engineered Header */}
      <div className="dap-flow__header">
        <div className="dap-flow__meta">
          <div className="dap-flow__block-tag">
            <Activity size={14} />
            {q.blockTitle || 'Core Strategy'}
          </div>
          <div className="dap-flow__counter">
            {getLabel('flow_step_counter', { fallback: `STEP ${currentQuestion + 1} OF ${allQuestions.length}`, current: currentQuestion + 1, total: allQuestions.length })}
          </div>
        </div>
        
        {/* High-Fidelity Stepper */}
        <div className="dap-flow__nav-dots">
          {allQuestions.map((_, i) => (
            <div
              key={i}
              className={clsx('dap-flow__dot', {
                'active':   i === currentQuestion,
                'answered': answers[allQuestions[i]?.id] !== undefined
              })}
            />
          ))}
        </div>
      </div>

      {/* Authoritative Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, scale: 0.99, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.01, y: -20 }}
          transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
          className="dap-card"
        >
          <div className="dap-flow__question-wrap">
            <h2 className="dap-flow__question-text">{q.question_text}</h2>
            {q.helper_text && <p className="dap-flow__helper-text">{q.helper_text}</p>}
          </div>

          <div className="dap-flow__options-wrap">
            <QuestionComponent
              question={q}
              value={answers[q.id]}
              onChange={(val, auto) => handleAnswer(q.id, val, auto)}
            />
          </div>

          {/* Locked UX Indicator */}
          <AnimatePresence>
            {!isAnswered && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="dap-flow__locked-indicator"
              >
                <Lock size={12} /> {getLabel('message_select_option', { fallback: 'Please select a baseline to proceed' })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Authoritative Navigation Controls */}
      <div className="dap-flow__nav">
        <Button
          variant="ghost"
          size="lg"
          onClick={goPrev}
          disabled={currentQuestion === 0 || isSubmitting}
          leftIcon={<ArrowLeft size={18} />}
        >
          {getLabel('button_back', { fallback: 'Previous' })}
        </Button>

        {isLast ? (
          <Button
            variant="primary"
            size="xl"
            onClick={submitAssessment}
            isLoading={isSubmitting}
            disabled={isSubmitting || !isAnswered}
            rightIcon={<CheckCircle2 size={18} />}
            className="dap-flow__submit-btn"
          >
            {isSubmitting ? getLabel('message_submitting', { fallback: 'Finalizing Audit...' }) : getLabel('button_submit', { fallback: 'Complete Maturity Audit' })}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={goNext}
            disabled={isSubmitting || !isAnswered}
            rightIcon={<ArrowRight size={18} />}
            className="dap-flow__next-btn"
          >
            {getLabel('button_next', { fallback: 'Next Step' })}
          </Button>
        )}
      </div>
    </div>
  );
}
