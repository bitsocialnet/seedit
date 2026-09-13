import { create } from 'zustand';
import { getDevelopmentDebugPreferences, saveDevelopmentDebugPreferences, type DevelopmentDebugPreferences } from '../lib/development-debug';

interface DevelopmentDebugStore extends DevelopmentDebugPreferences {
  setMockContentEnabled: (enabled: boolean) => void;
  setShowFeedResetButton: (show: boolean) => void;
}

const useDevelopmentDebugStore = create<DevelopmentDebugStore>((set) => ({
  ...getDevelopmentDebugPreferences(),
  setMockContentEnabled: (mockContentEnabled) =>
    set((state) => {
      const preferences = { mockContentEnabled, showFeedResetButton: state.showFeedResetButton };
      saveDevelopmentDebugPreferences(preferences);
      return preferences;
    }),
  setShowFeedResetButton: (showFeedResetButton) =>
    set((state) => {
      const preferences = { mockContentEnabled: state.mockContentEnabled, showFeedResetButton };
      saveDevelopmentDebugPreferences(preferences);
      return preferences;
    }),
}));

export default useDevelopmentDebugStore;
