import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import clsx from 'clsx';

/**
 * SingleChoice — Executive Selection (Pinnacle v10.10)
 */
export default function SingleChoice({ question, value, onChange }) {
  const options = question.options || [];
  const selectedId = value ? String(value) : null;

  return (
    <div className="dap-single dap-options" id={`dap-q-${question.id}`}>
      {options.map((opt, i) => {
        const isSelected = String(opt.id) === selectedId;

        return (
          <motion.button
            key={opt.id}
            className={clsx('dap-option', { 'dap-option--selected': isSelected })}
            onClick={() => onChange(opt.id)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            
            // Pinnacle Micro-interactions
            whileHover={{ x: isSelected ? 0 : 8, transition: { type: 'spring', stiffness: 400, damping: 15 } }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="dap-option__marker">
              {String.fromCharCode(65 + i)}
            </div>
            
            <span className="dap-option__text">
              {opt.option_text || opt.text || opt.label || ''}
            </span>

            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="dap-option__check"
                >
                  <Check size={20} strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
