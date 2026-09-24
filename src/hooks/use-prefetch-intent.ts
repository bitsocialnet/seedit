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
  const intent = useRef({ hover: false, focus: false });
  const { commentCid, communityAddress } = target;
  // A link that unmounts (scrolled out of a virtualized feed, or left by navigation) releases its
  // target too. On navigation the destination page's hooks subscribe before the prefetcher lets go.
  useEffect(
    () => () => {
      clearTimeout(timeout.current);
      clearPrefetchTarget({ commentCid, communityAddress });
    },
    [clearPrefetchTarget, commentCid, communityAddress],
  );

  if (!commentCid && !communityAddress) return {};
  const start = (kind: 'hover' | 'focus') => {
    intent.current[kind] = true;
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setPrefetchTarget({ commentCid, communityAddress }), PREFETCH_INTENT_DELAY_MS);
  };
  // Leaving the link (once neither hovered nor focused) stops the background subscription; after a
  // click the page's own hooks hold it.
  const end = (kind: 'hover' | 'focus') => {
    intent.current[kind] = false;
    if (intent.current.hover || intent.current.focus) return;
    clearTimeout(timeout.current);
    clearPrefetchTarget({ commentCid, communityAddress });
  };
  return { onMouseEnter: () => start('hover'), onMouseLeave: () => end('hover'), onFocus: () => start('focus'), onBlur: () => end('focus') };
};

export default usePrefetchIntent;
