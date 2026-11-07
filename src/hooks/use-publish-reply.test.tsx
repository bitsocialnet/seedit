// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usePublishReply from './use-publish-reply';
import { startPostingAnalytics } from '../lib/posting-analytics';
import useChallengesStore from '../stores/use-challenges-store';
import usePublishReplyStore from '../stores/use-publish-reply-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  abandonPublish: vi.fn().mockResolvedValue(undefined),
  analyticsMock: vi.fn(),
  lastOptions: undefined as Record<string, any> | undefined,
}));

vi.mock('../lib/analytics', () => ({ trackPostingEvent: (...args: unknown[]) => testState.analyticsMock(...args) }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  usePublishComment: (options: Record<string, any>) => {
    testState.lastOptions = options;
    return { abandonPublish: testState.abandonPublish, index: undefined, publishComment: vi.fn() };
  },
}));

let container: HTMLDivElement;
let latestValue: ReturnType<typeof usePublishReply>;
let root: Root;

const HookHarness = () => {
  latestValue = usePublishReply({ cid: 'parent-cid', communityAddress: 'example.bso', postCid: 'post-cid' });
  return null;
};

describe('usePublishReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.lastOptions = undefined;
    useChallengesStore.setState({ challenges: [] });
    usePublishReplyStore.getState().resetReplyStore('parent-cid');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(createElement(HookHarness)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useChallengesStore.setState({ challenges: [] });
    usePublishReplyStore.getState().resetReplyStore('parent-cid');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('routes challenge cancellation to the current usePublishComment abandonPublish', async () => {
    await act(async () => {
      latestValue.setPublishReplyOptions.content('Reply body');
    });

    await act(async () => {
      await testState.lastOptions?.onChallenge({ challenges: [] }, { content: 'Reply body' });
    });

    expect(useChallengesStore.getState().challenges).toHaveLength(1);

    await act(async () => {
      await useChallengesStore.getState().abandonCurrentChallenge();
    });

    expect(testState.abandonPublish).toHaveBeenCalledOnce();
  });

  it('reports a rejected reply to the attempt it was published with', async () => {
    await act(async () => {
      latestValue.setPublishReplyOptions.content('Reply body');
    });
    latestValue.publishReply(startPostingAnalytics({ kind: 'reply' }));
    vi.stubGlobal('alert', vi.fn());
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await testState.lastOptions?.onChallengeVerification({ challengeSuccess: false, reason: 'rejected' }, { content: 'Reply body' });

    expect(testState.analyticsMock.mock.calls).toEqual([['post_challenge_failed', { kind: 'reply' }]]);
    // The store's alert still explains the rejection.
    expect(alert).toHaveBeenCalledOnce();
  });

  it('puts the published draft back in the reply form when the challenge is cancelled', async () => {
    await act(async () => {
      latestValue.setPublishReplyOptions.content('Reply body');
    });
    await act(async () => {
      latestValue.setPublishReplyOptions.link('https://example.com/image.png');
    });
    await act(async () => {
      latestValue.setPublishReplyOptions.spoiler(true);
    });
    await act(async () => {
      latestValue.setPublishReplyOptions.nsfw(true);
    });
    latestValue.publishReply();

    await act(async () => {
      await testState.lastOptions?.onChallenge({ challenges: [] }, { content: 'Reply body' });
      latestValue.resetPublishReplyOptions();
    });
    expect(usePublishReplyStore.getState().content['parent-cid']).toBe(undefined);

    await act(async () => {
      await useChallengesStore.getState().abandonCurrentChallenge();
    });

    const restoredStore = usePublishReplyStore.getState();
    expect(restoredStore.content['parent-cid']).toBe('Reply body');
    expect(restoredStore.link['parent-cid']).toBe('https://example.com/image.png');
    expect(restoredStore.spoiler['parent-cid']).toBe(true);
    expect(restoredStore.nsfw['parent-cid']).toBe(true);
  });
});
