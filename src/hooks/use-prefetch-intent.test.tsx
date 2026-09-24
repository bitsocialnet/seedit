// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usePrefetchStore from '../stores/use-prefetch-store';
import usePrefetchIntent, { PREFETCH_INTENT_DELAY_MS } from './use-prefetch-intent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PostLink = () => createElement('a', { href: '#/post', ...usePrefetchIntent({ commentCid: 'post-cid' }) }, 'post');

describe('usePrefetchIntent', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    usePrefetchStore.setState({ commentCid: undefined, communityAddress: undefined });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(createElement(PostLink)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const hover = (type: 'mouseover' | 'mouseout') => act(() => container.querySelector('a')!.dispatchEvent(new MouseEvent(type, { bubbles: true })));

  it('prefetches after the pointer rests on the link', () => {
    hover('mouseover');
    act(() => vi.advanceTimersByTime(PREFETCH_INTENT_DELAY_MS - 1));
    expect(usePrefetchStore.getState().commentCid).toBeUndefined();
    act(() => vi.advanceTimersByTime(1));
    expect(usePrefetchStore.getState().commentCid).toBe('post-cid');
  });

  it('ignores a pointer passing over the link', () => {
    hover('mouseover');
    hover('mouseout');
    act(() => vi.advanceTimersByTime(PREFETCH_INTENT_DELAY_MS));
    expect(usePrefetchStore.getState().commentCid).toBeUndefined();
  });

  it('stops prefetching when the pointer leaves the link', () => {
    hover('mouseover');
    act(() => vi.advanceTimersByTime(PREFETCH_INTENT_DELAY_MS));
    hover('mouseout');
    expect(usePrefetchStore.getState().commentCid).toBeUndefined();
  });

  it('keeps a newer target when an older link is left', () => {
    usePrefetchStore.getState().setPrefetchTarget({ commentCid: 'newer-cid' });
    usePrefetchStore.getState().clearPrefetchTarget({ commentCid: 'post-cid' });
    expect(usePrefetchStore.getState().commentCid).toBe('newer-cid');
  });
});
