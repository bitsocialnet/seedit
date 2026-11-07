// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usePublishCommentWithChallengeAbandon from './use-publish-comment-with-challenge-abandon';
import { startPostingAnalytics } from '../lib/posting-analytics';
import useChallengesStore from '../stores/use-challenges-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  abandonPublish: vi.fn().mockResolvedValue(undefined),
  analyticsMock: vi.fn(),
  // Like usePublishComment, a publication keeps the options of the render whose publishComment started it.
  publishedOptions: [] as Record<string, any>[],
}));

vi.mock('../lib/analytics', () => ({ trackPostingEvent: (...args: unknown[]) => testState.analyticsMock(...args) }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  usePublishComment: (options: Record<string, any>) => ({
    abandonPublish: testState.abandonPublish,
    index: undefined,
    publishComment: async () => {
      testState.publishedOptions.push(options);
    },
  }),
}));

let container: HTMLDivElement;
let latestValue: ReturnType<typeof usePublishCommentWithChallengeAbandon>;
let root: Root;

const HookHarness = ({ options }: { options: Record<string, any> }) => {
  latestValue = usePublishCommentWithChallengeAbandon(options);
  return null;
};
const renderWith = (options: Record<string, any>) => act(() => root.render(createElement(HookHarness, { options })));
const publish = (attempt: ReturnType<typeof startPostingAnalytics>) =>
  act(async () => {
    await latestValue.publishComment(attempt);
  });
const trackedEvents = () => testState.analyticsMock.mock.calls.map(([event]) => event);

describe('usePublishCommentWithChallengeAbandon analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.publishedOptions = [];
    useChallengesStore.setState({ challenges: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useChallengesStore.setState({ challenges: [] });
  });

  it('keeps analytics attached to the submitted attempt after the form unmounts', async () => {
    const onChallengeVerification = vi.fn();
    await renderWith({ content: 'private draft', onChallengeVerification });
    await publish(startPostingAnalytics({ kind: 'post' }));
    const [callbacks] = testState.publishedOptions;
    expect(callbacks).not.toHaveProperty('analyticsAttempt');

    act(() => root.unmount());
    await callbacks.onChallengeVerification({ challengeSuccess: false, reason: 'rejected' }, { title: 'private' });
    await callbacks.onChallengeVerification({ challengeSuccess: false, reason: 'rejected' }, { title: 'private' });

    expect(testState.analyticsMock.mock.calls).toEqual([['post_challenge_failed', { kind: 'post' }]]);
    // The store's own callback still runs.
    expect(onChallengeVerification).toHaveBeenCalledTimes(2);
    root = createRoot(container);
  });

  it('sends nothing when the community accepts the post', async () => {
    await renderWith({ content: 'private draft' });
    await publish(startPostingAnalytics({ kind: 'post' }));
    const [callbacks] = testState.publishedOptions;
    await callbacks.onChallenge({ challenges: [] }, {});
    await callbacks.onChallengeVerification({ challengeSuccess: false }, {});
    await callbacks.onChallenge({ challenges: [] }, {});
    await callbacks.onChallengeVerification({ challengeSuccess: true }, {});
    callbacks.onError(new Error('late error'));
    expect(testState.analyticsMock).not.toHaveBeenCalled();
  });

  it('counts a publish error once and still hands it to the form', async () => {
    const onError = vi.fn();
    await renderWith({ content: 'draft', onError });
    await publish(startPostingAnalytics({ kind: 'reply' }));
    const [callbacks] = testState.publishedOptions;
    const error = new Error('network down');
    callbacks.onError(error);
    callbacks.onError(error);
    expect(testState.analyticsMock.mock.calls).toEqual([['post_publish_failed', { kind: 'reply' }]]);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('counts explicit challenge cancellation once and abandons the publication', async () => {
    await renderWith({ content: 'draft' });
    await publish(startPostingAnalytics({ kind: 'post' }));
    const [callbacks] = testState.publishedOptions;
    await act(async () => {
      await callbacks.onChallenge({ challenges: [] }, {});
      await useChallengesStore.getState().abandonCurrentChallenge();
    });
    await callbacks.onChallengeVerification({ challengeSuccess: false, reason: 'abandoned' }, {});
    expect(trackedEvents()).toEqual(['post_cancelled']);
    expect(testState.abandonPublish).toHaveBeenCalledOnce();
  });

  it('reports each publication to its own attempt when the form publishes again before the first one is verified', async () => {
    await renderWith({ content: 'first reply' });
    await publish(startPostingAnalytics({ kind: 'reply' }));
    await renderWith({ content: 'second reply' });
    await publish(startPostingAnalytics({ kind: 'reply' }));
    const [first, second] = testState.publishedOptions;
    expect(first).not.toBe(second);

    // The first reply's acceptance does not close the second reply's attempt.
    await first.onChallengeVerification({ challengeSuccess: true }, {});
    await second.onChallengeVerification({ challengeSuccess: false, reason: 'rejected' }, {});
    expect(trackedEvents()).toEqual(['post_challenge_failed']);
  });

  it('publishes without analytics when no attempt is given', async () => {
    await renderWith({ content: 'draft' });
    await publish(startPostingAnalytics({ kind: 'post' }));
    await act(async () => {
      await latestValue.publishComment();
    });
    const [, unattributed] = testState.publishedOptions;
    unattributed.onError(new Error('failed'));
    expect(testState.analyticsMock).not.toHaveBeenCalled();
  });
});
