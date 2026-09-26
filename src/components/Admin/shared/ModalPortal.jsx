import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal - Renders children into document.body outside React tree
 * This ensures modals cover the entire viewport without being clipped by parent containers
 */
export default function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Lock body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      setMounted(false);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
