// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { CommentMediaInfo } from '../lib/utils/media-utils';
import { useCommentMediaInfo } from './use-comment-media-info';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const testState = vi.hoisted(() => ({
  fetchThumbnail: undefined as unknown as Mock<(commentMediaInfo: CommentMediaInfo) => Promise<CommentMediaInfo>>,
  pendingThumbnails: new Map<string, (thumbnail: string | undefined) => void>(),
}));

// The thumbnail cache opens browser storage at import time.
vi.mock('@bitsocial/bitsocial-react-hooks/dist/lib/localforage-lru/index.js', () => ({
  default: { createInstance: () => ({ getItem: vi.fn(), setItem: vi.fn() }) },
}));
vi.mock('../lib/utils/media-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/utils/media-utils')>()),
  fetchWebpageThumbnailIfNeeded: (commentMediaInfo: CommentMediaInfo) => testState.fetchThumbnail(commentMediaInfo),
}));

let container: HTMLDivElement;
let root: Root;
let results: (CommentMediaInfo | undefined)[];

const HookHarness = ({ comment }: { comment: Record<string, unknown> }) => {
  results.push(useCommentMediaInfo(comment as never));
  return null;
};

const render = async (comment: Record<string, unknown>, path = '/s/example.bso/comments/post-cid') => {
  await act(async () =>
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [path], key: path },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/s/:communityAddress', element: createElement(HookHarness, { comment }) }),
          createElement(Route, { path: '/s/:communityAddress/comments/:commentCid', element: createElement(HookHarness, { comment }) }),
        ),
      ),
    ),
  );
};

const finishThumbnailFetch = async (url: string, thumbnail: string | undefined) => {
  await act(async () => testState.pendingThumbnails.get(url)?.(thumbnail));
};

describe('useCommentMediaInfo', () => {
  beforeEach(() => {
    results = [];
    testState.pendingThumbnails.clear();
    testState.fetchThumbnail = vi.fn(
      (commentMediaInfo: CommentMediaInfo) =>
        new Promise<CommentMediaInfo>((resolve) => {
          testState.pendingThumbnails.set(commentMediaInfo.url, (thumbnail) => resolve({ ...commentMediaInfo, thumbnail }));
        }),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the thumbnail it fetches for a webpage link on the post page', async () => {
    await render({ cid: 'post-cid', link: 'https://example.com/article' });
    expect(results.at(-1)).toMatchObject({ type: 'webpage', url: 'https://example.com/article' });
    expect(results.at(-1)?.thumbnail).toBeUndefined();

    await finishThumbnailFetch('https://example.com/article', 'https://example.com/preview.png');
    expect(results.at(-1)).toMatchObject({ type: 'webpage', url: 'https://example.com/article', thumbnail: 'https://example.com/preview.png' });
  });

  it('fetches once per link instead of on every comment update', async () => {
    await render({ cid: 'post-cid', link: 'https://example.com/article', upvoteCount: 1 });
    await render({ cid: 'post-cid', link: 'https://example.com/article', upvoteCount: 2 });
    expect(testState.fetchThumbnail).toHaveBeenCalledTimes(1);
  });

  it('never shows a thumbnail fetched for the previous link', async () => {
    await render({ cid: 'post-cid', link: 'https://example.com/old' });
    await render({ cid: 'post-cid', link: 'https://example.com/new' });
    await finishThumbnailFetch('https://example.com/old', 'https://example.com/old.png');
    expect(results.at(-1)?.url).toBe('https://example.com/new');
    expect(results.at(-1)?.thumbnail).toBeUndefined();

    await finishThumbnailFetch('https://example.com/new', 'https://example.com/new.png');
    expect(results.at(-1)).toMatchObject({ url: 'https://example.com/new', thumbnail: 'https://example.com/new.png' });
  });

  it('does not fetch a thumbnail for a link on a thumbnail-blacklisted domain', async () => {
    await render({ cid: 'post-cid', link: 'https://mobile.twitter.com/user/status/1' });
    expect(results.at(-1)).toMatchObject({ type: 'webpage', url: 'https://mobile.twitter.com/user/status/1' });
    expect(results.at(-1)?.thumbnail).toBeUndefined();
    expect(testState.fetchThumbnail).not.toHaveBeenCalled();
  });

  it('keeps the thumbnail the community provides and does not fetch in feeds', async () => {
    await render({ cid: 'post-cid', link: 'https://example.com/article', thumbnailUrl: 'https://example.com/provided.png' });
    await render({ cid: 'other-cid', link: 'https://example.com/other' }, '/s/example.bso');
    expect(testState.fetchThumbnail).not.toHaveBeenCalled();
  });
});
