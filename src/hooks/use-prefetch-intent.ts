import { useEffect, useRef } from 'react';
import usePrefetchStore, { PrefetchTarget } from '../stores/use-prefetch-store';

// Resting on a link this long signals intent to open it; shorter passes are a pointer crossing the feed.
export const PREFETCH_INTENT_DELAY_MS = 100;

// Link props that prefetch the target's peer data while it is hovered or keyboard-focused. Touch has
// no equivalent early signal: touchstart also begins every scroll.
const usePrefetchIntent = (target: PrefetchTarget) => {
  const setPrefetchTarget = usePrefetchStore((state) => state.setPrefetchTarget);
  const clearPrefetchTarget = usePrefetchStore((state) => state.clearPrefetchTarget);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);

  const { commentCid, communityAddress } = target;
  if (!commentCid && !communityAddress) return {};
  const start = () => {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setPrefetchTarget({ commentCid, communityAddress }), PREFETCH_INTENT_DELAY_MS);
  };
  // Leaving the link stops the background subscription; after a click the page's own hooks hold it.
  const cancel = () => {
    clearTimeout(timeout.current);
    clearPrefetchTarget({ commentCid, communityAddress });
  };
  return { onMouseEnter: start, onMouseLeave: cancel, onFocus: start, onBlur: cancel };
};

export default usePrefetchIntent;
