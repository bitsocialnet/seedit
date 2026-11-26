// @vitest-environment jsdom

import { act, createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type useFetchGifFirstFrameType from './use-fetch-gif-first-frame';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// persistent storage outlives a reload, so anything written here must still work on the next page load
const testState = vi.hoisted(() => ({ persistedFrames: new Map<string, unknown>() }));

vi.mock('@bitsocial/bitsocial-react-hooks/dist/lib/localforage-lru/index.js', () => ({
  default: {
    createInstance: () => ({
      getItem: async (url: string) => testState.persistedFrames.get(url) ?? null,
      setItem: async (url: string, value: unknown) => {
        testState.persistedFrames.set(url, value);
      },
    }),
  },
}));

type HookResult = ReturnType<typeof useFetchGifFirstFrameType>;

let useFetchGifFirstFrame: typeof useFetchGifFirstFrameType;
let container: HTMLDivElement;
let root: Root;
let renders: { url: string | undefined; result: HookResult }[];
let images: { src: string; image: FakeImage; loaded: boolean }[];
let objectUrlCount: number;
let liveObjectUrls: Set<string>;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1;
  naturalHeight = 1;
  set src(src: string) {
    images.push({ src, image: this, loaded: false });
  }
}

// the gifuct-js fallback downloads the gif, which fails here like a CORS-blocked request
class FakeXMLHttpRequest {
  onerror: (() => void) | null = null;
  onloadend: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  responseType = '';
  timeout = 0;
  open() {}
  send() {
    queueMicrotask(() => this.onerror?.());
  }
}

const HookHarness = ({ url }: { url: string | undefined }) => {
  renders.push({ url, result: useFetchGifFirstFrame(url) });
  return null;
};

const render = async (url: string | undefined) => {
  await act(async () => root.render(createElement(HookHarness, { url })));
};

// finishes loading every pending image of the url, which completes its first frame extraction
const loadImage = async (src: string) => {
  await act(async () => {
    for (const entry of images.filter((image) => image.src === src && !image.loaded)) {
      entry.loaded = true;
      entry.image.onload?.();
    }
  });
};

const extractionCount = (src: string) => images.filter((image) => image.src === src).length;

describe('useFetchGifFirstFrame', () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ default: useFetchGifFirstFrame } = await import('./use-fetch-gif-first-frame'));
    renders = [];
    images = [];
    objectUrlCount = 0;
    liveObjectUrls = new Set();
    testState.persistedFrames.clear();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: () => undefined, drawImage: () => undefined } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob()));
    URL.createObjectURL = vi.fn(() => {
      const objectUrl = `blob:frame-${++objectUrlCount}`;
      liveObjectUrls.add(objectUrl);
      return objectUrl;
    });
    URL.revokeObjectURL = vi.fn((objectUrl: string) => {
      liveObjectUrls.delete(objectUrl);
    });
    // like a browser, an object url can only be fetched while it is alive in this page
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (!liveObjectUrls.has(input)) throw new TypeError('Failed to fetch');
        return { ok: true };
      }),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports loading from the first render and never returns a previous url frame for a new url', async () => {
    await render('https://example.com/a.gif');
    expect(renders[0].result).toEqual({ frameUrl: null, isLoading: true });
    await loadImage('https://example.com/a.gif');
    expect(renders.at(-1)?.result).toEqual({ frameUrl: 'blob:frame-1', isLoading: false });

    // b.gif's image never loads, so it stays loading
    await render('https://example.com/b.gif');
    const bRenders = renders.filter(({ url }) => url === 'https://example.com/b.gif');
    expect(bRenders.length).toBeGreaterThan(0);
    for (const { result } of bRenders) {
      expect(result).toEqual({ frameUrl: null, isLoading: true });
    }
  });

  it('keeps the current url frame when a previous url extraction finishes late', async () => {
    await render('https://example.com/a.gif');
    await render('https://example.com/b.gif');
    await loadImage('https://example.com/b.gif');
    expect(renders.at(-1)?.result).toEqual({ frameUrl: 'blob:frame-1', isLoading: false });

    await loadImage('https://example.com/a.gif');
    expect(renders.at(-1)?.result).toEqual({ frameUrl: 'blob:frame-1', isLoading: false });
  });

  it('looks a returning url up again instead of reusing its earlier result, and gets it without extracting again', async () => {
    await render('https://example.com/a.gif');
    await loadImage('https://example.com/a.gif');
    expect(renders.at(-1)?.result).toEqual({ frameUrl: 'blob:frame-1', isLoading: false });

    await render(undefined);
    const returnIndex = renders.length;
    await render('https://example.com/a.gif');
    expect(renders[returnIndex].result).toEqual({ frameUrl: null, isLoading: true });
    expect(renders.at(-1)?.result).toEqual({ frameUrl: 'blob:frame-1', isLoading: false });
    expect(extractionCount('https://example.com/a.gif')).toBe(1);
  });

  it('shares one extraction between thumbnails of the same gif, including one unmounted before its frame was ready', async () => {
    await render('https://example.com/a.gif');
    await act(async () => root.render(null));
    await act(async () =>
      root.render(
        createElement(Fragment, null, createElement(HookHarness, { url: 'https://example.com/a.gif' }), createElement(HookHarness, { url: 'https://example.com/a.gif' })),
      ),
    );
    await loadImage('https://example.com/a.gif');

    expect(extractionCount('https://example.com/a.gif')).toBe(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(renders.slice(-2).map(({ result }) => result)).toEqual([
      { frameUrl: 'blob:frame-1', isLoading: false },
      { frameUrl: 'blob:frame-1', isLoading: false },
    ]);
  });

  it('does not persist frame object urls, which stop working after a reload', async () => {
    await render('https://example.com/a.gif');
    await loadImage('https://example.com/a.gif');
    expect(renders.at(-1)?.result).toEqual({ frameUrl: 'blob:frame-1', isLoading: false });

    expect([...testState.persistedFrames.values()].filter((value) => typeof value === 'string' && value.startsWith('blob:'))).toEqual([]);
  });

  it('extracts a failed gif again on its next mount', async () => {
    await render('https://example.com/a.gif');
    await act(async () => {
      for (const entry of images) entry.image.onerror?.();
    });
    expect(renders.at(-1)?.result).toEqual({ frameUrl: null, isLoading: false });

    await render(undefined);
    await render('https://example.com/a.gif');
    expect(images.filter(({ src }) => src === 'https://example.com/a.gif').length).toBeGreaterThan(1);
  });

  it('releases the oldest frame once the session cache is full', async () => {
    for (let index = 0; index <= 500; index++) {
      await render(`https://example.com/${index}.gif`);
      await loadImage(`https://example.com/${index}.gif`);
    }
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:frame-1');
  });

  it('returns no frame and no loading state without a url', async () => {
    await render(undefined);
    expect(renders.every(({ result }) => result.frameUrl === null && !result.isLoading)).toBe(true);
  });
});
