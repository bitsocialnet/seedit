// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useContentOptionsStore from '../../stores/use-content-options-store';
import NotificationHandler from './notification-handler';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ReplyFixture = {
  cid: string;
  timestamp: number;
  content: string;
  communityAddress: string;
  shortCommunityAddress: string;
  author: { shortAddress: string };
};

const testState = vi.hoisted(() => ({
  account: undefined as { id: string } | undefined,
  notifications: [] as unknown[],
  sentNotifications: new Map<string, unknown>(),
  showLocalNotification: vi.fn(),
  navigate: undefined as unknown,
}));

vi.mock('@bitsocial/bitsocial-react-hooks', () => ({
  useAccount: () => testState.account,
  useNotifications: () => ({ notifications: testState.notifications }),
}));
vi.mock('@bitsocial/bitsocial-react-hooks/dist/lib/localforage-lru/index.js', () => ({
  default: {
    createInstance: () => ({
      getItem: async (key: string) => testState.sentNotifications.get(key),
      setItem: async (key: string, value: unknown) => {
        testState.sentNotifications.set(key, value);
      },
    }),
  },
}));
vi.mock('../../lib/push', () => ({ showLocalNotification: (...args: unknown[]) => testState.showLocalNotification(...args) }));

const reply = (cid: string, timestamp = 1_700_000_000): ReplyFixture => ({
  cid,
  timestamp,
  content: `reply ${cid}`,
  communityAddress: 'music.bso',
  shortCommunityAddress: 'music.bso',
  author: { shortAddress: 'author' },
});

const NavigateProbe = () => {
  testState.navigate = useNavigate();
  return null;
};

const initialContentOptions = useContentOptionsStore.getState();

const notifiedCids = () => testState.showLocalNotification.mock.calls.map(([payload]) => (payload as { url: string }).url.split('/').pop());

describe('NotificationHandler', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = async (initialPath = '/') => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={[initialPath]}>
          <NotificationHandler />
          <NavigateProbe />
        </MemoryRouter>,
      ),
    );
  };

  const unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };

  // hooks return no account and no notifications until the accounts store has loaded
  const loadAccount = async (accountId: string, notifications: ReplyFixture[]) => {
    testState.account = { id: accountId };
    await receive(notifications);
  };

  const receive = async (notifications: ReplyFixture[]) => {
    testState.notifications = notifications;
    await act(async () => useContentOptionsStore.setState({}));
  };

  const setNotificationsEnabled = async (enabled: boolean) => {
    await act(async () => useContentOptionsStore.setState({ enableLocalNotifications: enabled }));
  };

  const navigate = async (path: string) => {
    await act(async () => (testState.navigate as NavigateFunction)(path));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    testState.account = undefined;
    testState.notifications = [];
    testState.sentNotifications.clear();
    useContentOptionsStore.setState({ enableLocalNotifications: false });
  });

  afterEach(async () => {
    if (root) await unmount();
    useContentOptionsStore.setState(initialContentOptions, true);
    vi.restoreAllMocks();
  });

  it('does not replay stored replies when notifications are enabled later', async () => {
    await mount();
    await loadAccount('account-1', [reply('old-2'), reply('old-1')]);

    await setNotificationsEnabled(true);
    expect(testState.showLocalNotification).not.toHaveBeenCalled();

    await receive([reply('new-1'), reply('old-2'), reply('old-1')]);
    expect(notifiedCids()).toEqual(['new-1']);
  });

  it('does not replay replies received while notifications were off', async () => {
    await mount();
    await loadAccount('account-1', [reply('old-1')]);
    await receive([reply('while-off'), reply('old-1')]);

    await setNotificationsEnabled(true);
    expect(testState.showLocalNotification).not.toHaveBeenCalled();
  });

  it('does not replay replies that arrived while the inbox was open, now or on the next start', async () => {
    await setNotificationsEnabled(true);
    await mount('/inbox');
    await loadAccount('account-1', [reply('old-1')]);
    await receive([reply('seen-in-inbox'), reply('old-1')]);
    await navigate('/');
    expect(testState.showLocalNotification).not.toHaveBeenCalled();

    await unmount();
    testState.account = undefined;
    testState.notifications = [];
    await mount();
    await loadAccount('account-1', [reply('seen-in-inbox'), reply('old-1')]);
    expect(testState.showLocalNotification).not.toHaveBeenCalled();
  });

  it('does not replay the reply history of an account switched to', async () => {
    await setNotificationsEnabled(true);
    await mount();
    await loadAccount('account-1', [reply('a-1')]);
    await loadAccount('account-2', [reply('b-2'), reply('b-1')]);
    expect(testState.showLocalNotification).not.toHaveBeenCalled();

    await receive([reply('b-3'), reply('b-2'), reply('b-1')]);
    expect(notifiedCids()).toEqual(['b-3']);
  });

  it('notifies each new reply even when two share a timestamp', async () => {
    await setNotificationsEnabled(true);
    await mount();
    await loadAccount('account-1', []);
    await receive([reply('first', 1_700_000_100)]);
    await receive([reply('second', 1_700_000_100), reply('first', 1_700_000_100)]);
    expect(notifiedCids()).toEqual(['first', 'second']);
  });
});
