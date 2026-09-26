import React, { useCallback, useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Toast Context for showing notifications.
 */
export const ToastContext = createContext(null);

/**
 * Hook to use toast notifications.
 *
 * @returns {function} Toast function.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

/**
 * Toast Provider Component
 *
 * @param {Object} props - Component props.
 * @param {React.ReactNode} props.children - Child components.
 * @returns {JSX.Element} Provider component.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * Add a toast notification.
   *
   * @param {string} msg - Message to display.
   * @param {'success'|'error'|'info'} [type='success'] - Toast type.
   * @param {number} [duration=3500] - Duration in milliseconds.
   */
  const add = useCallback((msg, type = 'success', duration = 3500) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, duration);
  }, []);

  /**
   * Remove a specific toast.
   *
   * @param {number} id - Toast ID to remove.
   */
  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  // Toast color configuration.
  const toastColors = {
    success: '#10B981',
    error: '#EF4444',
    info: '#3B82F6',
  };

  return (
    <ToastContext.Provider value={add}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                borderRadius: 10,
                background: toastColors[t.type] || toastColors.success,
                color: '#fff',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
                fontSize: '14px',
                fontWeight: 600,
                minWidth: 280,
                maxWidth: 400,
              }}
              role="alert"
            >
              <span style={{ flex: 1 }}>{t.msg}</span>
              <button
                onClick={() => remove(t.id)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: 6,
                  padding: 4,
                  cursor: 'pointer',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Dismiss notification"
                type="button"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
