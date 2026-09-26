import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Info } from 'lucide-react';
import clsx from 'clsx';

/**
 * MultiChoice — Pinnacle Executive Multi-Select
 */
export function MultiChoice({ question, value, onChange }) {
  const options = question.options || [];
  const selected = Array.isArray(value) ? value.map(String) : [];

  const toggle = (optId) => {
    const id = String(optId);
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id];
    onChange(next.map(Number));
  };

  return (
    <div className="dap-multi">
      <div className="dap-multi__info">
        <Info size={14} /> Multi-dimensional selection enabled
      </div>
      {options.map((opt) => {
        const isChecked = selected.includes(String(opt.id));
        return (
          <motion.button
            key={opt.id}
            className={clsx('dap-option', { 'dap-option--selected': isChecked })}
            onClick={() => toggle(opt.id)}
            type="button"
            role="checkbox"
            aria-checked={isChecked}
            whileHover={{ x: isChecked ? 0 : 8, transition: { type: 'spring', stiffness: 400, damping: 15 } }}
            whileTap={{ scale: 0.98 }}
          >
            <div className={clsx('dap-option__checkbox', { 'active': isChecked })}>
              {isChecked && <Check size={14} color="#fff" strokeWidth={3} />}
            </div>
            <span className="dap-option__text">
              {opt.option_text || opt.text || opt.label || ''}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * ScaleQuestion — Pinnacle Strategic Graduation
 */
export function ScaleQuestion({ question, value, onChange }) {
  const options  = question.options || [];
  const maxScale = options.length || 5;
  const current  = Number(value) || 0;

  const labels = options.length
    ? {
        first: options[0]?.option_text || options[0]?.text || options[0]?.label || 'Low Maturity',
        last: options[options.length - 1]?.option_text || options[options.length - 1]?.text || options[options.length - 1]?.label || 'High Capability'
      }
    : { first: 'Low Maturity', last: 'High Capability' };

  return (
    <div className="dap-scale">
      <div className="dap-scale__track">
        <div className="dap-scale__line" />
        {Array.from({ length: maxScale }, (_, i) => {
          const val = i + 1;
          const isActive = val <= current;
          const isCurrent = val === current;
          return (
            <motion.button
              key={val}
              className={clsx('dap-scale__step', { 'active': isActive, 'current': isCurrent })}
              onClick={() => onChange(val)}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.95 }}
              type="button"
            >
              {val}
            </motion.button>
          );
        })}
      </div>
      <div className="dap-scale__labels">
        <span className="dap-scale__label-item">{labels.first}</span>
        <span className="dap-scale__label-item dap-scale__label-item--right">{labels.last}</span>
      </div>
    </div>
  );
}

/**
 * TextQuestion — High-Density Free Text
 */
export function TextQuestion({ question, value, onChange }) {
  return (
    <div className="dap-text">
      <textarea
        className="dap-text__input"
        placeholder={question.helper_text || 'Synthesize your executive perspective here…'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * BooleanQuestion — Yes / No Strategic Toggle
 */
export function BooleanQuestion({ question, value, onChange }) {
  const choices = [
    { label: 'Validated', value: true,  icon: Check },
    { label: 'Non-Existent',  value: false, icon: Info },
  ];

  return (
    <div className="dap-boolean">
      {choices.map(({ label, value: v, icon: Icon }) => {
        const isSelected = value === v;
        return (
          <motion.button
            key={label}
            className={clsx('dap-option', 'dap-boolean__btn', { 'dap-option--selected': isSelected })}
            onClick={() => onChange(v)}
            type="button"
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            whileTap={{ scale: 0.96 }}
          >
            <div className={clsx('dap-boolean__icon-wrap', { 'active': isSelected })}>
              <Icon size={24} strokeWidth={isSelected ? 3 : 2} />
            </div>
            <span className="dap-boolean__text">{label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default MultiChoice;
