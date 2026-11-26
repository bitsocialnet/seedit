import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Opens a page at its top, unless the link names a section of it, which its hash link scrolls to instead. */
const useScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
};

export default useScrollToTop;
