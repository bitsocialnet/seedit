import { create } from 'zustand';

export type ModernFeedView = 'card' | 'compact';

// scripts/vite-static-shell.mjs reads this key too: its prerendered feed is the card view.
const STORAGE_KEY = 'modernFeedView';

const readInitialView = (): ModernFeedView => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'compact' ? 'compact' : 'card';
  } catch {
    return 'card';
  }
};

interface ModernFeedViewState {
  feedView: ModernFeedView;
  setFeedView: (feedView: ModernFeedView) => void;
}

/** How the modern interface's feeds show posts, remembered across visits: large cards, or compact rows. */
const useModernFeedViewStore = create<ModernFeedViewState>((set) => ({
  feedView: readInitialView(),
  setFeedView: (feedView) => {
    try {
      localStorage.setItem(STORAGE_KEY, feedView);
    } catch {
      // Storage can be unavailable, as in some private windows; the choice then lasts for the visit.
    }
    set({ feedView });
  },
}));

export default useModernFeedViewStore;
