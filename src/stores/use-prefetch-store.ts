import { create } from 'zustand';

export interface PrefetchTarget {
  commentCid?: string;
  communityAddress?: string;
}

interface PrefetchState extends PrefetchTarget {
  setPrefetchTarget: (target: PrefetchTarget) => void;
  clearPrefetchTarget: (target: PrefetchTarget) => void;
}

// The post or community the pointer last rested on. components/prefetcher subscribes to it with the
// same Bitsocial hooks its page uses, so peer data starts loading before the click. One target at a
// time keeps a pointer moving across a feed from starting many background updates.
const usePrefetchStore = create<PrefetchState>((set) => ({
  commentCid: undefined,
  communityAddress: undefined,
  setPrefetchTarget: ({ commentCid, communityAddress }) => set({ commentCid, communityAddress }),
  // Only the link that set the target clears it, so leaving an older link keeps a newer target.
  clearPrefetchTarget: ({ commentCid, communityAddress }) =>
    set((state) => (state.commentCid === commentCid && state.communityAddress === communityAddress ? { commentCid: undefined, communityAddress: undefined } : state)),
}));

export default usePrefetchStore;
