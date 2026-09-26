/**
 * Button — Executive Action (v10.10 Pinnacle)
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import clsx from 'clsx';

export default function Button({
  children, variant = 'primary', size = 'md',
  onClick, disabled, isLoading, type = 'button',
  fullWidth, leftIcon, rightIcon, className = '',
  style = {}
}) {
  return (
    <motion.button
      type={type}
      className={clsx('dap-btn', `dap-btn--${variant}`, `dap-btn--${size}`, {
        'dap-btn--full':    fullWidth,
        'dap-btn--loading': isLoading,
        'dap-btn--disabled': disabled || isLoading,
      }, className)}
      style={style}
      onClick={onClick}
      disabled={disabled || isLoading}
      
      // Award-Winning Micro-interactions
      whileHover={!disabled && !isLoading ? { 
        y: -4, 
        scale: 1.01,
        transition: { type: 'spring', stiffness: 400, damping: 10 }
      } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.97, y: 0 } : {}}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="dap-flex dap-items-center dap-gap-2"
          >
            <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 18} />
            {size !== 'sm' && <span className="dap-btn__loading-text">Processing Audit...</span>}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="dap-btn__content"
          >
            {leftIcon && <span className="dap-btn__icon-left">{leftIcon}</span>}
            <span className="dap-btn__text">{children}</span>
            {rightIcon && <span className="dap-btn__icon-right">{rightIcon}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}


/**
 * ProgressBar — Analysis Completion Indicator
 */
export function ProgressBar({ value = 0, color = '#4F46E5' }) {
  return (
    <div className="dap-progress-bar">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
        className="dap-progress-bar__fill"
        style={{ background: color }}
      />
    </div>
  );
}

/**
 * LoadingScreen — Executive Orchestration
 */
export function LoadingScreen({ message = 'Orchestrating capability metrics...' }) {
  return (
    <div className="dap-loading-screen">
      <div className="dap-loading-screen__spinner-wrap">
        <motion.div
          className="dap-loading-screen__spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <div className="dap-loading-screen__spinner-dot">
          <div className="dap-loading-screen__spinner-dot-inner" />
        </div>
      </div>
      <h3 className="dap-loading-screen__title">{message}</h3>
      <p className="dap-loading-screen__subtitle">Establishing secure session protocol...</p>
    </div>
  );
}

/**
 * ErrorScreen — Professional Recovery
 */
export function ErrorScreen({ message, onRetry }) {
  return (
    <div className="dap-error-screen">
      <div className="dap-error-screen__icon-wrap">
        <AlertCircle size={32} />
      </div>
      <h3 className="dap-error-screen__title">Audit Interrupted</h3>
      <p className="dap-error-screen__message">{message || 'A data synchronization error occurred. The session remains secure.'}</p>
      {onRetry && (
        <Button variant="primary" size="lg" onClick={onRetry} leftIcon={<RefreshCcw size={18} />}>
          Resume Strategy Scan
        </Button>
      )}
    </div>
  );
}
