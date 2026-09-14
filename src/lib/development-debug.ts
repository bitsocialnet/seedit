export const DEVELOPMENT_DEBUG_STORAGE_KEY = 'development-debug:v1';

export interface DevelopmentDebugPreferences {
  mockContentEnabled: boolean;
  showFeedResetButton: boolean;
}

const defaultPreferences: DevelopmentDebugPreferences = {
  mockContentEnabled: false,
  showFeedResetButton: false,
};

export const getDevelopmentDebugPreferences = (): DevelopmentDebugPreferences => {
  try {
    const storedPreferences = JSON.parse(localStorage.getItem(DEVELOPMENT_DEBUG_STORAGE_KEY) ?? '{}') as Partial<DevelopmentDebugPreferences>;
    return {
      mockContentEnabled: storedPreferences.mockContentEnabled === true,
      showFeedResetButton: storedPreferences.showFeedResetButton === true,
    };
  } catch {
    return defaultPreferences;
  }
};

export const saveDevelopmentDebugPreferences = (preferences: DevelopmentDebugPreferences) => {
  try {
    localStorage.setItem(DEVELOPMENT_DEBUG_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Debug preferences can remain session-local when browser storage is unavailable.
  }
};

export const configureDevelopmentMockContent = async () => {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'profiling') return;

  if (!getDevelopmentDebugPreferences().mockContentEnabled) return;

  const [{ setPkcJs }, { default: PkcJsMockContent }] = await Promise.all([
    import('@bitsocial/bitsocial-react-hooks/dist/lib/pkc-js/index.js'),
    import('@bitsocial/bitsocial-react-hooks/dist/lib/pkc-js/pkc-js-mock-content.js'),
  ]);
  setPkcJs(PkcJsMockContent);
};
