// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PostPage from './post';
import useContentOptionsStore from '../../stores/use-content-options-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  post: { cid: 'post-cid', communityAddress: 'example.bso', timestamp: 1, title: 'Test post', replyCount: 2 },
  account: { author: { address: 'reader.bso' } },
  replies: [] as Record<string, any>[],
  isNsfwCommunity: false,
  mount: vi.fn(),
  unmount: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => testState.account,
  useAccountComments: () => ({ accountComments: [] }),
  useComment: ({ commentCid }: { commentCid?: string }) => (commentCid === 'post-cid' ? testState.post : {}),
  useCommunity: () => ({ title: 'Example' }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
  useLocation: () => ({ pathname: '/s/example.bso/comments/post-cid', search: '' }),
  useParams: () => ({ communityAddress: 'example.bso', commentCid: 'post-cid' }),
  useNavigate: () => testState.navigate,
}));
vi.mock('../../hooks/use-account-comment', () => ({ default: () => undefined }));
vi.mock('../../hooks/use-replies', () => ({ default: () => testState.replies }));
vi.mock('../../hooks/use-resolved-community-route', () => ({ default: () => ({ communityAddress: 'example.bso' }) }));
vi.mock('../../hooks/use-is-nsfw-community', () => ({ useIsNsfwCommunity: () => testState.isNsfwCommunity }));
vi.mock('../../hooks/use-state-string', () => ({ default: () => '' }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/loading-ellipsis', () => ({ default: () => null }));
vi.mock('../../components/over-18-warning', () => ({ default: () => createElement('div', { 'data-over-18-warning': true }) }));
vi.mock('../../components/post', () => ({ default: () => null }));
vi.mock('../../components/reply-form', () => ({ default: () => null }));
vi.mock('../../components/sidebar', () => ({ default: () => null }));
vi.mock('../../components/reply', async () => {
  const { createElement, useEffect, useState } = await import('react');
  return {
    default: function ReplyProbe({ reply }: { reply: Record<string, any> }) {
      const [draft, setDraft] = useState('');
      const id = reply.cid ?? reply.content;
      useEffect(() => {
        testState.mount(id);
        return () => testState.unmount(id);
      }, [id]);
      return createElement('input', {
        'data-reply-id': id,
        value: draft,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
      });
    },
  };
});

let container: HTMLDivElement;
let root: Root;

const render = async () => {
  await act(async () => root.render(createElement(PostPage)));
};
const getReplyInput = (cid: string) => container.querySelector(`[data-reply-id="${cid}"]`) as HTMLInputElement;
const replyOrder = () => Array.from(container.querySelectorAll('[data-reply-id]')).map((element) => element.getAttribute('data-reply-id'));

describe('Post reply identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.replies = [
      { cid: 'first', timestamp: 1, author: { address: 'writer.bso' } },
      { cid: 'second', timestamp: 2, author: { address: 'writer.bso' } },
    ];
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('preserves reply drafts and mounted rows when sorting and prepending a published reply', async () => {
    await render();
    expect(replyOrder()).toEqual(['first', 'second']);
    const firstInput = getReplyInput('first');
    const secondInput = getReplyInput('second');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(firstInput, 'Unsent reply');
      firstInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    testState.mount.mockClear();
    testState.unmount.mockClear();

    await act(async () => {
      Array.from(container.querySelectorAll('span'))
        .find((span) => span.textContent === 'best')
        ?.click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll('div'))
        .find((div) => div.textContent === 'new')
        ?.click();
    });
    expect(replyOrder()).toEqual(['second', 'first']);
    expect(getReplyInput('first')).toBe(firstInput);
    expect(getReplyInput('second')).toBe(secondInput);
    expect(firstInput.value).toBe('Unsent reply');
    expect(testState.mount).not.toHaveBeenCalled();
    expect(testState.unmount).not.toHaveBeenCalled();

    testState.replies = [{ cid: 'newest', timestamp: 3, author: { address: 'writer.bso' } }, ...testState.replies];
    await render();

    expect(replyOrder()).toEqual(['newest', 'second', 'first']);
    expect(getReplyInput('first')).toBe(firstInput);
    expect(getReplyInput('second')).toBe(secondInput);
    expect(firstInput.value).toBe('Unsent reply');
    expect(testState.mount).toHaveBeenCalledExactlyOnceWith('newest');
    expect(testState.unmount).not.toHaveBeenCalled();
  });

  it('renders distinct pending replies that share a timestamp before a CID is assigned', async () => {
    testState.replies = [
      { content: 'pending-one', timestamp: 3, state: 'pending', author: { address: 'reader.bso' } },
      { content: 'pending-two', timestamp: 3, state: 'pending', author: { address: 'reader.bso' } },
    ];
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await render();

    expect(replyOrder()).toEqual(['pending-one', 'pending-two']);
    expect(testState.mount).toHaveBeenCalledTimes(2);
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/same key/);

    testState.replies = [{ ...testState.replies[0], cid: 'published-one', state: 'succeeded' }, testState.replies[1]];
    await render();
    expect(replyOrder()).toEqual(['published-one', 'pending-two']);
  });
});

describe('Post NSFW gate', () => {
  const hasOver18Warning = () => container.querySelector('[data-over-18-warning]') !== null;
  const setContentOptions = (state: Record<string, boolean>) =>
    act(() => useContentOptionsStore.setState(state as Parameters<typeof useContentOptionsStore.setState>[0]));

  beforeEach(() => {
    testState.isNsfwCommunity = true;
    testState.replies = [];
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    testState.isNsfwCommunity = false;
    useContentOptionsStore.setState({ hideNsfwCommunities: true });
    vi.restoreAllMocks();
  });

  it('gates NSFW posts on the hide NSFW communities setting, like the community page', async () => {
    // The warning was accepted once (an older build persisted that), then the setting was turned back on.
    await setContentOptions({ hideNsfwCommunities: true, hasAcceptedWarning: true });
    await render();
    expect(hasOver18Warning()).toBe(true);

    // NSFW communities shown from the settings page without ever pressing continue on a warning.
    await setContentOptions({ hideNsfwCommunities: false, hasAcceptedWarning: false });
    await render();
    expect(hasOver18Warning()).toBe(false);
  });
});
