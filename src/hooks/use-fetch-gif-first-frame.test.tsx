// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useFetchGifFirstFrame from './use-fetch-gif-first-frame';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({ cachedFrames: {} as Record<string, string> }));

vi.mock('@bitsocial/bitsocial-react-hooks/dist/lib/localforage-lru/index.js', () => ({
  default: {
    createInstance: () => ({
      getItem: async (url: string) => testState.cachedFrames[url] ?? null,
      setItem: async () => undefined,
    }),
  },
}));

type HookResult = ReturnType<typeof useFetchGifFirstFrame>;

let container: HTMLDivElement;
let root: Root;
let renders: { url: string | undefined; result: HookResult }[];

const HookHarness = ({ url }: { url: string | undefined }) => {
  renders.push({ url, result: useFetchGifFirstFrame(url) });
  return null;
};

const render = async (url: string | undefined) => {
  await act(async () => root.render(createElement(HookHarness, { url })));
};

describe('useFetchGifFirstFrame', () => {
  beforeEach(() => {
    renders = [];
    testState.cachedFrames = { 'https://example.com/a.gif': 'blob:a-frame' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true })),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('reports loading from the first render and never returns a previous url frame for a new url', async () => {
    await render('https://example.com/a.gif');
    expect(renders[0].result).toEqual({ frameUrl: null, isLoading: true });
    expect(renders.at(-1)?.result).toEqual({ frameUrl: 'blob:a-frame', isLoading: false });

    // b.gif is not cached and its extraction never settles in jsdom, so it stays loading
    await render('https://example.com/b.gif');
    const bRenders = renders.filter(({ url }) => url === 'https://example.com/b.gif');
    expect(bRenders.length).toBeGreaterThan(0);
    for (const { result } of bRenders) {
      expect(result).toEqual({ frameUrl: null, isLoading: true });
    }
  });

  it('returns no frame and no loading state without a url', async () => {
    await render(undefined);
    expect(renders.every(({ result }) => result.frameUrl === null && !result.isLoading)).toBe(true);
  });
});
