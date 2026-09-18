// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Thumbnail from './thumbnail';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const gifFrameState = vi.hoisted(() => ({ frameUrl: null as string | null, isLoading: false, requestedUrls: [] as (string | undefined)[] }));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
  useParams: () => ({}),
}));
vi.mock('../../hooks/use-fetch-gif-first-frame', () => ({
  default: (url: string | undefined) => {
    gifFrameState.requestedUrls.push(url);
    return { frameUrl: gifFrameState.frameUrl, isLoading: gifFrameState.isLoading };
  },
}));
vi.mock('../../stores/use-content-options-store', () => ({ default: () => ({ blurNsfwThumbnails: true }) }));
vi.mock('../../hooks/use-is-nsfw-community', () => ({ useIsNsfwCommunity: () => false }));
vi.mock('../../lib/utils/community-route-utils', () => ({ getCommunityPostPath: () => '' }));

const chromiumUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const gifUrl = 'https://example.com/animation.gif';
const gifMediaInfo = { url: gifUrl, type: 'gif' as const };

let container: HTMLDivElement;
let root: Root;

const renderThumbnail = async (props: Record<string, unknown>) => {
  await act(async () => root.render(createElement(Thumbnail, { link: gifUrl, isLink: false, isText: false, isReply: false, ...props } as any)));
};

beforeEach(() => {
  Object.defineProperty(window.navigator, 'userAgent', { value: chromiumUserAgent, configurable: true });
  gifFrameState.frameUrl = null;
  gifFrameState.isLoading = false;
  gifFrameState.requestedUrls = [];
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('Thumbnail gif rendering', () => {
  it('shows the gif itself in replies on chromium instead of a placeholder icon', async () => {
    await renderThumbnail({ commentMediaInfo: gifMediaInfo, isReply: true });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(gifUrl);
  });

  it('does not extract a first frame for reply gifs', async () => {
    await renderThumbnail({ commentMediaInfo: gifMediaInfo, isReply: true });
    expect(gifFrameState.requestedUrls).toEqual([undefined]);
  });

  it('keeps the chromium placeholder for gif posts in the feed', async () => {
    await renderThumbnail({ commentMediaInfo: gifMediaInfo, isReply: false });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span[class*="imageIcon"]')).not.toBeNull();
  });
});
