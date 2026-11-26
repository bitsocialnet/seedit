// @vitest-environment jsdom

import { act, useImperativeHandle, useState, type Key, type ReactNode, type Ref } from 'react';
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

interface SnapshotFixture {
  ranges: { startIndex: number; endIndex: number; size: number }[];
  scrollTop: number;
}

const testState = vi.hoisted(() => ({
  account: { unreadNotificationCount: 2 } as Record<string, unknown>,
  notifications: [] as NotificationFixture[],
  markAsRead: vi.fn(),
  restoredSnapshots: [] as (SnapshotFixture | undefined)[],
  rowKeys: [] as Key[],
  scrollTop: 0,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => testState.account,
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
    ref,
    restoreStateFrom,
  }: {
    data?: NotificationFixture[];
    itemContent: (index: number, notification: NotificationFixture) => ReactNode;
    computeItemKey?: (index: number, notification: NotificationFixture) => Key;
    ref?: Ref<{ getState: (callback: (snapshot: SnapshotFixture) => void) => void }>;
    restoreStateFrom?: SnapshotFixture;
  }) => {
    // Virtuoso only reads the snapshot to restore when it mounts
    useState(() => testState.restoredSnapshots.push(restoreStateFrom));
    useImperativeHandle(ref, () => ({ getState: (callback) => callback({ ranges: [{ startIndex: 0, endIndex: 0, size: 100 }], scrollTop: testState.scrollTop }) }));
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
    testState.account = { unreadNotificationCount: 2 };
    testState.restoredSnapshots = [];
    testState.scrollTop = 0;
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

  it('restores a scroll snapshot only into the inbox tab it was saved from, whatever the unread count', async () => {
    // returning to the inbox from a post mounts it again at the current tab
    const remountInboxAt = (path: string) =>
      act(async () =>
        root.render(
          <MemoryRouter key={`${path}-${testState.restoredSnapshots.length}`} initialEntries={[path]}>
            <Inbox />
          </MemoryRouter>,
        ),
      );

    await remountInboxAt('/inbox');
    testState.scrollTop = 900;
    await act(async () => window.dispatchEvent(new Event('scroll')));

    await remountInboxAt('/inbox/commentreplies');
    expect(testState.restoredSnapshots.at(-1)).toBeUndefined();

    testState.account = { unreadNotificationCount: 0 };
    await remountInboxAt('/inbox');
    expect(testState.restoredSnapshots.at(-1)?.scrollTop).toBe(900);
  });
});
