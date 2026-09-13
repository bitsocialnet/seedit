// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVELOPMENT_DEBUG_STORAGE_KEY } from '../lib/development-debug';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage;
};

describe('useDevelopmentDebugStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults both development tools to disabled', async () => {
    const { default: useDevelopmentDebugStore } = await import('./use-development-debug-store');

    expect(useDevelopmentDebugStore.getState()).toMatchObject({
      mockContentEnabled: false,
      showFeedResetButton: false,
    });
  });

  it('persists only the two debug preferences in the versioned schema', async () => {
    const { default: useDevelopmentDebugStore } = await import('./use-development-debug-store');

    useDevelopmentDebugStore.getState().setMockContentEnabled(true);
    useDevelopmentDebugStore.getState().setShowFeedResetButton(true);

    expect(JSON.parse(localStorage.getItem(DEVELOPMENT_DEBUG_STORAGE_KEY) ?? '{}')).toEqual({
      mockContentEnabled: true,
      showFeedResetButton: true,
    });
  });
});
