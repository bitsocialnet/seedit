// @vitest-environment jsdom

import { act, useState, type Key, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Inbox from './inbox';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface NotificationFixture {
  cid?: string;
  content?: string;
  parentCid?: string;
  postCid?: string;
  markedAsRead?: boolean;
  timestamp?: number;
}

const testState = vi.hoisted(() => ({ notifications: [] as NotificationFixture[], markAsRead: vi.fn(), rowKeys: [] as Key[] }));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => ({ unreadNotificationCount: 2 }),
  useNotifications: () => ({ notifications: testState.notifications, markAsRead: testState.markAsRead }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../components/error-display', () => ({ default: () => null }));
vi.mock('../../components/reply', () => ({
  default: function ReplyProbe({ reply }: { reply: NotificationFixture }) {
    const [clicks, setClicks] = useState(0);
    return (
      <button data-row={reply.cid || reply.content} onClick={() => setClicks(clicks + 1)}>
        {clicks}
      </button>
    );
  },
}));
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data = [],
    itemContent,
    computeItemKey,
  }: {
    data?: NotificationFixture[];
    itemContent: (index: number, notification: NotificationFixture) => ReactNode;
    computeItemKey?: (index: number, notification: NotificationFixture) => Key;
  }) => {
    testState.rowKeys = data.map((notification, index) => computeItemKey?.(index, notification) ?? index);
    return (
      <div>
        {data.map((notification, index) => (
          <div key={testState.rowKeys[index]}>{itemContent(index, notification)}</div>
        ))}
      </div>
    );
  },
}));

describe('Inbox virtualized updates', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderInbox = async () => {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <Inbox />
        </MemoryRouter>,
      ),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testState.notifications = [
      { cid: 'first-reply', parentCid: 'parent-reply', postCid: 'post', markedAsRead: false },
      { cid: 'second-reply', parentCid: 'post', postCid: 'post', markedAsRead: false },
    ];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('preserves notification DOM and local state when replies reorder and prepend', async () => {
    await renderInbox();
    const firstRow = container.querySelector<HTMLButtonElement>('[data-row="first-reply"]');
    await act(async () => firstRow?.click());
    testState.notifications = [testState.notifications[1], testState.notifications[0]];
    await renderInbox();
    expect(container.querySelector('[data-row="first-reply"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');

    testState.notifications = [{ cid: 'new-reply', parentCid: 'post', postCid: 'post' }, ...testState.notifications];
    await renderInbox();
    expect(container.querySelector('[data-row="first-reply"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');
    expect(container.querySelector('[data-row="new-reply"]')?.textContent).toBe('0');
  });

  it('keeps surviving notifications mounted when filters remove earlier rows', async () => {
    await renderInbox();
    const secondRow = container.querySelector<HTMLButtonElement>('[data-row="second-reply"]');
    await act(async () => secondRow?.click());
    await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/inbox/postreplies"]')?.click());
    expect(container.querySelector('[data-row="first-reply"]')).toBeNull();
    expect(container.querySelector('[data-row="second-reply"]')).toBe(secondRow);
    expect(secondRow?.textContent).toBe('1');

    await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/inbox/commentreplies"]')?.click());
    expect([...container.querySelectorAll('[data-row]')].map((row) => row.getAttribute('data-row'))).toEqual(['first-reply']);
    testState.notifications = testState.notifications.map((notification, index) => ({ ...notification, markedAsRead: index === 0 }));
    await renderInbox();
    await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/inbox/unread"]')?.click());
    expect([...container.querySelectorAll('[data-row]')].map((row) => row.getAttribute('data-row'))).toEqual(['second-reply']);
  });

  it('keeps CID-less notifications distinct with positional fallback when timestamps match', async () => {
    testState.notifications = [
      { content: 'pending-one', timestamp: 1 },
      { content: 'pending-two', timestamp: 1 },
    ];
    await renderInbox();
    expect(testState.rowKeys).toEqual([0, 1]);
    const firstRow = container.querySelector<HTMLButtonElement>('[data-row="pending-one"]');
    await act(async () => firstRow?.click());
    testState.notifications = testState.notifications.map((notification) => ({ ...notification }));
    await renderInbox();
    expect(container.querySelector('[data-row="pending-one"]')).toBe(firstRow);
    expect(firstRow?.textContent).toBe('1');
    expect(container.querySelector('[data-row="pending-two"]')?.textContent).toBe('0');
  });
});
