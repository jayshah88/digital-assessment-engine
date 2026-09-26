import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import ModalPortal from './ModalPortal';

/**
 * Confirmation Modal Component
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {function} props.onClose - Close handler.
 * @param {function} props.onConfirm - Confirm handler.
 * @param {string} props.title - Modal title.
 * @param {string} props.message - Modal message.
 * @param {string} [props.confirmText='Confirm'] - Confirm button text.
 * @param {string} [props.cancelText='Cancel'] - Cancel button text.
 * @param {boolean} [props.danger=false] - Whether this is a dangerous action.
 * @returns {JSX.Element|null} Modal component.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <ModalPortal>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 16px',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              background: '#fff',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              width: '100%',
              maxWidth: '420px',
              border: danger ? '2px solid var(--adap-danger)' : '1px solid var(--adap-border)',
            }}
            onClick={e => e.stopPropagation()}
          >
          {/* Header */}
          <div style={{ padding: '20px clamp(16px, 4vw, 32px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {danger && <AlertTriangle size={24} color="var(--adap-danger)" aria-hidden="true" />}
              <span
                id="confirm-modal-title"
                style={{
                  fontFamily: 'Lexend',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                  color: 'var(--adap-slate-900)',
                }}
              >
                {title}
              </span>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '0 clamp(16px, 4vw, 32px) 20px' }}>
            <p
              style={{
                fontSize: '0.95rem',
                color: 'var(--adap-slate-600)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {message}
            </p>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px clamp(16px, 4vw, 32px)',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              borderTop: '1px solid var(--adap-border)',
            }}
          >
            <button
              className="adap-btn adap-btn--outline"
              onClick={onClose}
              type="button"
            >
              {cancelText}
            </button>
            <button
              className={`adap-btn ${danger ? 'adap-btn--danger' : 'adap-btn--primary'}`}
              onClick={() => {
                onConfirm();
                onClose();
              }}
              type="button"
            >
              {confirmText}
            </button>
          </div>
          </motion.div>
        </motion.div>
        </ModalPortal>
      )}
    </AnimatePresence>
  );
}
