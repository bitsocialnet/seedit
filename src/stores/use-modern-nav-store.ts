import { create } from 'zustand';

const STORAGE_KEY = 'modernNavCollapsed';

const readInitialCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

interface ModernNavState {
  /** On wide screens the left navigation can collapse to a strip that opens while the pointer is over it. */
  isCollapsed: boolean;
  setCollapsed: (isCollapsed: boolean) => void;
}

const useModernNavStore = create<ModernNavState>((set) => ({
  isCollapsed: readInitialCollapsed(),
  setCollapsed: (isCollapsed) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    } catch {
      // Without storage the choice still applies for this session.
    }
    set({ isCollapsed });
  },
}));

export default useModernNavStore;
