import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollUnlocker = () => {
  const location = useLocation();

  useEffect(() => {
    // Use rAF to run AFTER React's commit phase, preventing DOM reconciliation conflicts.
    // Only clear overflow and data-scroll-locked — NOT position/top/width,
    // as those are also managed by React internals and clearing them mid-commit causes
    // "removeChild: The node is not a child of this node" crashes.
    const raf = requestAnimationFrame(() => {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-scroll-locked');
      document.documentElement.removeAttribute('data-scroll-locked');
    });

    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  return null;
};
