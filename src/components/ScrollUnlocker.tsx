import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollUnlocker = () => {
  const location = useLocation();

  useEffect(() => {
    // Use setTimeout to ensure this runs after all Radix cleanup attempts
    const timeout = setTimeout(() => {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.body.removeAttribute('data-scroll-locked');
      document.documentElement.removeAttribute('data-scroll-locked');
      
      // Some Radix versions add styles to html tag as well
      document.documentElement.style.pointerEvents = '';
    }, 50);

    return () => clearTimeout(timeout);
  }, [location.pathname]);

  return null;
};
