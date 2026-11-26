// @vitest-environment jsdom

import * as React from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModernInbox from './modern-inbox';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act = (React as { act?: (callback: () => void | Promise<void>) => void | Promise<void> }).act as (callback: () => void | Promise<void>) => void | Promise<void>;

const testState = vi.hoisted(() => ({
  inbox: {} as Record<string, unknown>,
  markAsRead: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: { data: unknown[]; itemContent: (index: number, item: unknown) => React.ReactNode }) =>
    createElement(
      'div',
      null,
      data.map((item, index) => createElement('div', { key: index }, itemContent(index, item))),
    ),
}));
vi.mock('../../hooks/use-inbox', () => ({ default: () => testState.inbox }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/modern-layout', () => ({
  ModernColumns: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
  modernStyles: {},
}));
vi.mock('../../components/modern-user-profile', () => ({
  ModernUserTabs: () => null,
  ModernUserFeedStatus: ({ text }: { text: string }) => createElement('p', { 'data-status': true }, text),
}));
vi.mock('../../components/modern-reply-card', () => ({
  default: ({ reply, label, unread }: { reply: { cid: string }; label: string; unread: boolean }) =>
    createElement('article', { 'data-cid': reply.cid, 'data-label': label, 'data-unread': String(unread) }),
}));

let container: HTMLDivElement;
let root: Root;

const render = (inbox: Record<string, unknown>) => {
  testState.inbox = { account: {}, tab: 'all', error: undefined, shouldShowError: false, markAsRead: testState.markAsRead, ...inbox };
  return act(async () => root.render(createElement(ModernInbox)));
};
const markAllRead = () => container.querySelector<HTMLButtonElement>('header button');

describe('ModernInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('labels post and comment replies and marks the unread ones', async () => {
    const notifications = [
      { cid: 'on-post', parentCid: 'post', postCid: 'post', markedAsRead: false },
      { cid: 'on-comment', parentCid: 'comment', postCid: 'post', markedAsRead: true },
    ];
    await render({ notifications, comments: notifications, unreadNotificationCount: 1 });

    const cards = Array.from(container.querySelectorAll('article')).map((card) => [card.dataset.cid, card.dataset.label, card.dataset.unread]);
    expect(cards).toEqual([
      ['on-post', 'post_reply', 'true'],
      ['on-comment', 'comment_reply', 'false'],
    ]);

    await act(async () => markAllRead()!.click());
    expect(testState.markAsRead).toHaveBeenCalledTimes(1);
  });

  it('disables mark all read without unread notifications and shows an empty tab', async () => {
    await render({ notifications: [{ cid: 'read', markedAsRead: true }], comments: [], unreadNotificationCount: 0, tab: 'unread' });
    expect(markAllRead()?.disabled).toBe(true);
    expect(container.querySelector('[data-status]')?.textContent).toBe('nothing_found');
  });
});
