// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReplyForm from './reply-form';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  analyticsMock: vi.fn(),
  publishReply: vi.fn(),
  publishReplyOptions: {} as { content?: string; link?: string },
}));

vi.mock('../../lib/analytics', () => ({ trackPostingEvent: (...args: unknown[]) => testState.analyticsMock(...args) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@bitsocial/bitsocial-react-hooks', () => ({ useCommunity: () => ({}) }));
vi.mock('../../hooks/use-is-community-offline', () => ({ default: () => ({ isOffline: false, offlineTitle: '' }) }));
vi.mock('../../hooks/use-community-identifier', () => ({ getCommunityIdentifier: (address: string) => address }));
vi.mock('../../hooks/use-publish-reply', () => ({
  default: () => ({
    publishReply: testState.publishReply,
    publishReplyOptions: testState.publishReplyOptions,
    replyIndex: undefined,
    resetPublishReplyOptions: vi.fn(),
    setPublishReplyOptions: { content: vi.fn(), link: vi.fn(), spoiler: vi.fn(), nsfw: vi.fn() },
  }),
}));
vi.mock('../markdown', () => ({ default: () => null }));

let container: HTMLDivElement;
let root: Root;

const renderAndSave = async (publishReplyOptions: { content?: string; link?: string }) => {
  testState.publishReplyOptions = publishReplyOptions;
  await act(async () => {
    root.render(createElement(ReplyForm, { cid: 'parent-cid', communityAddress: 'example.bso', postCid: 'post-cid' }));
  });
  const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'save');
  await act(async () => saveButton?.click());
};

describe('ReplyForm posting analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('alert', vi.fn());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    [{}, 'empty_comment_alert'],
    [{ content: 'Reply body', link: 'not a url' }, 'invalid_url_alert'],
  ])('counts a reply the form rejects, without publishing it (%o)', async (publishReplyOptions, alertKey) => {
    await renderAndSave(publishReplyOptions);
    expect(alert).toHaveBeenCalledWith(alertKey);
    expect(testState.publishReply).not.toHaveBeenCalled();
    expect(testState.analyticsMock.mock.calls).toEqual([['post_validation_failed', { kind: 'reply' }]]);
  });

  it('publishes a valid reply with its own attempt and sends nothing for the submit', async () => {
    await renderAndSave({ content: 'Reply body' });
    expect(testState.publishReply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ finish: expect.any(Function), verify: expect.any(Function) }));
    expect(testState.analyticsMock).not.toHaveBeenCalled();

    testState.publishReply.mock.calls[0][0].finish('post_publish_failed');
    expect(testState.analyticsMock.mock.calls).toEqual([['post_publish_failed', { kind: 'reply' }]]);
  });
});
