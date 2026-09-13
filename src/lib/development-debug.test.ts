// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockClient: vi.fn(),
  setPkcJs: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks/dist/lib/pkc-js/index.js', () => ({
  setPkcJs: mocks.setPkcJs,
}));

vi.mock('@bitsocial/bitsocial-react-hooks/dist/lib/pkc-js/pkc-js-mock-content.js', () => ({
  default: mocks.mockClient,
}));

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

describe('configureDevelopmentMockContent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    mocks.setPkcJs.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the default protocol client when mock content is disabled', async () => {
    const { configureDevelopmentMockContent } = await import('./development-debug');

    await configureDevelopmentMockContent();

    expect(mocks.setPkcJs).not.toHaveBeenCalled();
  });

  it('installs the hooks mock-content client when enabled', async () => {
    localStorage.setItem('development-debug:v1', JSON.stringify({ mockContentEnabled: true, showFeedResetButton: false }));
    const { configureDevelopmentMockContent } = await import('./development-debug');

    await configureDevelopmentMockContent();

    expect(mocks.setPkcJs).toHaveBeenCalledOnce();
    expect(mocks.setPkcJs).toHaveBeenCalledWith(mocks.mockClient);
  });
});

describe('getDevelopmentDebugPreferences', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back safely when persisted data is invalid', async () => {
    localStorage.setItem('development-debug:v1', '{invalid');

    const { getDevelopmentDebugPreferences } = await import('./development-debug');

    expect(getDevelopmentDebugPreferences()).toEqual({
      mockContentEnabled: false,
      showFeedResetButton: false,
    });
  });
});
