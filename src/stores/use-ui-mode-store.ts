import { create } from 'zustand';
import { DEFAULT_UI_MODE, getSearchWithoutUiMode, getUiModeFromSearch, isUiMode, UI_MODE_STORAGE_KEY, type UiMode } from '../lib/utils/ui-mode-utils';

interface UiModeState {
  uiMode: UiMode;
  setUiMode: (uiMode: UiMode) => void;
}

const readInitialUiMode = (): UiMode => {
  try {
    const requestedUiMode = getUiModeFromSearch(window.location.search);
    if (requestedUiMode) {
      localStorage.setItem(UI_MODE_STORAGE_KEY, requestedUiMode);
      // The switch is one-time, so a link copied afterwards does not switch whoever opens it. The query sits before the
      // hash route, outside what HashRouter manages, and this runs before the router reads the location.
      const { pathname, search, hash } = window.location;
      window.history.replaceState(window.history.state, '', `${pathname}${getSearchWithoutUiMode(search)}${hash}`);
      return requestedUiMode;
    }
    const storedUiMode = localStorage.getItem(UI_MODE_STORAGE_KEY);
    return isUiMode(storedUiMode) ? storedUiMode : DEFAULT_UI_MODE;
  } catch {
    return DEFAULT_UI_MODE;
  }
};

const useUiModeStore = create<UiModeState>((set) => ({
  uiMode: readInitialUiMode(),
  setUiMode: (uiMode) => {
    try {
      localStorage.setItem(UI_MODE_STORAGE_KEY, uiMode);
    } catch {
      // Without storage the choice still applies for this session.
    }
    set({ uiMode });
  },
}));

export default useUiModeStore;
