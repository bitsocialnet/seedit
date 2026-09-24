import { create } from 'zustand';

export interface PrefetchTarget {
  commentCid?: string;
  communityAddress?: string;
}

interface PrefetchState extends PrefetchTarget {
  setPrefetchTarget: (target: PrefetchTarget) => void;
}

// The post or community the pointer last rested on. components/prefetcher subscribes to it with the
// same Bitsocial hooks its page uses, so peer data starts loading before the click. One target at a
// time keeps a pointer moving across a feed from starting many background updates.
const usePrefetchStore = create<PrefetchState>((set) => ({
  commentCid: undefined,
  communityAddress: undefined,
  setPrefetchTarget: ({ commentCid, communityAddress }) => set({ commentCid, communityAddress }),
}));

export default usePrefetchStore;
